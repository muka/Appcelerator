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

var httplib = module.exports;
httplib.initialize = function(compose) {

    DEBUG = compose.config.debug;

    httplib.connect = function(handler, success, failure) {
        success();
    };
    httplib.disconnect = function() {};

    httplib.request = function(handler) {

        var http = new XMLHttpRequest();
        var url = compose.config.url + handler.path;

        d(handler.method + ' ' + url);

        http.onreadystatechange = function () {
            if (http.readyState !== 4) {
                return;
            }
            if (http.status >= 400) {
                var err = {
                    code: http.status
                }
                handler.emitter.trigger('error', err);
                handler.onError(err)
            }
            else {

                var data = http.responseText;

                try {
                    data = JSON.parse(data);
                }
                catch(e) {}

                handler.emitter && handler.emitter.trigger('success', data);
                handler.onSuccess && handler.onSuccess(data);
            }
        };

        http.open(handler.method, url, true);

        var headers = {
            "Content-type": "application/json",
            "Authorization": compose.config.apiKey
        };

        if(handler.headers) {
            for(var key in handler.headers) {
                headers[ key ] = handler.headers[key];
            }
        }

        for(var key in headers) {
            http.setRequestHeader(key, headers[ key ]);
        }

        var body = null;
        if(handler.body) {

            body = handler.body
            if(typeof handler.body === 'object' || handler.body instanceof Array) {
                body = JSON.stringify(body);
            }

            d("[browser client] Req. body: " + body);
        }

        http.send(body);
    };

};
