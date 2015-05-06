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
"use strict";

var _longStackTraces = false;

var Compose = function(config) {

    config = config || {};

    if(typeof config === 'string') {
        config = {
            apiKey: config
        };
    }

    var compose = this;

    var DEBUG = false;
    var d = function(m) { (DEBUG === true || DEBUG > 5) && console.log(m); };

    var registerUrl = "http://www.servioticy.com/?page_id=73";

    compose.util = {};
    compose.lib = {};
    compose.modules = {};
    // custom errors
    compose.error = {};

    compose.util.require = function(n) {
        compose.modules[n] = compose.require(n);
        return compose.modules[n];
    };

    compose.util.module = function(n) {
        var m = compose.util.require(n);
        m.setup(compose);
        return m;
    };

    /**
     *  Extends an object by (shallow) copying its prototype and expose a
     *  `__$parent` property to Child to get access to parent
     *
     *  @memo In the child contructor remember to call `Parent.apply(this, arguments)`
     *
     *  @param {Object} Child The object to extend
     *  @param {Object} Parent The object to extend
     *
     */
    compose.util.extend = function(Child, Parent) {
        var p = Parent.prototype;
        var c = Child.prototype;
        for (var i in p) {
            c[i] = p[i];
        }
        c.__$parent = p;
        c.parent = function() { return c.__$parent; };
    };

    compose.util.loadAdapter = function() {
        return compose.util.require('./platforms/' + compose.config.transport + '/' + compose.config.platform.name);
    };


    /*
     * Recursively copy an object to another skipping function, key with __$ prefix
     *
     * @param {Object,Array} src Source object
     * @param {Object,Array} dst Optional, destination object
     *
     * @returns {Object,Array}
     */
    compose.util.copyVal = function (src, dst) {

        var gettype = function(t) { return (t instanceof Array) ? [] : {}; };
        dst = dst || gettype(src);


        for (var i in src) {

            var v = src[i];

            if(i.substr(0, 3) === '__$') {
                continue;
            }

            if (typeof v === 'function') {
                continue;
            }

            if (v && v.toJson) {
                dst[i] = v.toJson();
                continue;
            }

            if (typeof v === 'object') {
                dst[i] = compose.util.copyVal(v);
                continue;
            }

            dst[i] = v;
        }
        return dst;
    };

    compose.util.merge = function (orig, src) {

        var gettype = function(t) { return (t instanceof Array) ? [] : {}; };
        var dst = compose.util.copyVal(orig);

        for (var i in src) {

            var v = src[i];

            if (v instanceof Array || typeof v === 'object') {
                dst[i] = compose.util.merge(v);
                continue;
            }

            dst[i] = v;
        }

        return dst;
    };

    compose.config = {
        url: 'http://api.servioticy.com',
        apiKey: null,
    };

    compose.config = compose.util.merge(compose.config, config);


    DEBUG = config.debug;

    d("Configuration:");
    d(compose.config);

    /**
     * Sniff the current enviroment
     */
    compose.config.platform = (function() {

        var platforms = {
            browser: function() {
                return (typeof document !== 'undefined' && typeof document.getElementById !== 'undefined');
            },
            titanium: function() {
                return (typeof Titanium !== 'undefined' && typeof Titanium.API !== 'undefined');
            },
            node: function() {
                return (typeof process !== 'undefined' && typeof process.exit !== 'undefined');
            }
        };

        var info = {};
        for(var type in platforms) {
            info[type] = platforms[type]();
            if(info[type]) {
                info.name = type;
            }
        }

        if(info.name) {
            return info;
        }

        throw new compose.error.ComposeError("Enviroment not supported.");

    })();


    /**
     * Select the best supported transport mechanism for the current platform
     * */
    var selectPreferredTransport = function() {
        if(!compose.config.transport) {
            var p = "http";
            switch (compose.config.platform.name) {
                case "titanium":
                case "node":
                    p = "mqtt";
                    break;
                case "browser":
                    p = "stomp";
                    break;
            }
            compose.config.transport = p;
        }
        d("selected transport is " + compose.config.transport);
    };
    selectPreferredTransport();

    compose.error.ComposeError = function() {
        this.name = "ComposeError";
        this.mapArgs(arguments);
    };
    compose.error.ComposeError.prototype = Error.prototype;
    compose.error.ComposeError.prototype.mapArgs = function(args) {

        var m = args[0];

        if(typeof m === "string") {
            this.message = args[0];
        }

        if(m instanceof Error) {
            this.message = m.message;
            this.stack = m.stack;
            this.code = m.code;
            this.errno = m.errno;
        }

    };

    compose.error.ValidationError = function() {
        this.name = "ValidationError";
        this.mapArgs(arguments);
    };
    compose.error.ValidationError.prototype = compose.error.ComposeError.prototype;


    if(!compose.config.apiKey) {
        throw new compose.error.ComposeError("An apiKey is required to use the platform, please visit " +
                registerUrl + " for further instructions");
    }

    var supportedTransports = ['mqtt', 'stomp', 'http'];

    if(compose.config.platform.titanium) {
        supportedTransports = ['mqtt', 'http'];
    }

    if(compose.config.platform.browser) {
        supportedTransports = ['stomp', 'http'];
    }

    if(supportedTransports.indexOf(compose.config.transport) < 0) {
        throw new compose.error.ComposeError("Transport " + compose.config.transport
                + " is not supported in " + compose.config.platform.name);
    }


    compose.config.apiKeyToken = compose.config.apiKey.replace('Bearer ', '');

    compose.lib.Promise = compose.util.require('bluebird');
    compose.lib.DefinitionReader = compose.util.module('./utils/DefinitionReader');
    compose.util.List = compose.util.module('./utils/List');
    compose.lib.Client = compose.util.module("./client");

    // initialize & expose WebObject module
    compose.lib.WebObject = compose.util.module('./WebObject');
    compose.WebObject = compose.lib.WebObject.WebObject;

    // initialize & expose ServiceObject module
    compose.lib.ServiceObject = compose.util.module('./ServiceObject');
    compose.util.DataBag = compose.lib.ServiceObject.DataBag;
    compose.ServiceObject = compose.lib.ServiceObject.ServiceObject;

    // alias
    compose.load = compose.lib.ServiceObject.load;
    compose.delete = compose.lib.ServiceObject.delete;
    compose.create = compose.lib.ServiceObject.create;
    compose.list = compose.lib.ServiceObject.list;

    if(compose.config.debug) {
        if(!_longStackTraces && !compose.config.platform.titanium) {
            compose.lib.Promise.longStackTraces();
        }
    }

    // keep consistent with previous version
    compose.setup = function(_config) {
        return compose.lib.Promise.resolve(new compose(_config));
    };

};

Compose.prototype.require = function(m) {
    return require(m);
};

module.exports = Compose;