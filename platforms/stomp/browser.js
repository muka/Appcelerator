/*******************************************************************************
Copyright 2015 CREATE-NET
Developed for COMPOSE project (compose-project.eu)

@author Luca Capra <luca.capra@create-net.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
******************************************************************************/


window.$$ComposeStompClient = window.$$ComposeStompClient || { ws: null, client: null };

var ws = function(val) {
    if(val !== undefined) {
        window.$$ComposeStompClient.ws = val;
    }
    return window.$$ComposeStompClient.ws;
};

var client = function(val) {
    if(val !== undefined) {
        window.$$ComposeStompClient.client = val;
    }
    return window.$$ComposeStompClient.client;
};

var reconnectTimes = 5;
var tries = reconnectTimes;

var DEBUG = false;
var d = function(m) { (DEBUG === true || (DEBUG > 19)) && console.log("[stomp client] " + m); };

var parseUrl = function(href) {

    var parser = document.createElement('a');
    parser.href = href;

    var o = {
        protocol: null,
        hostname: null,
        port: null,
        pathname: null,
        search: null,
        hash: null,
        host: null
    };

    for(var i in o) {
        if(parser[i]) {
            o[i] = parser[i];
        }
    }

    o.path = o.pathname;
    o.host = o.hostname;

    parser = null;
    return o;
};


var adapter = module.exports;
adapter.initialize = function(compose) {

    var Stomp = compose.require("stompjs");
    Stomp = typeof Stomp === 'function' ? Stomp : window.Stomp;

    DEBUG = compose.config.debug;

    var queue = this.queue;

    var host;
    if (compose.config.url) {
        var urlinfo = parseUrl(compose.config.url);
        host = urlinfo.hostname;
    }

    var ApiTokenKey = compose.config.apiKeyToken;

    var proto = compose.config.stomp.proto || null;
    var secure = compose.config.stomp.secure;

    if(proto) {
        secure = proto === "wss";
    }

    var port  = compose.config.stomp.port || (secure ? 61624 : 61623);
    proto = secure ? "wss" : "ws";

    compose.config.stomp = compose.config.stomp || {};
    var stompConf = {
        proto: proto,
        host: host || "api.servioticy.com",
        port: port,
        user: compose.config.stomp.user || "compose",
        password: compose.config.stomp.password || "shines",
        path: compose.config.stomp.path || ""
    };
    stompConf.path = stompConf.path.length && stompConf.path.substr(0,1) !== '/' ? '/' + stompConf.path  : stompConf.path ;

    var topics = {
        from: "/topic/" + ApiTokenKey + '.from',
        to: "/topic/" + ApiTokenKey + '.to'

        , stream: function(handler) {

            var _key = handler.subscription.destination || ApiTokenKey;
            var streamTopic = '/topic/'+ _key + '.' + handler.container().ServiceObject.id +'.streams.'+ handler.stream.name +'.updates';

            d("Stream topic " + streamTopic);
            return streamTopic;
        }

        , actions: function(handler) {

            var actionsTopic = '/topic/'+ handler.actions.container().id + '.actions';

            d("Actions topic " + actionsTopic);
            return actionsTopic;
        }
    };

    var request = {
        meta: {
            authorization: compose.config.apiKey
        },
        body: {}
    };

    adapter.connect = function(handler, connectionSuccess, connectionFail) {


        // initialize the client, but only if not connected or reconnecting
        // 0 not yet connected
        // 1 connected
        // 2 closing
        // 3 closed

        var needConnection = function() {
            
            if(!ws()) {
                return true;
            }

            if(client) {
                
                d("WS state " + ws().readyState);
                switch(ws().readyState) {
                    case 0:

                        d("[ws client] WS is connecting");
                        setTimeout(function() {
                            adapter.connect(handler, connectionSuccess, connectionFail);
                        }, 100);

                        return null;

                        break;
                    case 1:

                        d("[ws client] WS is already connected");
                        return false;

                        break;
                    case 2:
                    case 3:

                        d("[ws client] WS is closed or closing");
                        ws(null);

                        break;
                }
            }

            return true;
        };

        var needConn = needConnection();

        if(needConn === null) {
            return;
        }

        if (needConn) {

            d("Connecting to stomp server " +
                    stompConf.proto +'://'+ stompConf.host + ':' + stompConf.port + stompConf.path);

            var _websocket = new WebSocket(stompConf.proto + "://" + stompConf.host + ":" + stompConf.port);
            ws(_websocket);

            client(Stomp.over(ws()));

            client().debug = d;

            client().connect({
                    login: stompConf.user,
                    passcode: stompConf.password
                },
                function() { //success

                    handler.emitter.trigger('connect', client);

                    d("Subscribe to " + topics.to);
                    client().subscribe(topics.to, function(raw) {
                        
                        d("New message from topic " + topics.to);
                        
                        var message = JSON.parse(raw.body);
                        message.messageId = raw.headers.messageId;
                        
                        queue.handleResponse(message);
                    });

                    // return promise
                    connectionSuccess();

                },
                function(e) { // error

                    connectionFail(e);
                    handler.emitter.trigger('error', e);
                }
            );

        }
        else {
            // already connected
            connectionSuccess();
        }
    };

    adapter.disconnect = function() {
        client().close();
    };

    /*
     * @param {RequestHandler} handler
     */
    adapter.request = function(handler) {

        request.meta.method = handler.method.toUpperCase();
        request.meta.url = handler.path;

        if (handler.body) {
            var body = handler.body;
            if (typeof body === "string") {
                try {
                    body = JSON.parse(body);
                }
                catch(e) {}
            }
            request.body = body;
        }
        else {
            delete request.body;
        }

        request.meta.messageId = queue.add(handler);

        var ropts = {
//            priority: 1
        };

        d("Sending message..");
        client().send(topics.from, ropts, JSON.stringify(request));

    };

    /*
     * @param {RequestHandler} handler
     */
    adapter.subscribe = function(handler) {

        var topic = topics[ handler.topic ] ? topics[ handler.topic ] : handler.topic;
        if(typeof topic === 'function') {
            topic = topic(handler);
        };

        var uuid = queue.registerSubscription(topic, handler);

        d("[stomp client] Listening to " + topic);
        client().subscribe(topic, function(raw) {
            
            d("[stomp client] New message from topic " + topic);
            
            var message = {
                body: JSON.parse(raw.body),
                messageId: uuid
            };

            queue.handleResponse(message);
        });
    };

};
