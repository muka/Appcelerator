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


var DEBUG = false;
//DEBUG = true;

var d = function(m) { (DEBUG === true || (DEBUG > 19)) && console.log("[mqtt client] " + m); };

var mqtt = require("mqtt");
var parseUrl = require("url").parse;

var parseResponseContent = function(message) {

    var response = {
        type: null,
        meta: {},
        body: {}
    };

    if(!message) {
        return response;
    }

    if('MESSAGE' === message.substr(0, 7)) {
        var parts = message.split("\n\n")
        message = (parts.length === 2) ? parts[1] : null
    }

    if(!message) {
        return response;
    }

    try {

        message = JSON.parse(message.toString())

        response.body = message.body || {}
        response.meta = message.meta || {}

        return response;

    }
    catch(e) {
    }

    return response
}

var client;

var adapter = module.exports;
adapter.initialize = function(compose) {

    DEBUG = compose.config.debug;

    var queue = this.queue;

    var host;
    if (compose.config.url) {
        var urlinfo = parseUrl(compose.config.url);
        host = urlinfo.hostname;
    }

    compose.config.mqtt = compose.config.mqtt || {};
    var mqttConf = {
        proto: compose.config.mqtt.secure ? 'mqtts' : 'mqtt',
        host: compose.config.mqtt.host || host || "api.servioticy.com",
        port: compose.config.mqtt.port || "1883",
        user: compose.config.mqtt.user || "compose",
        password: compose.config.mqtt.password || "shines"
    };


    var topicKey = compose.config.apiKeyToken;

    var request = {
        meta: {
            authorization: topicKey
        },
        body: {}
    };

    var topics = {
        from: topicKey + '/from',
        to: topicKey + '/to'

        , stream: function(handler) {

            var _key = handler.subscription.destination || topicKey;

            var streamTopic = _key + '/' + handler.container().ServiceObject.id +'/streams/'+ handler.stream.name +'/updates';

            d("Stream topic " + streamTopic);
            return streamTopic;
        }

        , actions: function(handler) {

            var actionsTopic = handler.actions.container().id + '/actions';

            d("Actions topic " + actionsTopic);
            return actionsTopic;
        }

    };

    adapter.connect = function(handler, connectionSuccess, connectionFail) {

        d("Connection requested");

        // initialize the client, but only if not connected or reconnecting
        if (!client || (client && !client.connected && (!client.disconnecting && !client.reconnectTimer))) {

            d("Connecting to mqtt server " +
                    mqttConf.proto + "://" + mqttConf.user + ":" + mqttConf.password +
                    "@" + mqttConf.host + ":" + mqttConf.port);

            client = mqtt.connect(mqttConf.proto + "://" + mqttConf.host + ":" + mqttConf.port,  {
                username: mqttConf.user,
                password: mqttConf.password
            });

            client.on('close', function() {
                d("Connection closed");
                handler.emitter.trigger('close', client);
            });

            client.on('error', function(e) {

                d("Connection error");
                d(e);

                connectionFail(e);
                handler.emitter.trigger('error', e);
            });

            client.on('connect', function() {

                d('Connected');
                handler.emitter.trigger('connect', client);

                client.subscribe(topics.to, function(err, granted) {

                    err && handler.emitter.trigger('error', err);

                    d("Subscribed to " + topics.to);

                    client.on('message', function(topic, message, response) {

                        if(topic === topics.to) {
                            d("New message for topic.to");
                            var resp = parseResponseContent(message.toString());
                            queue.handleResponse(resp);
                        }
                    });

                    // return promise
                    connectionSuccess();

                });
            });
        }
        else {
            // already connected
            connectionSuccess();
        }
    };

    adapter.disconnect = function() {
        queue.clear();
        client.end();
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
                catch(e) {
                    body = handler.body
                }
            }
            request.body = body;
        }
        else {
            delete request.body;
        }

        request.meta.messageId = queue.add(handler);

//        console.log("#### mqtt request body", request);

        // 3rd arg has qos option { qos: 0|1|2 }
        d("Sending message..");
        client.publish(topics.from, JSON.stringify(request), { qos: 2 /*, retain: true*/ }, function() {
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

//        client.subscribe("/topic/#", function() {
//            d('Catch all subscribed');
//        });

    };




};
