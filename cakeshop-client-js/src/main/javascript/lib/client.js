(function() {
    var Client = window.Client = {};
    _.extend(Client, Backbone.Events);

    Client.post = function(url, data) {
        if (!_.isString(data)) {
            data = JSON.stringify(data);
        }

        return $.ajax({
            url: url,
            method: "POST",
            dataType: "json",
            contentType: "application/json",
            data: data,
        });
    };

    Client._stomp_subscriptions = {};
    Client.subscribe = function(topic, handler) {
        Client._stomp_subscriptions[topic] = {topic: topic, handler: handler};
        if (Client.stomp && Client.stomp.connected === true) {
            console.log('STOMP subscribing to ' + topic);

            var sub = Client.stomp.subscribe(topic, function(res) {
                handler(JSON.parse(res.body));
            });
            Client._stomp_subscriptions[topic].fh = sub;
            return sub;
        }
        return false;
    };

	$(window).on("beforeunload", function() {
		if (!(Client.stomp && Client.stomp.connected === true)) {
			return;
		}
		_.values(Client._stomp_subscriptions).forEach(function(sub) {
			if (sub && sub.fh) {
				sub.fh.unsubscribe();
			}
		});
		Client.stomp.disconnect();
	});

    Client.connected = false;
    Client.connect = function() {

        // try to derive the websocket location from the current location
        var pathname = window.location.pathname;
        var wsUrl;
        if (/^\/[\w-.]*\/$/.test(pathname)) {
          // e.g. '/cakeshop/' -> '/cakeshop/ws'
          wsUrl = pathname + 'ws';
        } else if (/^\/[\w-.]*$/.test(pathname)) {
          // e.g. '/cakeshop' -> '/cakeshop/ws'
          wsUrl = pathname + '/ws';
        } else {
          // otherwise just fall back to a safe value
          wsUrl = '/cakeshop/ws';
        }

        var stomp = Client.stomp = Stomp.over(new SockJS(wsUrl));

        stomp.debug = null;
        stomp.connect({},
            function(frame) {
                Client.connected = true;
                console.log("Connected via STOMP!");
                Client.trigger("stomp:connect");
                // reconnect all topic subscriptions
                _.each(Client._stomp_subscriptions, function(sub, topic) {
                    Client.subscribe(topic, sub.handler);
                });
            },
            function(err) {
                if (Client.connected) {
                    console.log("Lost STOMP connection", err);
                    Client.trigger("stomp:disconnect");
                }
                setTimeout(Client.connect, 1000); // always reconnect
            }
        );
	};

    Client.connect();
})();
