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
var d = function(m) { DEBUG && console.log(m); };


var request = require("request")
var parseUrl = require("url").parse;

var adapter = module.exports;
adapter.initialize = function(compose) {

    DEBUG = compose.config.debug;

    adapter.connect = function(handler, connectionSuccess, connectionFail) {
        connectionSuccess();
    };
    adapter.disconnect = function() {};

    /*
     * @param {RequestHandler} handler
     */
    adapter.request = function(handler) {


        var httpConf = compose.config.http || {};

        // allow self-signed certs by defaults
        httpConf.secure = httpConf.secure === undefined ?
                            false : httpConf.secure;

        var uri = parseUrl(compose.config.url + handler.path);

        var params = {};

        if(!httpConf.secure) {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        }

        params.rejectUnhauthorized = httpConf.secure;

        params.uri = uri;

        params.headers = {
            "Cache-Control": "no-cache",
            "Authorization": compose.config.apiKey
        };

        if(typeof handler.body === 'object' || handler.body instanceof Array) {
            params.headers["Content-Type"] = "application/json";
        }

        var body = null;
        if(handler.body) {

            body = handler.body;
            if(typeof body !== 'string') {
                body = JSON.stringify(body);
            }

            d("[node client] Req. body " + body);
        }

        params.body = body;
        params.method = handler.method;

        if(DEBUG) {
            d("[node client] Preparing request");
//            d('Params:'); d(JSON.stringify(params));
        }

        request(params, function(err, res, body) {

            if(err) {

                d("[node client] Request error");
                handler.emitter.trigger('error', err);

                return;
            }

            d("[node client] Completed request, status code " + res.statusCode);
            if(res.statusCode >= 400) {
                handler.emitter.trigger('error', body ? body : {
                    code: res.statusCode
                });
            }
            else {

                if(!body) {
                    body = null;
                }

                if(typeof body === 'string'){
                    try {
                        body = JSON.parse(body);
                    }
                    catch(e) {

                        d("Exception parsing response JSON");
                        d(e);

                        handler.emitter.trigger('error', e);
                    }
                }

                handler.emitter.trigger('success', body);

            }

        });

        d("[node client] Sent request");

    };
};
