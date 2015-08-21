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


window.$$ComposeMqttClient = window.$$ComposeMqttClient || { ws: null, client: null };

var ws = function(val) {
    if(val !== undefined) {
        window.$$ComposeMqttClient.ws = val;
    }
    return window.$$ComposeMqttClient.ws;
};

var client = function(val) {
    if(val !== undefined) {
        window.$$ComposeMqttClient.client = val;
    }
    return window.$$ComposeMqttClient.client;
};

var reconnectTimes = 5;
var tries = reconnectTimes;

var DEBUG = false;
var d = function(m) { (DEBUG === true || (DEBUG > 19)) && console.log("" + m); };

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

    var mqtt = compose.require("mqtt");

    DEBUG = compose.config.debug;

    var queue = this.queue;

    var host;
    if (compose.config.url) {
        var urlinfo = parseUrl(compose.config.url);
        host = urlinfo.hostname;
    }

    var ApiTokenKey = compose.config.apiKeyToken;

    var proto = compose.config.mqtt.proto || null;
    var secure = compose.config.mqtt.secure;

    if(proto) {
        secure = proto === "wss";
    }

    var port  = compose.config.mqtt.port || (secure ? 61624 : 61623);
    proto = secure ? "wss" : "ws";

    compose.config.mqtt = compose.config.mqtt || {};
    var mqttConf = {
        proto: proto,
        host: host || "api.servioticy.com",
        port: port,
        user: compose.config.mqtt.user || "compose",
        password: compose.config.mqtt.password || "shines",
        path: compose.config.mqtt.path || ""
    };
    mqttConf.path = mqttConf.path.length && mqttConf.path.substr(0,1) !== '/' ? '/' + mqttConf.path  : mqttConf.path ;

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

                        d("WS is connecting");
                        setTimeout(function() {
                            adapter.connect(handler, connectionSuccess, connectionFail);
                        }, 100);

                        return null;

                        break;
                    case 1:

                        d("WS is already connected");
                        return false;

                        break;
                    case 2:
                    case 3:

                        d("WS is closed or closing");
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

            d("Connecting to mqtt server " +
                    mqttConf.proto +'://'+ mqttConf.host + ':' + mqttConf.port + mqttConf.path);

            var _websocket = new WebSocket(mqttConf.proto + "://" + mqttConf.host + ":" + mqttConf.port);
            ws(_websocket);

            if (!client()) {

                d("Connecting to mqtt server " +
                        mqttConf.proto + "://" + mqttConf.user + ":" + mqttConf.password +
                        "@" + mqttConf.host + ":" + mqttConf.port);

                client(mqtt.connect(mqttConf.proto + "://" + mqttConf.host + ":" + mqttConf.port,  {
                    username: mqttConf.user,
                    password: mqttConf.password
                }));

                client().on('close', function() {
                    d("Connection closed");
                    handler.emitter.trigger('close', client);
                });

                client().on('error', function(e) {

                    d("Connection error");
                    d(e);

                    connectionFail(e);
                    handler.emitter.trigger('error', e);
                });

                client().on('connect', function() {

                    d('Connected');
                    handler.emitter.trigger('connect', client);

                    client().subscribe(topics.to, function(err, granted) {

                        err && handler.emitter.trigger('error', err);

                        d("Subscribed to " + topics.to);

                        client().on('message', function(topic, message, response) {

                            if(topic === topics.to) {
                                d("New message for topic.to");
                                var resp = parseResponseContent(message);
                                queue.handleResponse(resp);
                            }
                        });

                        // return promise
                        connectionSuccess();

                    });
                });

            }

        }
        else {
            // already connected
            connectionSuccess();
        }
    };

    adapter.disconnect = function() {
        queue.clear();
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

        // 3rd arg has qos option { qos: 0|1|2 }
        // @todo check which one fit better in this case
        d("Sending message..");
        client().publish(topics.from, JSON.stringify(request), { qos: 0 /*, retain: true*/ }, function() {
            d("Message published");
        });
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

        d("Listening to " + topic);

        client.on('message', function(srctopic, message, response) {

//            console.log(src);
//            console.log(message.toString());

            if(topic === srctopic) {

                d("New message from subscription topic");

                var obj = {
                    meta: {
                        messageId: uuid
                    },
                    body: JSON.parse(message.toString())
                };

                queue.handleResponse(obj);
            }
        });

        client.subscribe(topic, function() {
            d('Subscribed to subscription topic');
        });

    };

};
