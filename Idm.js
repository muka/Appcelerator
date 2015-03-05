/*******************************************************************************
Copyright 2014 CREATE-NET
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
(function(){

    var DEBUG = false;
    var d = function(m) { DEBUG === true || DEBUG > 10 && console.log(m); };

    var lib = {};
    lib.setup = function(compose) {

        var Promise = compose.lib.Promise;
//        var ComposeError = compose.error.ComposeError;
//        var ValidationError = compose.error.ValidationError;
//        var Emitter = compose.lib.Client.Emitter;

        /**
         *
         * @constructor
         * */
        var Idm = function() {
            this.sessions = {};
        };

        Idm.prototype.getClient = function() {
            return new compose.lib.Client.Client(this);
        };

        Idm.prototype.getUserSession = function(sessionId, credentials) {

            var me = this;
            if(!me.sessions[ sessionId ]) {

                credentials = credentials || {};

                var captchaUri = compose.config.idm.url + '/external_user_create/captcha/?session_id=' + sessionId;
                var session = {
                    id: sessionId,
                    created: new Date,
                    captcha: "",
                    captchaUri: captchaUri,
                    credentials:  credentials,
                    validate: function(captchaValue) {
                        return me.validateCaptcha(sessionId, captchaValue);
                    }
                };

                session.toString = function() {
                    return JSON.stringify({
                        session_id: session.id,
                        captcha_text: session.captcha,
                        username: session.credentials.username,
                        password: session.credentials.password,
                    });
                };

                me.sessions[ sessionId ] = session;
            }

            return me.sessions[ sessionId ];
        };

        Idm.prototype.removeUserSession = function(sessionId) {

            var me = this;
            if(me.sessions[ sessionId ]) {

                me.sessions[ sessionId ] = null;
                delete me.sessions[ sessionId ];

                return true;
            }

            return false;
        };

        /**
         */
        Idm.prototype.createUser = function(name, password) {
            var me = this;
            return new Promise(function(resolve, reject) {

                me.getClient().get(compose.config.idm.url + '/external_user_create/', null, function(sdata) {

                    var session = me.getUserSession(sdata.session_id, { username: name, password: password });

                    resolve && resolve(session);

                }, reject);

            }).bind(this);
        };

        Idm.prototype.validateCaptcha = function(sessionId, captcha) {

            var me = this;
            return new Promise(function(resolve, reject) {

                var session = me.getUserSession(sessionId);
                session.captcha = captcha;

                me.getClient().post(compose.config.idm.url + '/external_user_create/', session.toString(), function(sdata) {

                    resolve && resolve(sdata);

                }, reject);

            }).bind(this);
        };

        lib.Idm = Idm;
    };

    //-- multiplatform support
    (function(libname, lib, deps) {
        deps = (deps instanceof Array) ? deps : ['compose'];
        if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
            module.exports = lib;
        }
        else {

            if (typeof define === 'function' && define.amd) {
                define(deps, function(compose) {
                    return lib;
                });
            }
            if(typeof window !== 'undefined') {
                window.__$$composeioRegistry[libname] = lib;
            }
        }
    })
    ('Idm', lib, ['compose']);
    //-- !multiplatform support


})();