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
DEBUG = true;
var d = function(m) {
    DEBUG && console.log(m);
};

var adapter = module.exports;
adapter.initialize = function(compose) {

    DEBUG = compose.config.debug;

    adapter.connect = function(handler, connectionSuccess, connectionFail) {
        d("[titanium client] connect..");
        connectionSuccess();
    };
    adapter.disconnect = function() {
    };

    /*
     * @param {RequestHandler} handler
     */
    adapter.request = function(handler) {

        var params = {};
        params.timeout = handler.timeout || 6000;

        params.onload = function(ev) {

            var status = this.status;
            var data = this.responseText;

            d("[titanium client] Response received " + status);

//            try {
            try {
                data = JSON.parse(body);
            }
            catch (e) {
            }
//            }
//            catch (e) {
//                status = 500;
//                data = {
//                    message: "Response from server is not readable"
//                };
//            }

            if (status >= 400) {
                var err = {
                    code: status
                }
                handler.emitter.trigger('error', err);
                handler.onError(err)
            }
            else {
                handler.emitter && handler.emitter.trigger('success', data);
                handler.onSuccess && handler.onSuccess(data);
            }
        };

        params.onerror = function(e) {
            handler.emitter.trigger('error', e);
        };

        if (DEBUG) {
            d("[titanium client] Preparing request");
            d('Params:');
            d(JSON.stringify(params));
        }

        var http = Titanium.Network.createHTTPClient(params);

        http.open(handler.method, compose.config.url + handler.path);

        var headers = {
            "Content-type": "application/json",
            "Authorization": compose.config.apiKey
        };

        if (handler.headers) {
            for (var key in handler.headers) {
                headers[ key ] = handler.headers[key];
            }
        }

        for (var key in headers) {
            http.setRequestHeader(key, headers[ key ]);
        }

        var body = null;
        if (handler.body) {

            body = handler.body
            if (typeof handler.body === 'object' || handler.body instanceof Array) {
                body = JSON.stringify(body);
            }

            d("[titanium client] Req. body: " + body);
        }

        http.send(body);

    };
};
