(function(self) {

    var $$Compose = (function() { var exports = {};
var module = { exports: exports };

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

Compose.prototype.require = function(m) {
    var modules = {
        './utils/DefinitionReader': (function() {
var exports = {}; var module = { exports: exports };

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

var readDefinition = {
    titanium: function(filename, compose, success, failure) {

        var readf = function(filepath) {

            var readFile = Titanium.Filesystem.getFile(filepath);
            if (readFile.exists()) {

                var readContents = readFile.read();
                var data = readContents.text;

                return JSON.parse(data);
            }
            return false;
        };

        var basePath = Titanium.Filesystem.getResourcesDirectory() + Titanium.Platform.osname + "/";
        var filepath = basePath + compose.util.getDefinitionsPath() + filename + ".json";

        var data = readf(filepath);
//            Ti.API.log(JSON.stringify(data));
        if(data) {
            success(data);
            return;
        }
        else {
            basePath = Titanium.Filesystem.getResourcesDirectory() + "/";
            filepath = basePath + compose.util.getDefinitionsPath() + filename + ".json";
            var data = readf(filepath);
            if(data) {
                success(data);
                return;
            }
        }

        failure(new Error("Errore reading definition"));
    },
    node: function(filename, compose, success, failure) {

        var path = compose.util.getDefinitionsPath() + filename + ".json";
        var buffer = require('fs').readFile(path, function(err, data) {
            if(err) {
                failure(err);
                return;
            }

            // Both of the following variables are scoped to the callback of fs.readFile
            var data = data.toString();
            success(JSON.parse(data));
        });
    },
    browser: function(filename, compose, success, failure) {
        failure(new Error("Not implementend yet!"));
    }
};

var reader = module.exports;
reader.setup = function(compose) {

    if (!readDefinition[compose.config.platform.name]) {
        throw new Error("Platform not supported");
    }

    reader.read = function(file) {
        return new compose.lib.Promise(function(success, failure) {
            readDefinition[compose.config.platform.name](file, compose, success, failure);
        });

    };
};




return module && module.exports && Object.keys(module.exports).length
        ? module.exports : exports;
})()
,
'./utils/List': (function() {
var exports = {}; var module = { exports: exports };

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

var listlib = module.exports;
listlib.setup = function(compose) {

    var copyVal = compose.util.copyVal;

    if(!compose) {
        throw new Error("compose library reference is missing");
    }

    /**
     * @constructor
     */
    var Enumerable = function() {};
    Enumerable.prototype.__$cursor = null;
    Enumerable.prototype.__$list = null;

    /**
     * @returns {mixed} A list of values
     * */
    Enumerable.prototype.getList = function() {
        return this.__$list;
    };

    /**
     * @param {mixed} list A list to set
     * */
    Enumerable.prototype.setList = function(__list) {
        this.__$list = __list;
    };

    /**
     * @return {Number} The list items length
     * */
    Enumerable.prototype.size = function() {
        return this.getList().length;
    };

    /**
     * @return {Number} The current cursor
     * */
    Enumerable.prototype.index = function() {
        if(this.__$cursor === null) this.reset();
        return this.__$cursor;
    };

    /**
     * Move foward the internal cursor to the next item
     *
     * @return {Boolean} A value indicating if the operation is possible. False means end of list
     *
     * */
    Enumerable.prototype.next = function() {

        var emptyCursor = (this.__$cursor === null);

        if(!emptyCursor && (this.index()+1) >= this.size())
            return false;

        this.__$cursor = emptyCursor ? 0 : this.__$cursor+1;
        return true;
    };

    /**
     * Move backward the internal cursor to the previous item
     *
     * @return {Boolean} A value indicating if the operation is possible.
     *                   False means begin of list has been already reached
     *
     * */
    Enumerable.prototype.prev = function() {

        if((this.index() - 1) < 0)
            return false;

        this.__$cursor--;
        return true;
    };

    /**
     * @return {Object} The current object in the iterator
     * */
    Enumerable.prototype.current = function() {
        return this.at(this.index());
    };

    /**
     * Reset the internal cursor
     * */
    Enumerable.prototype.reset = function() {
        this.__$cursor = 0;
    };

    /**
     * Return an object at a specific index
     * */
    Enumerable.prototype.at = function(i) {
        var list = this.getList();
        return (typeof list[i] !== 'undefined') ? list[i] : null;
    };

    /**
     * @return {Object} Return the first element in the list
     * */
    Enumerable.prototype.first = function() {
        return this.at(0);
    };

    /**
     * @return {Object} Return the last element in the list
     * */
    Enumerable.prototype.last = function() {
        return this.at(this.size()-1);
    };

    /**
     * Loop the list calling fn on each element
     *
     * @param {Function<element, index>} fn A callback with the current element in the loop
     *
     * */
    Enumerable.prototype.each =
    Enumerable.prototype.forEach = function(fn) {
        var me = this;
        for(var i in this.getList()) {
            var el = this.getList()[i];
            fn.call(me, el, i);
        }
    };

    /**
     * Handles array as a list
     *
     * @constructor
     */
    var ArrayList = function(obj) {
        if(this instanceof ArrayList) {
            this.initialize(obj);
        }
    };
    compose.util.extend(ArrayList, Enumerable);

    ArrayList.prototype.__$list;
    ArrayList.prototype.__$container;

    ArrayList.prototype.container = function(o) {
        this.__$container = o || this.__$container;
        return this.__$container;
    };

    /**
     * Set the list of stored objects
     *
     * @param {Array} list An array of object to store
     * */
    ArrayList.prototype.setList = function(list) {
        this.__$list = list;
    };

    /**
     * Return the list of stored objects
     * */
    ArrayList.prototype.getList = function() {
        this.__$list = this.__$list || [];
        return this.__$list;
    };

    ArrayList.prototype.size = function() {
        return this.getList().length;
    };

    ArrayList.prototype.validate = function(obj) {
        return obj;
    };

    ArrayList.prototype.add = function(obj) {
        var objVal = this.validate(obj);
        this.getList().push(objVal);
        return objVal;
    };

    /**
     * @param {mixed} value The value to search for
     * @param {mixed} key The key to match, if provided otherwise `value` is used
     *
     * @return {mixed} The item or null if not found
     */
    ArrayList.prototype.get = function(value, key) {
        var index = this.getIndex(value, key);
        return (index > -1) ? this.getList()[index] : null;
    };

    ArrayList.prototype.set = function(name, value, key) {
        var index = this.getIndex(name, key);
        if (index > -1) {
            this.getList()[index] = value;
        }
        return this;
    };

    ArrayList.prototype.getIndex = function(val, key) {
        for (var i = 0; i < this.size(); i++) {
            var srcVal = this.getList()[i];
            if(key !== undefined) {
                srcVal = srcVal[key];
            }
            if (srcVal === val) {
                return i;
            }
        }
        return -1;
    };

    ArrayList.prototype.remove = function(value, key) {
        var i = this.getIndex(value, key);
        if(i > -1) {
            this.getList().splice(i, 1);
        }
        return this;
    };

    ArrayList.prototype.toJson = function(asString) {

        var list;
//            list = copyVal(this.getList());
        list = this.getList();

        return asString ? JSON.stringify(list) : list;
    };

    ArrayList.prototype.toString = function() {
        return this.toJson(true);
    };

    ArrayList.prototype.initialize = function(obj) {
        // initialize provided streams
        if (obj instanceof Array) {
            for (var i in obj) {
                this.add(obj[i]);
            }
        }
    };


    /**
     * This list handles an object instead of an array
     *
     * @constructor
     * @augments ArrayList
     */
    var ObjectList = function(obj) {

        ArrayList.apply(this, arguments);

        if(this instanceof ObjectList) {
            this.initialize(obj);
        }

    };
    compose.util.extend(ObjectList, ArrayList);

    ObjectList.prototype.__$list;

    /**
     * Get the list
     *
     * @return {Object} The list
     *
     */
    ObjectList.prototype.getList = function() {
        this.__$list = this.__$list || {};
        return this.__$list;
    };

    /**
     * Count the list size
     *
     * @return {Number} The list size
     *
     */
    ObjectList.prototype.size = function() {
        var c = 0;
        var list = this.getList();
        for (var i in list) {
            c++;
        }
        return c;
    };


    /**
     * Add an element to the list. If and object is passed as first arguments, it is added as a list
     *
     * @param {String|Obj} name the obj name or a list like { key1: {}, key2: {} }
     * @param {String} obj the obj value
     *
     * @return {Object} The added object instance
     *
     */
    ObjectList.prototype.add = function(name, obj) {

        if (typeof name === "object") {
            for (var i in name) {
                this.add(i, name[i]);
            }
            return this;
        }

        var objVal = this.validate(obj);
        this.getList()[name] = objVal;

        return objVal;
    };

    /**
     * Get an element from the list or null if not found
     *
     * @param {String} name the channel name
     *
     * @return {object} the requested object
     *
     */
    ObjectList.prototype.get = function(name) {
        return (this.getList()[name]) ? this.getList()[name] : null;
    };

    /**
     * Remove an element from the list
     *
     * @param {String} name the channel name
     *
     * @return {List} object instance
     *
     */
    ObjectList.prototype.remove = function(name) {
        if (this.get(name)) {
            delete this.getList()[name];
        }
        return this;
    };

    /**
     * Set a single value
     * `obj.set(name, key, value)`
     *
     * Set the whole channel informations
     * `obj.set(name, obj)`
     *
     * @param {String} name the channel name
     * @param {String} key channel object key
     * @param {String} value channel object value to set
     *
     * @return {ChannelsList} object instance
     *
     */
    ObjectList.prototype.set = function(name, key, value) {
        if (this.get(name)) {
            if (typeof key === 'object') {
                this.getList()[name] = key;
            }
            else if (key && value) {
                this.getList()[name][key] = value;
            }
        }
        return this;
    };

    ObjectList.prototype.initialize = function(obj) {

        // initialize provided streams
        if (obj && (typeof obj === 'object' || obj instanceof Array)) {
            for (var i in obj) {
                this.add(i, obj[i]);
            }
        }
    };


    listlib.Enumerable = Enumerable;

    listlib.ArrayList = ArrayList;
    listlib.ObjectList = ObjectList;
    
    return listlib;
};


return module && module.exports && Object.keys(module.exports).length
        ? module.exports : exports;
})()
,
'./client': (function() {
var exports = {}; var module = { exports: exports };

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

var client = module.exports;
client.setup = function(compose) {

    var DEBUG = false;

    var d = function(m) {
        (DEBUG === true || DEBUG > 20) && console.log(m);
    };

    var ComposeError = compose.error.ComposeError;
    var guid = function() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
    };

    if(!compose) {
        throw new ComposeError("compose.io module reference not provided, quitting..");
    }

    DEBUG = compose.config.debug;

    var httpErrors = {
      400: 'Bad Request',
      401: 'Unauthorized',
      402: 'Payment Required',
      403: 'Forbidden',
      404: 'Not Found',
      405: 'Method Not Allowed',
      406: 'Not Acceptable',
      407: 'Proxy Authentication Required',
      408: 'Request Time-out',
      409: 'Conflict',
      410: 'Gone',
      411: 'Length Required',
      412: 'Precondition Failed',
      413: 'Request Entity Too Large',
      414: 'Request-URI Too Large',
      415: 'Unsupported Media Type',
      416: 'Requested range not satisfiable',
      417: 'Expectation Failed',
      500: 'Internal Server Error',
      501: 'Not Implemented',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Time-out',
      505: 'HTTP Version not supported'
    };


    /**
     * Minimal implementation of an event emitter
     * */
    var Emitter = function() {
        this.callbacks = {};
    };

    Emitter.prototype.on = function(event, callback) {

        if(!this.callbacks[event]) {
            this.callbacks[event] = [];
        }

        this.callbacks[event].push(callback);

        return this;
    };

    Emitter.prototype.once = function(event, callback) {
        var me = this;
        var callback2;
        callback2 = function() {
            me.off(event, callback2);
            callback.apply(me, arguments);
        };

        this.on(event, callback2);

        return this;
    };

    Emitter.prototype.off = function(event, callback) {
        callback = callback || null;

        if(!this.callbacks[event]) {
            return;
        }

        if(!callback) {
            this.callbacks[event] = [];
        }
        else {
            for(var i in this.callbacks[event]) {
                if(this.callbacks[event][i] === callback) {
                    delete this.callbacks[event][i];
                    this.callbacks[event].splice(i, 1);
                }
            }
        }

        return this;
    };

    Emitter.prototype.trigger = function(event) {
        if(this.callbacks[event]) {

            var a = [];
            for(var i in arguments) {
                a[i] = arguments[i];
            }
            a.shift();

            for(var i in this.callbacks[event]) {
                this.callbacks[event][i].apply(this, a);
            }
        }

        return this;
    };

    /**
     * DataReceiver allows to register ServiceObjects for notifications from QueueManager of incoming data
     * not already handled
     *
     * @constructor
     * */
    var DataReceiver = function() {

        this.defaultTopic = '*';

        this.registry = {};
        this.registry[this.defaultTopic] = [];

    };

    /**
     * Search for SO in list and return its index
     *
     * @argument {ServiceObject} so A ServiceObject instance
     * @return {Number} The index in the list or -1 if not found
     * */
    DataReceiver.prototype.getIndex = function(so, topic) {
        topic = topic || this.defaultTopic;
        var l = this.registry[topic] ? this.registry[topic].length : 0;
        for(var i = 0; i < l; i++) {
            if(this.registry[topic][i] === so) {
                return i;
            }
        }
        return -1;
    };

    /**
     * Add SO to list
     *
     * */
    DataReceiver.prototype.bind = function(so, topic) {
        topic = topic || this.defaultTopic;
        if(this.getIndex(so, topic) < 0) {
            this.registry[topic] = this.registry[topic] || [];
            this.registry[topic].push(so);
        }
    };

    /**
     * Remove SO from list
     *
     * */
    DataReceiver.prototype.unbind = function(so, topic) {
        topic = topic || this.defaultTopic;
        var i = this.getIndex(so, topic);
        if(i > -1) {
            this.registry[topic].splice(i,1);
            if(!this.registry[topic])
                delete this.registry[topic];
        }
    };

    /**
     * Notify all ServiceObjects in the receiver of an event.
     *
     * @param {String} event The event to trigger
     * @params {mixed} data for the event
     *
     * */
    DataReceiver.prototype.notify = function(topic, event) {

        topic = topic || this.defaultTopic;
        this.registry[topic] = this.registry[topic] || [];
        var l = this.registry[topic].length;

        var args = (function() {
            var _a = [];
            for(var i in arguments) {
                if(i === 0) continue;
                _a.push(arguments[i]);
            }
           return  _a;
        })();

        for(var i = 0; i < l; i++) {
            var emitter = this.registry[topic][i].emitter();
            emitter && emitter.trigger.apply(emitter, args);
        }
    };


    /**
     * QueueManager handles queue of pub/sub communications.
     *
     * @constructor
     * */
    var QueueManager = function() {

        var me = this;
        var __receiver = null;

        // 60 seconds
        var __timeout = 60*1000;

        // queue[ uuid ] = { created: xxx, callback: xxx }
        var queue = {};
        var queueSize = 0;
        var timer;

        /**
         * Setter/Getter for dataReceiver
         *
         * */
        this.receiver = function(_r) {
            if(_r) __receiver = _r;
            return __receiver;
        };

        /**
         * Setter/Getter for timeout
         *
         * */
        this.timeout = function(_t) {
            if(_t) __timeout = _t;
            return __timeout;
        };

        var clearQueue = function() {

            if(!timer && queueSize > 0) {
                d("[queue manager] timer started");
                timer = setInterval(function() {

                    if(queueSize === 0) {
                        d("[queue manager] timer cleared");
                        clearInterval(timer);
                        timer = null;
                        return;
                    }

                    for(var i in queue) {
//                            console.log( queue[i].created + me.timeout(), (new Date).getTime() );
//                            console.log( (queue[i].created + me.timeout()) < (new Date).getTime() );
                        if(!queue[i].keep && (queue[i].created + me.timeout()) < (new Date).getTime()) {
                            d("[queue manager] Pruning " + i);
                            queue[i].handler.emitter.trigger('error', { message: 'Queue timeout', code: 408 });
                            if(queueSize > 0) {
                                queueSize--;
                            }
                            delete queue[i];
                        }
                    }

                }, 100);
            }

            return timer;
        };

        this.guid = guid;

        this.add = function(obj) {

            var qItem;
            var _now = (new Date).getTime();

            if(!obj.handler) {
                qItem = {
                    created: _now, // creation time
                    handler: obj, // the request handler
                    keep: false, // keep forever (eg. for on('data') callbacks)
                    topic: null
                };
            }
            else {
                qItem = obj;
                qItem.created = qItem.created || _now;
                qItem.keep = (typeof qItem.keep !== 'undefined') ? qItem.keep : false;
                qItem.topic = qItem.topic || null;
            }

            var uuid = qItem.uuid || this.guid();
            queue[uuid] = qItem;

            queueSize++;
            clearQueue();

            d("[queue manager] Enqueued " + uuid);
            return uuid;
        };

        this.get = function(uuid) {
            clearQueue();
            return queue[uuid] ? queue[uuid].handler : null;
        };

        this.remove = function(uuid) {
            if(queue[uuid] && !queue[uuid].keep) {
                delete queue[uuid];
                if(queueSize > 0) queueSize--;
            }
            clearQueue();
        };

        this.clear = function() {
            for(var i in queue) delete queue[i];
            queueSize = 0;
            clearInterval(timer);
            timer = null;
        };

        this.isErrorResponse = function(body) {
            return (body && body.status >= 400);
        };

        this.triggerAll = function() {
            for(var i in queue) {
                var emitter = queue[i].emitter;
                var a = [];
                for(var i in arguments) a[i] = arguments[i];
                a.push(queue[i]);
                emitter.trigger.apply(emitter, a);
            }
        };

        /**
         * Normalize the returned body
         *
         * @deprecated Ensure to fix this code once the bridge is stable
         * */
        this.normalizeBody = function(message) {

            if(typeof message.body === 'string') {
                message.body = JSON.parse(message.body);
            }

            if(message.body && message.body.messageId !== undefined) {
                message.messageId = message.body.messageId;
                delete message.body.messageId;
            }

            if(message.meta && message.meta.messageId !== undefined) {
                message.messageId = message.meta.messageId;
            }

            if(message.body.meta && message.body.meta.messageId !== undefined) {
                message.messageId = message.body.meta.messageId;
                message.body = message.body.body;
            }

            if(message.headers && message.headers.messageId !== undefined) {
                message.messageId = message.headers.messageId;
            }

        };

        // performance hack, this will be not optimized
        var parseJson = function(c) {
            try {
                return JSON.parse(c);
            }
            catch (e) {
                console.error("Error reading JSON response", e);
            }

            return null;
        };


        this.handleResponse = function(message, raw) {

            var response;
            if(typeof message === 'object') {
                response = message;
            }
            else if(typeof message === 'string') {
                response = parseJson(message);
            }

            // uhu?!
            if(!response) {
                d("[queue manager] Message is empty.. skipping");
                d(response);
                return;
            }

            this.normalizeBody(response);

            var errorResponse = this.isErrorResponse(response.body);
            if(response.messageId) {

                var handler = this.get(response.messageId);

                if(handler) {

                    if(errorResponse) {
                        handler.emitter.trigger('error', response.body);
                    }
                    else {
                        //a callback is provided to handle the dispatch the event
                        if(handler.onQueueData && typeof handler.onQueueData === 'function') {
                            handler.onQueueData.call(handler, response, message);
                        }
                        else {
                            handler.emitter.trigger(handler.emitterChannel || 'success', response.body);
                        }
                    }

                    d("[queue manager] Message found, id " + response.messageId);
                    this.remove(response.messageId);
                    delete response.messageId;

                    return true;
                }

            }

            d("[queue manager] Message not found, id " + ((response.messageId) ? response.messageId : '[not set]'));
//                this.triggerAll('data', response, message);
            this.receiver() && this.receiver().notify('data', response, message);

            return false;
        };

        this.registerSubscription = function(topic, handler) {

            var uuid = handler.uuid || topic;
            this.add({
                handler: handler,
                keep: true,
                uuid: uuid,
            });

            return uuid;
        };

    };

    var RequestHandler = function() {
        this.emitter = null;
    };

    /**
     * Set the Client container instance
     *
     * */
    RequestHandler.prototype.container = function(_c) {
        if(_c) {
            this.__$container = _c;
            this.emitter = _c.ServiceObject.emitter();
        }
        return this.__$container;
    };

    RequestHandler.prototype.setConf = function(conf) {
        for(var i in conf) {
            this[i] = conf[i];
        }
    };

    RequestHandler.prototype.parseError = function(error) {

        var errorObject = function(message, data, code) {

            if(code && !message) {
                message = httpErrors[code];
            }

            return {
                message: message || "Unknown error",
                code: code || null,
                data: data || {}
            };
        };

        if(error && error.message) {
            error = errorObject(error.message, error.data, error.code);
        }
        else {
            if(typeof error === 'string') {
                try {
                    var json = JSON.parse(error);
                    error = errorObject(json.message, json.info, json.status);
                }
                catch(jsonError) {
                    error = errorObject("An error occured", error);
                }
            }
        }

        return error;
    };

    RequestHandler.prototype.parseSuccess = function(body) {

        var data = body;

        if(!data) {
            return null;
        }

        if(typeof body === 'string') {
            try {
                var data = JSON.parse(body);
            }
            catch (e) {
                console.error("Error parsing JSON", e);
                data = null;
            }
        }
        return data;
    };


    var dataReceiver = new DataReceiver();

    var queueManager = new QueueManager();
    queueManager.receiver(dataReceiver);

    /**
     * The base library client interface
     *
     * @constructor
     * @argument {ServiceObject} so The ServiceObject instance to bind the client
     */
    var Client = function(so) {

        var adapter;
        this.adapter = function() {
            if(!adapter) {
                adapter = compose.util.loadAdapter();
            }
            return adapter;
        };

        this.ServiceObject = so;
        this.queue = queueManager;

        this.requestHandler = new RequestHandler();
        this.requestHandler.container(this);

        this.initialize();
    };

    Client.prototype.initialize = function() {
        this.adapter().initialize && this.adapter().initialize.call(this, compose);
    };

    Client.prototype.connect = function() {
        var me = this;
        return new compose.lib.Promise(function(success, failure) {
            me.adapter().connect(me.requestHandler, success, failure);
        });
    };

    Client.prototype.disconnect = function() {
        if(this.adapter().disconnect){
            return this.adapter().disconnect(this.requestHandler);
        }
        return false;
    };

    Client.prototype.request = function(method, path, body, success, error) {

        var me = this;
        me.requestHandler.setConf({
            method: method,
            path: path,
            body: body
        });

        d("[client] Requesting " + this.requestHandler.method + " " + this.requestHandler.path);

        success && me.requestHandler.emitter.once('success', success);
        error && me.requestHandler.emitter.once('error', error);

        this.connect()
            .then(function() {
                me.adapter().request(me.requestHandler);
            })
            .catch(function(err) {
                d("Connection error");
                d(err);
                throw new compose.error.ComposeError(err);
            });
    };

    Client.prototype.subscribe = function(conf) {

        var me = this;
        me.requestHandler.setConf(conf);

        d("[client] Add listener to topic");

        this.connect()
            .then(function() {
                me.adapter().subscribe && me.adapter().subscribe(me.requestHandler);
            })
            .catch(function(err) {
                d("Connection error");
                d(err);
                throw new compose.error.ComposeError(err);
            });
    };

    Client.prototype.unsubscribe = function(conf) {
        var me = this;
        me.adapter().unsubscribe && me.adapter().unsubscribe();
        return me;
    };

    Client.prototype.post = function(path, data, success, error) {
        return this.request('post', path, data, success, error);
    };

    Client.prototype.get = function(path, data, success, error) {
        return this.request('get', path, data, success, error);
    };

    Client.prototype.put = function(path, data, success, error) {
        return this.request('put', path, data, success, error);
    };

    Client.prototype.delete = function(path, data, success, error) {
        return this.request('delete', path, data, success, error);
    };

    compose.util.queue = queueManager;
    compose.util.receiver = dataReceiver;

    client.Client = Client;
    client.RequestHandler = RequestHandler;
    client.Emitter = Emitter;
    client.QueueManager = QueueManager;

};


return module && module.exports && Object.keys(module.exports).length
        ? module.exports : exports;
})()
,
'./WebObject': (function() {
var exports = {}; var module = { exports: exports };

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
var wolib = module.exports;
wolib.setup = function(compose) {

    var ComposeError = compose.error.ComposeError;
    var copyVal = compose.util.copyVal;

    if(!compose) {
        throw new ComposeError("compose.io module reference not provided, quitting..");
    }

    /**
     *
     * A list of Channel of a Stream
     *
     * @constructor
     * @augments ObjectList
     */
    var ChannelsList = function(channels) {
        compose.util.List.ObjectList.apply(this);
        this.initialize(channels);
    };
    compose.util.extend(ChannelsList, compose.util.List.ObjectList);

    ChannelsList.prototype.validate = function(channel) {

//            if(!channel.name) {
//                throw new ValidationError("Channel must have a `name` property");
//            }
//
//            if(!channel.type) {
//                throw new ValidationError("Channel must have a `type` property");
//            }
//
//            if(!channel.unit) {
//                throw new ValidationError("Channel must have a `unit` property");
//            }
//
//            if(channel.type !== 'Number' || channel.type !== 'String' || channel.type !== 'Boolean' ) {
//                throw new ValidationError("Channel `type` must be one of Number, String or Boolean");
//            }

        return channel;
    };


    /**
     *
     * A list of Stream objects of a WebObject
     *
     * @constructor
     * @augments ObjectList
     */
    var StreamList = function(streams) {

        compose.util.List.ObjectList.apply(this);

        if(this instanceof StreamList) {
            this.initialize(streams);
        }

    };
    compose.util.extend(StreamList, compose.util.List.ObjectList);

    StreamList.prototype.add = function(name, obj) {

        if (typeof name === "object") {
            for (var i in name) {
                this.add(i, name[i]);
            }
            return this;
        }

        // handle arrays using the obj.name property
        if(obj.name && (typeof (parseFloat(name)) === 'number')) {
            name = obj.name;
        }

        if(!obj.name) {
            obj.name = name;
        }

        var stream = this.validate(obj);
        this.getList()[name] = stream;

        return stream;
    };

    /**
     * @param {String} name Identifier name
     * @return {Number} Return the index or -1 if not found
     */
    StreamList.prototype.getIndex = function(name, key) {

        var list = this.getList();

        if(list[name]) {
            return name;
        }

        key = key || 'name';
        var _size = this.size();
        for (var i = 0; i < _size; i++) {
            if (list[i][key] === name) {
                return i;
            }
        }

        return -1;
    };

    StreamList.prototype.validate = function(stream) {

        var streamObj = new Stream(stream);
        streamObj.container(this.container());

        return streamObj;
    };

    /*
     *
     * @param {boolean} asString Return as string if true, object otherwise
     * @returns {Object|String}
     */
    StreamList.prototype.toJson = function(asString) {

        var list = this.getList();
        var json = copyVal(list);

        return asString ? JSON.stringify(json) : json;
    };

    StreamList.prototype.toString = function() {
        return this.toJson(true);
    };

    /**
     *
     * A Stream object
     *
     * @constructor
     */
    var Stream = function(obj) {
        if(this instanceof Stream) {
            this.initialize(obj);
        }
    };

    Stream.prototype.__$container;

    Stream.prototype.container = function(o) {
        this.__$container = o || this.__$container;
        return this.__$container;
    };

    /**
     * Add a list of elements provided as argument to the stream
     * @param {Object} obj An object with the properties to set for the Stream
     */
    Stream.prototype.initialize = function(obj) {

        obj = obj || {};

        for (var i in obj) {
            if (!this[i]) {
                this[i] = obj[i];
            }
        }

        this.channels = new ChannelsList(obj.channels || {});
        this.channels.container(this.container());
    };

    /**
     * Add or updates a channel. This function handles multiple arguments, eg.
     *
     * - addChannel(name, channel)
     * - addChannel(name, unit, type, value)
     *
     * @param {String} name Name of the channel
     * @param {String|Object} channel|unit Channel object (or unit value, when arguments count is >= 3)
     * @param {String} type Type of value
     *
     * @return {Stream} The current stream
     * */
    Stream.prototype.addChannel = function(name, channel, a3, a4) {

        if (arguments.length >= 3) {
            name = arguments[0];
            channel = {
                "unit": arguments[1],
                "type": arguments[2]
            };
        }

        this.channels.add(name, channel);

        return this;
    };

    /**
     * Add or updates a list of channels
     *
     * @param {Object} channels List of channels
     *
     * @return {Stream} The current stream
     * */
    Stream.prototype.addChannels = function(channels) {
        this.channels.add(channels);
        return this;
    };

    /**
     * @return {ChannelsList} The list of channels
     */
    Stream.prototype.channels = Stream.prototype.getChannels = function() {
        return this.channels;
    };

    /**
     * @param {String} name The channel name
     * @return {Object} The requested channel or null if not available
     */
    Stream.prototype.channel = Stream.prototype.getChannel = function(name) {

        var c = this.channels.get(name);
        if(c) {
            return c;
        }

        throw new ComposeError("Channel not found");
    };

    /*
     *
     * @param {boolean} asString Return as string if true, object otherwise
     * @returns {Object|String}
     */
    Stream.prototype.toJson = function(asString) {

        var json = {};

        copyVal(this, json);
        json.channels = this.channels.toJson();

        return asString ? JSON.stringify(json) : json;
    };

    Stream.prototype.toString = function() {
        return this.toJson(true);
    };

    /**
     * Creates a WebObject instance
     */
    var WebObject = function(objdef) {

        var me = this;

        this.properties = [];
        this.customFields = {};

        if(this instanceof WebObject) {
            this.initialize(objdef);
        }
    };

    WebObject.prototype.__$streams = null;
    WebObject.prototype.__$actions = null;

    /**
     * Take an object and set the fields defining the WO accordingly
     * This method will overwrite any previous information
     *
     * Minimum information required are
     * `{ properties: { name: "<wo name>", id: "<wo id>" } }`
     *
     * @param {Object} obj An object with the definition of the WO.
     * @return {WebObject} A webobject instace
     */
    WebObject.prototype.initialize = function(obj) {

        obj = obj || {};

        if(typeof obj === 'string') {
            try {
                obj = JSON.parse(obj);
            }
            catch(e) {
                throw new ComposeError("Object definition cannot be parsed");
            }
        }

        for (var i in obj) {
            if (typeof obj[i] !== 'function') {
                this[i] = obj[i];
            }
        }

        this.customFields = obj.customFields || {};
        this.properties = obj.properties || [];

        this.setStreams(copyVal(obj.streams || {}));
        this.setActions(copyVal(obj.actions || {}));

        return this;
    };

    WebObject.prototype.getStreams = WebObject.prototype.streams = function() {
        return this.__$streams;
    };

    /**
     *
     */
    WebObject.prototype.setStreams = function(streams) {
        var _streams = new StreamList(streams);
        _streams.container(this);
        this.__$streams = _streams;
    };

    /**
     *
     * @param {String} name The stream name
     * @return {Object} The Streamobject
     */
    WebObject.prototype.stream = WebObject.prototype.getStream = function(name) {

        var s = this.getStreams().get(name);
        if(s) {
            return s;
        }

        throw new ComposeError("Stream not found");
    };


    WebObject.prototype.actions = WebObject.prototype.getActions = function() {
        return this.__$actions;
    };

    /**
     *
     * @param {Object} actions
     * @returns {WebObject} self reference
     */
    WebObject.prototype.setActions = function(actions) {
        this.__$actions = new compose.util.List.ArrayList(actions);
        this.__$actions.container(this);
        return this;
    };

    /**
     * @param {String} name The action name
     * @return {Object} The Action object
     */
    WebObject.prototype.action = WebObject.prototype.getAction = function(name) {

        var a = this.getActions().get(name, 'name');
        if(a) {
            return a;
        }

        throw new ComposeError("Action not found");

    };

    /**
     * @param {Object} key The object name
     * @param {Object} stream The object with stream data
     *
     * @return {Object} The Stream object
     */
    WebObject.prototype.addStream = function(key, stream) {
        return this.getStreams().add(key, stream);
    };

    /**
     * @param {Array} streams List of objects to add
     * @return {WebObject} The WO object
     */
    WebObject.prototype.addStreams = function(streams) {
        if (typeof streams === "object") {
            for (var i in streams) {
                this.addStream((typeof parseFloat(i) === 'number') ? streams[i].name : i, streams[i]);
            }
        }
        return this;
    };

    /**
     * @param {Object} action The object to add
     * @return {Object} The Action object
     */
    WebObject.prototype.addAction = function(action) {
        return this.getActions().add(action);
    };

    /**
     * @param {Array} actions List of objects to add
     * @return {WebObject} The WO object
     */
    WebObject.prototype.addActions = function(actions) {
        if (actions instanceof Array) {
            for (var i = 0; i < actions.length; i++) {
                this.getActions().add(actions[i]);
            }
        }
        return this;
    };

    /*
     *
     * @param {boolean} asString Return as string if true, object otherwise
     * @returns {Object|String}
     */
    WebObject.prototype.toJson = function(asString) {
        var json = {};

        for (var i in this) {
            if (typeof this[i] !== 'function' && i.substr(0, 3) !== '__$') {
                if(this[i] !== null) {
                    json[i] = this[i];
                }
            }
        }

        var streams = this.getStreams();
        json.streams = streams ? streams.toJson() : {};

        var actions = this.getActions();
        json.actions = actions ? actions.toJson() : [];

        return asString ? JSON.stringify(json, null) : json;
    };

    WebObject.prototype.toString = function() {
        return this.toJson(true);
    };

    /**
     * StreamList class
     */
    wolib.StreamList = StreamList;

    /**
     * Stream class
     */
    wolib.Stream = Stream;

    /**
     * WebObject class
     */
    wolib.WebObject = WebObject;

    /**
     * Creates a new instance of a WebObject
     *
     * @param {Object} wo An object with WebObject properties
     */
    wolib.create = function(wo) {
        return new WebObject(wo || {});
    };

//    // read a json file by name @todo need to be ported and adapted
//    wolib.read = function(name) {
//        var platform = getPlatformImpl();
//        var content = platform.readFile(name, { definitionsPath: getDefinitionPath() });
//        return content ? JSON.parse(content) : {};
//    };

};


return module && module.exports && Object.keys(module.exports).length
        ? module.exports : exports;
})()
,
'./ServiceObject': (function() {
var exports = {}; var module = { exports: exports };

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
var d = function(m) { DEBUG === true || DEBUG > 10 && console.log(m); };

var solib = module.exports;
solib.setup = function(compose) {

    var Promise = compose.lib.Promise;
    var ComposeError = compose.error.ComposeError;
    var ValidationError = compose.error.ValidationError;
    var Emitter = compose.lib.Client.Emitter;

    var getApi = function() {
        return compose;
    };

    /**
     *
     * @constructor
     * */
    var Subscription = function() {
        if(this instanceof Subscription) {
            var args = arguments[0] && typeof arguments[0] === 'object' ? arguments[0] : {};
            this.initialize(args);
        }
    };

    Subscription.prototype.__$container;

    Subscription.prototype.getApi = getApi;

    Subscription.prototype.container = function(o) {
        this.__$container = o || this.__$container;
        return this.__$container;
    };

    Subscription.prototype.initialize = function(object) {
        for(var i in object) {
            this[i] = object[i];
        }
    };

    /*
     *
     * @param {boolean} asString Return as string if true, object otherwise
     * @returns {Object|String}
     */
    Subscription.prototype.toJson = function(asString) {
        var json = compose.util.copyVal(this);
        return asString ? JSON.stringify(json) : json;
    };

    Subscription.prototype.toString = function() {
        return this.toJson(true);
    };

    /**
     * Create a ServiceObject subscription
     *
     * @return {Promise} Promise callback with result
     */
    Subscription.prototype.create = function() {

        var me = this;
        var so = me.container().container();

        return new Promise(function(resolve, reject) {

            var url = '/'+so.id+'/streams/'+ me.container().name
                            +'/subscriptions'; //+ (me.id ? '/'+me.id : '');

            so.getClient().post(url, me.toJson(), function(data) {

                me.id = data.id;
                me.created = data.id;

                resolve && resolve(me, me.container());

            }, reject);
        }).bind(so);
    };

    /**
     * Update a ServiceObject subscription
     *
     * @return {Promise} Promise callback with result
     */
    Subscription.prototype.update = function() {
        var me = this;
        var so = me.container().container();
        return new Promise(function(resolve, reject) {

            if(!me.id) {
                throw new ComposeError("Subscription must have an id");
            }

            var url = '/subscriptions/'+ me.id;
            so.getClient().put(url, me.toJson(), function(data) {
                resolve(data);
            }, reject);
        }).bind(so);
    };

    /**
     * Delete a ServiceObject subscription
     *
     * @return {Promise} Promise callback with result
     */
    Subscription.prototype.delete = function() {
        var me = this;
        var so = me.container().container();
        return new Promise(function(resolve, reject) {

            if(!me.id) {
                throw new ComposeError("Subscription must have an id");
            }

            var url = '/subscriptions/'+ me.id;

            so.getClient().delete(url, null, function() {

                var stream = me.container();
                stream.getSubscriptions().remove(me);

                resolve();
            }, reject);
        }).bind(so);
    };

    /**
     *
     * List of Subscriptions
     *
     * @constructor
     * @augments WebObject.StreamList
     */
    var SubscriptionList = function() {
        compose.util.List.ArrayList.apply(this, arguments);
    };
    compose.util.extend(SubscriptionList, compose.util.List.ArrayList);

    SubscriptionList.prototype.getApi = getApi;

    SubscriptionList.prototype.validate = function(obj) {
        var sub = new Subscription(obj);
        sub.container(this.container());
        return sub;
    };

    /**
     * Load all the ServiceObject subscriptions
     *
     * @return {Promise} Promise callback with result
     */
    SubscriptionList.prototype.refresh = function() {
        var me = this;
        var so = me.container().container();
        return new Promise(function(resolve, reject) {
            var url = '/'+so.id+'/streams/'+ me.container().name +'/subscriptions/';
            so.getClient().get(url, null, function(data) {
                me.initialize(data.subscriptions);
                resolve(me, me.container());
            }, reject);
        }).bind(me.container());
    };

    /**
     * @constructor
     * */
    var Actuation = function() {
        if(this instanceof Actuation) {
            var args = arguments[0] ? arguments[0] : {};
            this.initialize(args);
        }
    };

    Actuation.prototype.__$container;

    Actuation.prototype.getApi = getApi;

    /**
     *
     * @param {Stream} Optional, a Stream object
     * @returns {Stream} The parent object
     */
    Actuation.prototype.container = function(o) {
        this.__$container = o || this.__$container;
        return this.__$container;
    };

    /**
     * Set the values of the object passed as argument
     *
     * @param {Object} object A plain object with actuations properties
     */
    Actuation.prototype.initialize = function(object) {
        for(var i in object) {
            this[i] = object[i];
        }
    };

    /*
     *
     * @param {boolean} asString Return as string if true, object otherwise
     * @returns {Object|String}
     */
    Actuation.prototype.toJson = function(asString) {
        var json = compose.util.copyVal(this);
        return asString ? JSON.stringify(json) : json;
    };

    Actuation.prototype.toString = function() {
        return this.toJson(true);
    };


    /**
     * Invoke the ServiceObject action
     * @param {String} body The body of the request as STRING
     * @return {Promise} Promise callback with result
     */
    Actuation.prototype.invoke = function(body) {
        var me = this;
        return new Promise(function(resolve, reject) {

            var url = '/'+ me.container().id +'/actuations/'+ me.name;
            me.container().getClient().post(url, body.toString(), function(data) {

                me.id = data.id;
                me.createdAt = data.createdAt;

                resolve(me);
            }, reject);
        });
    };

    /**
     * Reset the status of an actuation
     * */
    Actuation.prototype.reset = function() {
        this.id = null;
        this.createdAt = null;
    };

    /**
     * Get the status of an actuation
     *
     * @return {Promise} Promise callback with result
     */
    Actuation.prototype.status = function() {
        var me = this;
        return new Promise(function(resolve, reject) {

            if(!me.id) {
                throw new ComposeError("Actuation must have an id, use invoke or refresh the list before continue");
            }

            var url = '/actuations/'+ me.id;
            me.getClient().get(url, null, function(data) {
                if(data.status === 'completed') {
                    me.reset();
                }
                resolve(data.status, data);
            }, reject);
        });
    };

    /**
     * Cancel a launched actuation
     *
     * @return {Promise} Promise callback with result
     */
    Actuation.prototype.cancel = function() {
        var me = this;
        return new Promise(function(resolve, reject) {

            if(!me.id) {
                throw new ComposeError("Actuation must have an id, have you invoked it first?");
            }

            var url = '/actuations/'+ me.id;
            me.getClient().delete(url, null, function(data) {
                if(data.status === 'cancelled') {
                    me.reset();
                }
                resolve(data.status, data);
            }, reject);
        });
    };

    /**
     *
     * List of Actuations
     *
     * @constructor
     * @augments compose.util.List.ArrayList
     */
    var ActuationList = function(obj) {
        compose.util.List.ArrayList.apply(this, arguments);
        this.initialize(obj);
    };
    compose.util.extend(ActuationList, compose.util.List.ArrayList);

    ActuationList.prototype.validate = function(obj) {

        var action = new Actuation(obj);
        action.container(this.container());

        return action;
    };

    /*
     *
     * @param {boolean} asString Return as string if true, object otherwise
     * @returns {Object|String}
     */
    ActuationList.prototype.toJson = function(asString) {
        var json = compose.util.copyVal(this.getList());
        return asString ? JSON.stringify(json) : json;
    };

    ActuationList.prototype.toString = function() {
        return this.toJson(true);
    };

    ActuationList.prototype.getApi = getApi;

    /**
     * Load all the ServiceObject actuations
     *
     * @return {Promise} Promise callback with result
     */
    ActuationList.prototype.refresh = function() {
        var me = this;
        return new Promise(function(resolve, reject) {

            var url = '/'+ me.container().id +'/actuations';
            me.container().getClient().get(url, null, function(data) {

                me.container().setActions(data.actions);
                resolve(data.actions);

            }, reject);

        }).bind(me.container());
    };

    /**
     * Listen for actuation request
     *
     * @return {Promise} A promise for the subscription object creation
     */
    ActuationList.prototype.listen = function(fn) {

        var me = this;

        return new Promise(function(success, failure) {

            try {

                me.container().getClient().subscribe({
                    uuid: me.container().id + '.actions',
                    topic: 'actions',
                    actions: me,
                    onQueueData: function(message) {

                        var rawdata = message.body;

                        var id = rawdata && rawdata.description && rawdata.description.name ? rawdata.description.name : null;
                        var params = rawdata && rawdata.parameters ? rawdata.parameters : null;

                        me.container().emitter().trigger('actions', id, params, rawdata);
                    }
                });

            }
            catch(e) {
                return failure(e);
            }

            if(fn && typeof fn === 'function') {
                me.container().on('actions', fn);
            }

            success();
        });

    };


    /**
     *
     * @param {Array} data A list of values
     * @returns {DataBag} An object containing the data
     */
    var DataBag = function(data) {
        this.__$list = (data && data.length) ? data : [];
        this.__$container = null;
    };
    compose.util.extend(DataBag, compose.util.List.Enumerable);

    DataBag.prototype.getApi = getApi;

    /**
     * @return {Stream} A reference to the source stream
     * */
    DataBag.prototype.container = function($__c) {
        if($__c) this.__$container = $__c;
        return this.__$container;
    };

    /**
     * Return an object at a specific index
     * */
    DataBag.prototype.at = function(i) {
        return this.get(i);
    };

    /**
     * Return an object in the list. If index is not provided, the current cursor position will be used
     *
     * @param {Number} index Optional, index in the list
     * @param {String} channel The channel name
     * @param {mixed} defaultValue A default value if the requested channel is not available
     *
     * @returns {Object|mixed} A value set if index is provided, if channel is provided, its value
     */
    DataBag.prototype.get = function(index, channel, defaultValue) {

        if(arguments[0]*1 !== arguments[0]) {
            return this.get(this.index(), arguments[0], arguments[1]);
        }

        defaultValue = (typeof defaultValue === 'undefined') ? null : defaultValue;

        var list = this.getList();
        var data = list[index];
        if(data) {

            var channels = data.channels;

            if(!channels) return null;

            if(channel && typeof channels[channel] !== 'undefined') {
                return channels[channel]['current-value'];
            }

            // add a get function to retrieve a single value without the full json path
            data.get = function(_channel, _defaultValue) {

                _defaultValue = (typeof _defaultValue === 'undefined') ? null : _defaultValue;

                if(_channel && data.channels[_channel] && typeof data.channels[_channel] !== 'undefined') {
                    return data.channels[_channel]['current-value'];
                }

                return _defaultValue;
            };

            // returns a simple js object with key-value pairs of data
            data.asObject = function() {

                var res = {};
                for(var i in data.channels) {
                    (function(_i) {
                        res[_i] =  data.channels[_i]['current-value'];
                    })(i);
                }

                return res;
            };

            return data;
        }

        return null;
    };

    /**
     *
     * A Stream object
     *
     * @constructor
     * @param {Object} obj An object with the Stream properties
     * @augments WebObject.Stream
     */
    var Stream = function(obj) {
        compose.lib.WebObject.Stream.apply(this, arguments);
        this.initialize(obj);
    };

    compose.util.extend(Stream, compose.lib.WebObject.Stream);

    Stream.prototype.__$subscriptions;
    Stream.prototype.__$pubsub = null;

    Stream.prototype.getApi = getApi;

    Stream.prototype.initialize = function(obj) {

        obj = obj || {};

        this.__$parent.initialize.call(this, obj);

        var subscriptions = new SubscriptionList(obj.subscriptions || {});
        subscriptions.container(this);
        this.__$subscriptions = subscriptions;

        this.__$emitter = new Emitter;

        return this;
    };

    Stream.prototype.emitter = function() {
        return this.__$emitter;
    };

    Stream.prototype.getSubscriptions = function() {
        return this.__$subscriptions;
    };

    Stream.prototype.setSubscriptions = function(list) {
        for(var i in list) {
            this.getSubscriptions().add(list[i]);
        }
        return this;
    };

    /**
     * Get a subscriptions by id
     *
     * @param {mixed} value The id value
     * @param {mixed} key The key of the subscription object to match with `value`
     *
     * @return {Subscription} A subscription if found
     */
    Stream.prototype.getSubscription = function(value, key) {
        key = key || 'id';
        return this.getSubscriptions().get(value, key);
    };

    /**
     * Add a subscriptions
     *
     * @param {mixed} object An object with the Subscription properties
     *
     * @return {Subscription} A subscription object
     */
    Stream.prototype.addSubscription = function(object) {
        object = object || {};
        return this.getSubscriptions().add(object);
    };

    /**
     * Create a pubsub subscription for the stream
     *
     * @return {Promise} A promise for the subscription object creation
     */
    Stream.prototype.subscribe = function(fn) {

        var me = this;
        var defaultCallback = 'pubsub';

        if(!me.__$pubsub) {
            me.__$pubsub = {
                callback: defaultCallback,
                destination: compose.config.apiKey.replace('Bearer ', '')
            };
        }

        var listener = function(subscription) {
            return new Promise(function(success, failure) {

                try {

                    me.container().getClient().subscribe({
                        uuid: me.container().id + '.stream.' + me.name,
                        topic: 'stream',
                        stream: me,
                        subscription: subscription
//                        emitter: me.emitter(),
//                        emitterChannel: 'data'
                        ,onQueueData: function(rawdata) {

                            var data = rawdata.body;
                            var dataset = new compose.util.DataBag([ data ]);
                            dataset.container(me);

                            me.emitter().trigger('data', dataset.get(0));
                        }
                    });

                }
                catch(e) {
                    return failure(e);
                }

                if(fn && typeof fn === 'function') {
                    me.on('data', fn);
                }

                success(subscription);
            });
        };

        return me.getSubscriptions().refresh().then(function() {

            var subscription = me.getSubscriptions().get(defaultCallback, "callback");
            if(!subscription) {

                subscription = me.addSubscription(me.__$pubsub);

                return subscription.create().then(listener);
            }
            else {
                return listener(subscription);
            }
        });

    };

    /**
     * Remove all subscriptions for a stream
     *
     * @param {Function} fn Callback to be called when data is received
     * @return {Stream} The current stream
     */
    Stream.prototype.unsubscribe = function() {

        var me = this;

        return me.getSubscriptions().refresh().then(function() {

            var list = me.getSubscriptions().getList();

            var _clean = function() {
                me.off('data');
                me.__$pubsub = null;
                return Promise.resolve();
            };

            if(!list.length) {
                return _clean();
            }

            return Promise.all(list)
                    .each(function(sub) {
                        return sub.delete().catch(function(e) {
                            return Promise.resolve();
                        });
                    })
                    .then(_clean);

        });
    };

    Stream.prototype.on = function(event, callback) {
        if(event === 'data') {
            compose.util.receiver.bind(this, this.container().id + '.stream.' + this.name);
        }
        this.emitter().on(event, callback);
        return this;
    };

    Stream.prototype.off = function(event, callback) {
        if(event === 'data') {
            compose.util.receiver.unbind(this, this.container().id + '.stream.' + this.name);
        }
        this.emitter().off(event, callback);
    };


    /**
     * Prepare a list of data values formatted to be sent to the backend
     *
     * @see Stream.push
     *
     * @param {Object} values A list of channels name and their values
     * @param {Number|Date|String} lastUpdate A value rapresenting the lastUpdate for the data values
     *
     * @return {Stream} The current stream
     */
    Stream.prototype.prepareData = function(values, lastUpdate) {

        var me = this;

        // default value
        if(typeof lastUpdate === 'undefined') {
            lastUpdate = new Date();
        }

        if(typeof lastUpdate === 'string' || typeof lastUpdate === 'number') {
            lastUpdate = new Date(lastUpdate);
        }

        if(lastUpdate instanceof Date) {
            lastUpdate = lastUpdate.getTime();
        }

        if(!lastUpdate) {
            throw new compose.error.ValidationError("prepareData expect");
        }

        // convert from milliseconds to seconds
        if(lastUpdate.toString().length === 13) {
            lastUpdate = Math.floor(lastUpdate / 1000);
        }

        var data = {
            channels: {},
            lastUpdate: lastUpdate
        };

        if(typeof values === "object") {
            for(var name in values) {
                var channel = this.getChannel(name);
                if (channel) {
                    data.channels[ name ] = data.channels[ name ] || {};
                    data.channels[ name ]['current-value'] = values[name];
                }
                else {
                    if(console && console.log)
                        console.log("Channel " + name + " is not available in stream " + me.name);
                }
            }
        }
        else {
            var type = typeof values;
            throw new compose.error.ValidationError("prepareData expect an `object` as first parameter but `" + type + "` has been provided");
        }

        return data;
    };

    /**
     * Send data to a ServiceObject stream
     *
     * @return {Promise} Promise callback with result
     */
    Stream.prototype.push = function(data, lastUpdate) {
        var me = this;
        return new Promise(function(resolve, reject) {

            if(!me.container().id) {
                throw new ComposeError("Missing ServiceObject id.");
            }

            if(!data) {
                throw new ComposeError("Data for push has to be provided as first argument");
            }

            var values = me.prepareData(data, lastUpdate);
            var url = '/' + me.container().id + '/streams/' + me.name;
            me.container().getClient().put(url, values, resolve, reject);
        });
    };


    /**
     * Retieve data from a ServiceObject stream
     *
     * @param {String} timeModifier  text, optional Possible values: lastUpdate, 1199192940 (time ago as timestamp)
     * @return {Promise} Promise callback with result
     */
    Stream.prototype.pull = function(timeModifier) {

        var me = this;
        timeModifier = timeModifier ? timeModifier : "";

        return new Promise(function(resolve, reject) {

            if(!me.container().id) {
                throw new ComposeError("Missing ServiceObject id.");
            }

            var url = '/' + me.container().id + '/streams/' + me.name + '/' + timeModifier;
            me.container().getClient().get(url, null, function(res) {

                var data = [];
                if(res && res.data) {
                    data = res.data;
                }

                var dataset = new DataBag(data);
                dataset.container(me);

                resolve && resolve(dataset, data);

            }, reject);
        });
    };

    /**
     * Search data of a ServiceObject stream
     *
     * @param {Object} options
     * @return {Promise} Promise callback with result
     */
    Stream.prototype.search = function(options) {

        var me = this;

        return new Promise(function(resolve, reject) {

            if(!me.container().id) {
                throw new ComposeError("Missing ServiceObject id.");
            }

            if(!options) {
                throw new ComposeError("No params provided for search");
            }

            var getFieldName = function(opts) {

                var hasField = (typeof opts.field !== 'undefined' && opts.field),
                    hasChannel = (typeof opts.channel !== 'undefined'
                                    && opts.channel && me.getChannel(opts.channel));

                if(!hasChannel && !hasField) {
                    throw new ComposeError("At least a valid `channel` or `field` properties has to be provided for numeric search");
                }

                if(hasField) {
                    return opts.field;
                }
                else if(hasChannel) {
                    return "channels." + opts.channel + ".current-value";
                }
            };

            var hasProp = function(data, name) {
                return 'undefined' !== data[name];
            };

            var params = {};

            /**
            {
                "numericrange": true,
                "rangefrom": 13,
                "rangeto": 17,
                "numericrangefield": "channels.age.current-value",
            }

            {
                numeric: {
                    channel: 'name'
                    from: 1
                    to: 10
                }
            }

            */
            var queryParams = options.numeric;
            if(queryParams) {

                params.numericrange = true;
                params.numericrangefield = getFieldName(queryParams);

                var hasFrom = hasProp(queryParams, "from"),
                    hasTo = hasProp(queryParams, "to");

                if(!hasFrom && !hasTo) {
                    throw new ComposeError("At least one of `from` or `to` properties has to be provided for numeric range search");
                }

                if(hasFrom) {
                    params.rangefrom = queryParams.from;
                }

                if(hasTo) {
                    params.rangeto = queryParams.to;
                }

            }

            /**
            {
                "timerange": true,
                "rangefrom": 1396859660,
            }

            {
                time: {
                    from: time
                    to: time
                }
            }
            */
            var queryParams = options.time;
            if(queryParams) {

                params.timerange = true;

                var hasFrom = hasProp(queryParams, "from"),
                    hasTo = hasProp(queryParams, "to");

                if(!hasFrom && !hasTo) {
                    throw new ComposeError("At least one of `from` or `to` properties has to be provided for time range search");
                }

                // set defaults
                // if from is not set, set to epoch
                queryParams.from = queryParams.from || (new Date(0));
                // if to is not set, set to now
                queryParams.to = queryParams.to || (new Date());

                // a timestamp is expected but try parsing other values too
                var getTimeVal = function(val, label) {

                    var type = typeof val;
                    var date;
                    var err = false;

                    if(type === 'number') {

                        var d = new Date(val);
                        if(d.getTime() !== val) {
                            d = new Date(val * 1000);
                            if(d.getTime() !== val) {
                                err = true;
                            }
                        }

                        if(!err) {
                            date = d;
                        }
                    }
                    else if(type === "string") {
                        var d = new Date(val);
                        if(!d) {
                            err = true;
                        }
                        else{
                            date = d;
                        }
                    }
                    else if(val instanceof Date) {
                        date = val;
                    }

                    if(err || !date) {
                        throw new ComposeError("The value " + val + " for `" + label
                                                    + "` cannot be parsed as a valid date");
                    }

                    return date.getTime();
                };

                if(hasFrom) {
                    params.rangefrom = getTimeVal(queryParams.from, 'timeRange.from');
                }

                if(hasTo) {
                    params.rangeto = getTimeVal(queryParams.to, 'timeRange.to');
                }

            }

            /**
            {
                "match": true,
                "matchfield": "channels.name.current-value",
                "matchstring": "Peter John",

                options.match : {
                    channel: '',
                    string: ''
                }

            }
            */
            var queryParams = options.match;
            if(queryParams) {

                params.match = true;
                params.matchfield = getFieldName(queryParams);

                var hasString = hasProp(queryParams, "string");

                if(!hasString) {
                    throw new ComposeError("A value for `string` property has to be provided for text based search");
                }

                params.string = queryParams.string;
            }


            var checkForLocationChannel = function() {
                if(!me.getChannel('location')) {
                    throw new ComposeError("To use geospatial based search a `location` channel is required");
                }
            };

            /**
            {
                "geoboundingbox": true,
                "geoboxupperleftlon": 15.43,
                "geoboxupperleftlat": 43.15,
                "geoboxbottomrightlat": 47.15,
                "geoboxbottomrightlon": 15.47

                bbox: {
                    coords: [
                        { latitude: '', longitude: ''}, // top position
                        { latitude: '', longitude: ''}  // bottom position
                    ]
                }

            }
            */
            var queryParams = options.bbox;
            if(queryParams) {

                checkForLocationChannel();

                params.geoboundingbox = true;

                var hasBbox = false;
                if(queryParams.coords) {
                    // [toplat, toplon, bottomlat, bottomlon]
                    if(queryParams.coords instanceof Array && queryParams.coords.length === 4) {
                        params.geoboxupperleftlat = queryParams.coords[0];
                        params.geoboxupperleftlon = queryParams.coords[1];
                        params.geoboxbottomrightlat = queryParams.coords[2];
                        params.geoboxbottomrightlon = queryParams.coords[3];
                        hasBbox = true;
                    }
                    //[{lat, lon}, {lat, lon}]
                    if(queryParams.coords instanceof Array && queryParams.coords.length === 2) {
                        params.geoboxupperleftlat = queryParams.coords[0].lat || queryParams.coords[0].latitude;
                        params.geoboxupperleftlon = queryParams.coords[0].lon || queryParams.coords[0].longitude;
                        params.geoboxbottomrightlat = queryParams.coords[1].lat || queryParams.coords[1].latitude;
                        params.geoboxbottomrightlon = queryParams.coords[1].lon || queryParams.coords[1].longitude;
                        hasBbox = true;
                    }
                }

                if(!hasBbox) {
                    throw new ComposeError("The values provided for `coords` option are not valid");
                }

            }
            else {

                if(options.bbox) {
                    (console && console.warn) && console.warn("`bbox` and `distance` search are not compatible, `bbox` will be used");
                }

                /*
                 {
                    "geodistance": true,
                    "geodistancevalue": 300,
                    "pointlat": 43.15,
                    "pointlon": 15.43,
                    "geodistanceunit": "km"
                }

                {
                    distance: {
                        position: {latitude: '', longitude: ''}
                        // or
                        // position: [lat, lon]
                        value: 'val',
                        unit: 'km'
                    }
                }


                */
                var queryParams = options.distance;
                if(queryParams) {

                    checkForLocationChannel();

                    params.geodistance = true;

                    if(queryParams.position) {
                        var position = queryParams.position;
                        var isArray = (position instanceof Array);
                        queryParams.lat =  isArray ? position[0] : (position.latitude || position.lat);
                        queryParams.lon = isArray ? position[1] : (position.longitude || position.lon);
                    }

                    var hasValue = hasProp(queryParams, "value"),
                        hasLat = hasProp(queryParams, "lat") || hasProp(queryParams, "latitude"),
                        hasLng = hasProp(queryParams, "lon") || hasProp(queryParams, "longitude")
                        ;

                    if(!hasLat || !hasLng || !hasValue) {
                        throw new ComposeError("`latitude`, `longitude` and `value` properties must be provided for distance search");
                    }

                    params.geodistanceunit = queryParams.unit || "km";
                    params.geodistancevalue = queryParams.value;
                    params.pointlat = queryParams.lat || queryParams.latitude;
                    params.pointlon = queryParams.lon || queryParams.longitude;

                }
            }

            var url = '/' + me.container().id + '/streams/' + me.name + '/search';
            me.container().getClient().post(url, params, function(res) {

                var data = [];
                if(res && res.data) {
                    data = res.data;
                }

                var dataset = new DataBag(data);
                dataset.container(me);

                resolve && resolve(dataset, data);

            }, reject);
        });
    };

    /**
     * Search data of a ServiceObject by distance from a point
     *
     * @param {Object} position An object representing a geo-position, eg `{ latitude: 123 , longitude: 321 }`
     * @param {Number} distance The distance value
     * @param {String} unit Optional unit, default to `km`
     *
     * @return {Promise} Promise callback with result
     */
    Stream.prototype.searchByDistance = function(position, distance, unit) {
        return this.search({
            distance: {
                position: position,
                value: distance,
                unit: unit
            }
        });
    };

    /**
     * Search data of a ServiceObject in a Bounding Box
     *
     * @param {Array} bbox An array of 4 elements representing the bounding box, eg
     *                      ```
     *                      [
     *                          upperLat, upperLng,
     *                          bottomLat, bottomLng
     *                      ]
     *                      ```
     *                or an Array with 2 elements each one as an object eg
     *                      ```
     *                      [
     *                          { latitude: 123, longitude: 321 }, // upper
     *                          { latitude: 321, longitude: 123 }  // bottom
     *                      ]
     *                      ```
     *
     * @return {Promise} Promise callback with result
     */
    Stream.prototype.searchByBoundingBox = function(bbox) {
        return this.search({ bbox: { coords: bbox } });
    };

    /**
     * Search text for a channel of a ServiceObject stream
     *
     * @param {String} channel The channel name where to search in
     * @param {Number} string The string query to search for
     *
     * @return {Promise} Promise callback with result
     */
    Stream.prototype.searchByText = function(channel, string) {
        return this.search({ match: { string: string, channel: channel } });
    };

    /**
     * Search data by the update time range of a ServiceObject stream
     *
     * @param {Object} params An object with at least one of `from` or `to` properties
     *
     * @return {Promise} Promise callback with result
     */
    Stream.prototype.searchByTime = function(params) {
        if(typeof params !== "object") {
            params = {
                from: arguments[0],
                to: arguments[1]
            };
        }
        return this.search({ time: params });
    };

    /**
     * Search data by a numeric value of a ServiceObject stream
     *
     * @param {String} channel Channel name to search for
     * @param {Object} params An object with at least one of `from` or `to` properties
     *
     * @return {Promise} Promise callback with result
     */
    Stream.prototype.searchByNumber = function(channel, params) {
        if(typeof params !== 'object') {
            params = {
                from: arguments[1], to: arguments[2]
            }
        }
        params.channel = channel;
        return this.search({ numeric: params });
    };

    /**
     *
     * List of Stream object
     *
     * @constructor
     * @augments WebObject.StreamList
     */
    var StreamList = function(obj) {
        compose.lib.WebObject.StreamList(this, arguments);
        this.initialize(obj);
    };
    compose.util.extend(StreamList, compose.lib.WebObject.StreamList);

    StreamList.prototype.getApi = getApi;

    StreamList.prototype.validate = function(stream) {

        stream.description = stream.description || "";
        stream.type = stream.type || "";
        stream.name = stream.name || null;

//            if(!stream.name) {
//                throw new ValidationError("Stream property `name` is required");
//            }

//            if(!stream.type) {
//                throw new ValidationError("Stream property `type` is required");
//            }

        var streamObj = new Stream(stream);
        streamObj.container(this.container());
        return streamObj;
    };

    /**
     * Retieve the description of the ServiceObject streams
     *
     * @return {Promise} A promise with future result
     */
    StreamList.prototype.refresh = function() {
        var me = this;
        return new Promise(function(resolve, reject) {

            if(!me.container().id) {
                throw new ComposeError("Missing ServiceObject id.");
            }

            me.container().getClient().get('/'+me.container().id+'/streams', null, function(data) {
                if(data) {
                    for(var i in data.streams) {
                        var stream = data.streams[i];
                        me.container().getStreams().add(stream.name || i, stream);
                    }
                }

                resolve && resolve(me);

            }, reject);
        }).bind(me.container());
    };

    /**
     *
     * The Service Object
     *
     * @param {Object} An optional object with the SO definition
     * @constructor
     * @augments WebObject
     */
    var ServiceObject = function(objdef) {

        compose.WebObject.apply(this, arguments);

        this.id = null;
        this.createdAt = null;

        this.__$emitter = new Emitter;

        this.initialize(objdef);
    };
    compose.util.extend(ServiceObject, compose.WebObject);

    ServiceObject.prototype.__$actions = null;
    ServiceObject.prototype.__$subscriptions = null;

    ServiceObject.prototype.emitter = function() {
        return this.__$emitter;
    };

    ServiceObject.prototype.getApi = getApi;

    ServiceObject.prototype.getClient = function() {
        return new compose.lib.Client.Client(this);
    };

    /*
     * @return {String} The service object id
     */
    ServiceObject.prototype.getId = function() {
        return this.id || null;
    };

    /*
     * @return {Number} The creation date as unix timestamp
     */
    ServiceObject.prototype.getCreatedAt = function() {
        return this.createdAt || null;
    };

    /*
     * Destroy a ServiceObject instance, taking care to cleanout inner references
     *
     */
    ServiceObject.prototype.destroy = function() {
        this.emitter().off();
        compose.client.receiver.bind(this);
    };

    /**
     * Bind to an event
     *
     * @param {String} event The event name
     * @param {Function} callback Triggered when the event occur
     * @return {Stream} Self refrence to current stream
     */
    ServiceObject.prototype.on = function(event, callback) {

        // for `data` event bind to the global dataReceiver
        if(event === 'data') {
            compose.util.receiver.bind(this);
        }

        this.emitter().on(event, callback);
        return this;
    };

    /**
     * Bind to an event, but trigger only one time
     *
     * @param {String} event The event name
     * @param {Function} callback Triggered when the event occur
     * @return {Stream} Self refrence to current stream
     */
    ServiceObject.prototype.once = function(event, callback) {

        // for `data` event bind to the global dataReceiver
        if(event === 'data') {
            compose.util.receiver.bind(this);
        }

        this.emitter().once(event, callback);
        return this;
    };

    /**
     * Unbind to an event
     *
     * @param {String|Boolean} event The event name or true to remove all the callbacks
     * @param {Function} callback The function to remove
     * @return {Stream} Self refrence to current stream
     */
    ServiceObject.prototype.off = function(event, callback) {

        // for `data` event bind to the global dataReceiver
        if(event === 'data') {
            compose.util.receiver.unbind(this);
        }

        this.emitter().off(event, callback);
        return this;
    };

    /**
     * Trigger an event
     *
     * @param {String} event The event name
     * @params {mixed} additional arguments to pass to the event
     * @return {Stream} Self refrence to current stream
     */
    ServiceObject.prototype.trigger = function() {
        this.emitter().trigger.apply(this.emitter(), arguments);
        return this;
    };

    ServiceObject.prototype.setStreams = function(streams) {

        var _streams = new StreamList();
        _streams.container(this);
        _streams.initialize(streams);

        this.__$streams = _streams;
    };

    /**
     *
     * @param {Object} actions
     * @returns {ServuceObject} self reference
     */
    ServiceObject.prototype.setActions = function(actions) {

        var list = new ActuationList();
        list.container(this);
        list.initialize(actions);

        this.__$actions = list;

        return this;
    };

    /**
     * Create a new ServiceObject definition and register it in the repository.
     * The unique ServiceObject id (soId) is returned on success.
     *
     * @return {ServiceObject} Self reference
     */
    ServiceObject.prototype.create = function() {
        var me = this;
        return new Promise(function(resolve, reject) {

            me.getClient().post('/', me.toJson(), function(data) {
                if(data) {
                    // set internal reference to soId and createdAt
                    me.id = data.id;
                    me.createdAt = data.createdAt;
                }
                resolve && resolve(me, data);
            }, reject);
        })
        .bind(this)
        ;
    };

    /**
     * Get the ServiceObject description
     *
     * @param {String} soId A service object Id
     *
     * @return {Promise} Promise of the request with the ServiceObject as argument
     */
    ServiceObject.prototype.load = function(id) {
        var me = this;
        return new Promise(function(resolve, reject) {

            if(id) {
                me.id = id;
            }

            if(!me.id) {
                throw new ComposeError("Missing ServiceObject id.");
            }
            me.getClient().get('/'+me.id, null, function(data) {

                if(data) {
                    me.initialize(data);
                }
                resolve && resolve(me);

            }, reject);
        }).bind(me);
    };

    /**
     * Update a Service Object
     *
     * @return {Promise} Promise of the request with the ServiceObject as argument
     */
    ServiceObject.prototype.update = function() {
        var me = this;
        return new Promise(function(resolve, error) {

            if(!me.id) {
                throw new Error("Missing ServiceObject id.");
            }

            me.getClient().put('/'+ me.id, me.toString(), function(data) {
                resolve && resolve(me);
            }, error);
        });
    };

    /**
     * Delete a Service Object
     *
     * @param {String} Optional, the soid to delete
     *
     * @return {Promise} Promise of the request with a new empty so as argument
     */
    ServiceObject.prototype.delete = function(soid) {
        var me = this;
        return new Promise(function(resolve, error) {

            soid = soid || null;

            if(!soid && !me.id) {
                throw new Error("Missing ServiceObject id.");
            }

            if(me.id === soid) {
                soid = null;
            }

            var delId = soid || me.id;

            me.getClient().delete('/'+ delId, null, function() {
                if(!soid) {
                    me.initialize({});
                    me.id = null;
                    me.createdAt = null;
                }
                resolve && resolve(me);
            }, error);
        });
    };


    /**
     * @todo: ACTUATIONS section
     */

//    ServiceObject.prototype.toString = compose.WebObject.prototype.toString;
    solib.DataBag = DataBag;
    solib.ServiceObject = ServiceObject;

    /**
     * Create a Service Object from an object or a WebObject
     *
     * @param {Object} wo ServiceObject compatible definition object or WebObject
     *
     * @return {Promise} Promise for the future ServiceObject created
     * */
    solib.create = function(wo) {

        if(wo instanceof compose.WebObject) {
            wo = wo.toJson();
        }

        var so = new ServiceObject(wo);
        return so.create();
    };

    /**
     * Delete a Service Object by id
     *
     * @param {String} soid ServiceObject id
     *
     * @return {Promise} Promise for the future result of the operation
     * */
    solib.delete = function(soid) {
        return (new ServiceObject()).delete(soid);
    };

    /**
     * @param {String} id ServiceObject id
     *
     * @return {Promise} A promise with the created SO
     */
    solib.load = function(id) {
        return (new ServiceObject()).load(id);
    };


    /**
     * Return a API client instance
     *
     * @todo move to a autonomous module?
     * @return {compose.lib.Client.Client} A compose client
     */
    solib.client = function() {
        return (new ServiceObject()).getClient();
    };

    /**
     * Retrieve all the Service Objects from a given user (identified by the Authorization header).
     *
     * @return {ServiceObject} Self reference
     */
    solib.list = function() {
        var client = solib.client();
        return new Promise(function(resolve, reject) {
            client.get('/', null, function(data) {
                client.ServiceObject = null;
                var json = typeof data === 'string' ? JSON.parse(data) : data;
                resolve(json);
            }, reject);
        }).bind(client);
    };

};


return module && module.exports && Object.keys(module.exports).length
        ? module.exports : exports;
})()
,
'./platforms/mqtt/browser': (function() {
var exports = {}; var module = { exports: exports };

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

var mqttlib = module.exports;

mqttlib.initialize = function(compose) {
    throw new compose.error.ComposeError("Browser support for mqtt has not been implemented yet! Please, use stomp instead");
};


return module && module.exports && Object.keys(module.exports).length
        ? module.exports : exports;
})()
,
'./platforms/stomp/browser': (function() {
var exports = {}; var module = { exports: exports };

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

var client = null;
var ws = null;

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
    var proto = compose.config.stomp.proto || 'ws';
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

            if(client) {

                d("WS state " + ws.readyState);
                switch(ws.readyState) {
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
                        ws = null;

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

            ws = new WebSocket(stompConf.proto + "://" + stompConf.host + ":" + stompConf.port);

//                client.onerror = function(e) {
//
//                    // @TODO: test properly the reconnection beahvior!
//                    if(ws) {
//
//                        if(ws.readyState >= 2 && tries < reconnectTimes){
//                            d("[ws client] Connection lost, try reconnect");
//                            tries--;
//                            adapter.connect(handler, connectionSuccess, connectionFail);
//                            return;
//                        }
//
//                        if(ws.readyState < 2) {
//                            d(e);
//                            handler.emitter.trigger("error", { message: "Websocket error", data: e })
//                            return;
//                        }
//                    }
//
//                    d("[ws client] Connection error");
//                    tries = reconnectTimes;
//                };
//                ws.onopen = function() {
//                    tries = reconnectTimes;
//                };

            client = Stomp.over(ws);

            client.debug = d;

            client.connect({
                    login: stompConf.user,
                    passcode: stompConf.password
                },
                function() { //success

                    handler.emitter.trigger('connect', client);

                    d("Subscribe to " + topics.to);
                    client.subscribe(topics.to, function(message) {
                        d("New message from topic " + topics.to);
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
        client.close();
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
        client.send(topics.from, ropts, JSON.stringify(request));

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
        client.subscribe(topic, function(message) {
            d("[stomp client] New message from topic " + topic);
            message.messageId = uuid;
            queue.handleResponse(message);
        });
    };

};


return module && module.exports && Object.keys(module.exports).length
        ? module.exports : exports;
})()
,
'./platforms/http/browser': (function() {
var exports = {}; var module = { exports: exports };

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
                handler.emitter.trigger('error', {
                    code: http.status
                });
            }
            else {

                var data = http.responseText;

                try {
                    data = JSON.parse(data);
                }
                catch(e) {}
                handler.emitter.trigger('success', data);
            }
        };

        http.open(handler.method, url, true);
        http.setRequestHeader("Content-type", "application/json");
        http.setRequestHeader("Authorization", compose.config.apiKey);

        var data = null;
        if(handler.body) {
            data = JSON.stringify(handler.body);
        }

        http.send(data);
    };

};


return module && module.exports && Object.keys(module.exports).length
        ? module.exports : exports;
})()
,
'bluebird': (function() {
var exports = {}; var module = { exports: exports };

/**
 * bluebird build version 2.2.2
 * Features enabled: core, race, call_get, generators, map, nodeify, promisify, props, reduce, settle, some, progress, cancel, using, filter, any, each, timers
*/
/**
 * @preserve Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
!function(e){"object"==typeof exports?module.exports=e():"function"==typeof define&&define.amd?define(e):"undefined"!=typeof window?window.Promise=e():"undefined"!=typeof global?global.Promise=e():"undefined"!=typeof self&&(self.Promise=e())}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise) {
var SomePromiseArray = Promise._SomePromiseArray;
function Promise$_Any(promises) {
    var ret = new SomePromiseArray(promises);
    var promise = ret.promise();
    if (promise.isRejected()) {
        return promise;
    }
    ret.setHowMany(1);
    ret.setUnwrap();
    ret.init();
    return promise;
}

Promise.any = function Promise$Any(promises) {
    return Promise$_Any(promises);
};

Promise.prototype.any = function Promise$any() {
    return Promise$_Any(this);
};

};

},{}],2:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var schedule = require("./schedule.js");
var Queue = require("./queue.js");
var errorObj = require("./util.js").errorObj;
var tryCatch1 = require("./util.js").tryCatch1;
var _process = typeof process !== "undefined" ? process : void 0;

function Async() {
    this._isTickUsed = false;
    this._schedule = schedule;
    this._length = 0;
    this._lateBuffer = new Queue(16);
    this._functionBuffer = new Queue(65536);
    var self = this;
    this.consumeFunctionBuffer = function Async$consumeFunctionBuffer() {
        self._consumeFunctionBuffer();
    };
}

Async.prototype.haveItemsQueued = function Async$haveItemsQueued() {
    return this._length > 0;
};

Async.prototype.invokeLater = function Async$invokeLater(fn, receiver, arg) {
    if (_process !== void 0 &&
        _process.domain != null &&
        !fn.domain) {
        fn = _process.domain.bind(fn);
    }
    this._lateBuffer.push(fn, receiver, arg);
    this._queueTick();
};

Async.prototype.invoke = function Async$invoke(fn, receiver, arg) {
    if (_process !== void 0 &&
        _process.domain != null &&
        !fn.domain) {
        fn = _process.domain.bind(fn);
    }
    var functionBuffer = this._functionBuffer;
    functionBuffer.push(fn, receiver, arg);
    this._length = functionBuffer.length();
    this._queueTick();
};

Async.prototype._consumeFunctionBuffer =
function Async$_consumeFunctionBuffer() {
    var functionBuffer = this._functionBuffer;
    while (functionBuffer.length() > 0) {
        var fn = functionBuffer.shift();
        var receiver = functionBuffer.shift();
        var arg = functionBuffer.shift();
        fn.call(receiver, arg);
    }
    this._reset();
    this._consumeLateBuffer();
};

Async.prototype._consumeLateBuffer = function Async$_consumeLateBuffer() {
    var buffer = this._lateBuffer;
    while(buffer.length() > 0) {
        var fn = buffer.shift();
        var receiver = buffer.shift();
        var arg = buffer.shift();
        var res = tryCatch1(fn, receiver, arg);
        if (res === errorObj) {
            this._queueTick();
            if (fn.domain != null) {
                fn.domain.emit("error", res.e);
            } else {
                throw res.e;
            }
        }
    }
};

Async.prototype._queueTick = function Async$_queue() {
    if (!this._isTickUsed) {
        this._schedule(this.consumeFunctionBuffer);
        this._isTickUsed = true;
    }
};

Async.prototype._reset = function Async$_reset() {
    this._isTickUsed = false;
    this._length = 0;
};

module.exports = new Async();

},{"./queue.js":25,"./schedule.js":28,"./util.js":35}],3:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var Promise = require("./promise.js")();
module.exports = Promise;
},{"./promise.js":20}],4:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var cr = Object.create;
if (cr) {
    var callerCache = cr(null);
    var getterCache = cr(null);
    callerCache[" size"] = getterCache[" size"] = 0;
}

module.exports = function(Promise) {
var util = require("./util.js");
var canEvaluate = util.canEvaluate;
var isIdentifier = util.isIdentifier;

function makeMethodCaller (methodName) {
    return new Function("obj", "                                             \n\
        'use strict'                                                         \n\
        var len = this.length;                                               \n\
        switch(len) {                                                        \n\
            case 1: return obj.methodName(this[0]);                          \n\
            case 2: return obj.methodName(this[0], this[1]);                 \n\
            case 3: return obj.methodName(this[0], this[1], this[2]);        \n\
            case 0: return obj.methodName();                                 \n\
            default: return obj.methodName.apply(obj, this);                 \n\
        }                                                                    \n\
        ".replace(/methodName/g, methodName));
}

function makeGetter (propertyName) {
    return new Function("obj", "                                             \n\
        'use strict';                                                        \n\
        return obj.propertyName;                                             \n\
        ".replace("propertyName", propertyName));
}

function getCompiled(name, compiler, cache) {
    var ret = cache[name];
    if (typeof ret !== "function") {
        if (!isIdentifier(name)) {
            return null;
        }
        ret = compiler(name);
        cache[name] = ret;
        cache[" size"]++;
        if (cache[" size"] > 512) {
            var keys = Object.keys(cache);
            for (var i = 0; i < 256; ++i) delete cache[keys[i]];
            cache[" size"] = keys.length - 256;
        }
    }
    return ret;
}

function getMethodCaller(name) {
    return getCompiled(name, makeMethodCaller, callerCache);
}

function getGetter(name) {
    return getCompiled(name, makeGetter, getterCache);
}

function caller(obj) {
    return obj[this.pop()].apply(obj, this);
}
Promise.prototype.call = function Promise$call(methodName) {
    var $_len = arguments.length;var args = new Array($_len - 1); for(var $_i = 1; $_i < $_len; ++$_i) {args[$_i - 1] = arguments[$_i];}
    if (canEvaluate) {
        var maybeCaller = getMethodCaller(methodName);
        if (maybeCaller !== null) {
            return this._then(maybeCaller, void 0, void 0, args, void 0);
        }
    }
    args.push(methodName);
    return this._then(caller, void 0, void 0, args, void 0);
};

function namedGetter(obj) {
    return obj[this];
}
function indexedGetter(obj) {
    return obj[this];
}
Promise.prototype.get = function Promise$get(propertyName) {
    var isIndex = (typeof propertyName === "number");
    var getter;
    if (!isIndex) {
        if (canEvaluate) {
            var maybeGetter = getGetter(propertyName);
            getter = maybeGetter !== null ? maybeGetter : namedGetter;
        } else {
            getter = namedGetter;
        }
    } else {
        getter = indexedGetter;
    }
    return this._then(getter, void 0, void 0, propertyName, void 0);
};
};

},{"./util.js":35}],5:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, INTERNAL) {
var errors = require("./errors.js");
var canAttach = errors.canAttach;
var async = require("./async.js");
var CancellationError = errors.CancellationError;

Promise.prototype._cancel = function Promise$_cancel(reason) {
    if (!this.isCancellable()) return this;
    var parent;
    var promiseToReject = this;
    while ((parent = promiseToReject._cancellationParent) !== void 0 &&
        parent.isCancellable()) {
        promiseToReject = parent;
    }
    promiseToReject._attachExtraTrace(reason);
    promiseToReject._rejectUnchecked(reason);
};

Promise.prototype.cancel = function Promise$cancel(reason) {
    if (!this.isCancellable()) return this;
    reason = reason !== void 0
        ? (canAttach(reason) ? reason : new Error(reason + ""))
        : new CancellationError();
    async.invokeLater(this._cancel, this, reason);
    return this;
};

Promise.prototype.cancellable = function Promise$cancellable() {
    if (this._cancellable()) return this;
    this._setCancellable();
    this._cancellationParent = void 0;
    return this;
};

Promise.prototype.uncancellable = function Promise$uncancellable() {
    var ret = new Promise(INTERNAL);
    ret._propagateFrom(this, 2 | 4);
    ret._follow(this);
    ret._unsetCancellable();
    return ret;
};

Promise.prototype.fork =
function Promise$fork(didFulfill, didReject, didProgress) {
    var ret = this._then(didFulfill, didReject, didProgress,
                         void 0, void 0);

    ret._setCancellable();
    ret._cancellationParent = void 0;
    return ret;
};
};

},{"./async.js":2,"./errors.js":10}],6:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function() {
var inherits = require("./util.js").inherits;
var defineProperty = require("./es5.js").defineProperty;

var rignore = new RegExp(
    "\\b(?:[a-zA-Z0-9.]+\\$_\\w+|" +
    "tryCatch(?:1|2|3|4|Apply)|new \\w*PromiseArray|" +
    "\\w*PromiseArray\\.\\w*PromiseArray|" +
    "setTimeout|CatchFilter\\$_\\w+|makeNodePromisified|processImmediate|" +
    "process._tickCallback|nextTick|Async\\$\\w+)\\b"
);

var rtraceline = null;
var formatStack = null;

function formatNonError(obj) {
    var str;
    if (typeof obj === "function") {
        str = "[function " +
            (obj.name || "anonymous") +
            "]";
    } else {
        str = obj.toString();
        var ruselessToString = /\[object [a-zA-Z0-9$_]+\]/;
        if (ruselessToString.test(str)) {
            try {
                var newStr = JSON.stringify(obj);
                str = newStr;
            }
            catch(e) {

            }
        }
        if (str.length === 0) {
            str = "(empty array)";
        }
    }
    return ("(<" + snip(str) + ">, no stack trace)");
}

function snip(str) {
    var maxChars = 41;
    if (str.length < maxChars) {
        return str;
    }
    return str.substr(0, maxChars - 3) + "...";
}

function CapturedTrace(ignoreUntil, isTopLevel) {
    this.captureStackTrace(CapturedTrace, isTopLevel);

}
inherits(CapturedTrace, Error);

CapturedTrace.prototype.captureStackTrace =
function CapturedTrace$captureStackTrace(ignoreUntil, isTopLevel) {
    captureStackTrace(this, ignoreUntil, isTopLevel);
};

CapturedTrace.possiblyUnhandledRejection =
function CapturedTrace$PossiblyUnhandledRejection(reason) {
    if (typeof console === "object") {
        var message;
        if (typeof reason === "object" || typeof reason === "function") {
            var stack = reason.stack;
            message = "Possibly unhandled " + formatStack(stack, reason);
        } else {
            message = "Possibly unhandled " + String(reason);
        }
        if (typeof console.error === "function" ||
            typeof console.error === "object") {
            console.error(message);
        } else if (typeof console.log === "function" ||
            typeof console.log === "object") {
            console.log(message);
        }
    }
};

CapturedTrace.combine = function CapturedTrace$Combine(current, prev) {
    var curLast = current.length - 1;
    for (var i = prev.length - 1; i >= 0; --i) {
        var line = prev[i];
        if (current[curLast] === line) {
            current.pop();
            curLast--;
        } else {
            break;
        }
    }

    current.push("From previous event:");
    var lines = current.concat(prev);

    var ret = [];

    for (var i = 0, len = lines.length; i < len; ++i) {

        if ((rignore.test(lines[i]) ||
            (i > 0 && !rtraceline.test(lines[i])) &&
            lines[i] !== "From previous event:")
       ) {
            continue;
        }
        ret.push(lines[i]);
    }
    return ret;
};

CapturedTrace.protectErrorMessageNewlines = function(stack) {
    for (var i = 0; i < stack.length; ++i) {
        if (rtraceline.test(stack[i])) {
            break;
        }
    }

    if (i <= 1) return;

    var errorMessageLines = [];
    for (var j = 0; j < i; ++j) {
        errorMessageLines.push(stack.shift());
    }
    stack.unshift(errorMessageLines.join("\u0002\u0000\u0001"));
};

CapturedTrace.isSupported = function CapturedTrace$IsSupported() {
    return typeof captureStackTrace === "function";
};

var captureStackTrace = (function stackDetection() {
    if (typeof Error.stackTraceLimit === "number" &&
        typeof Error.captureStackTrace === "function") {
        rtraceline = /^\s*at\s*/;
        formatStack = function(stack, error) {
            if (typeof stack === "string") return stack;

            if (error.name !== void 0 &&
                error.message !== void 0) {
                return error.name + ". " + error.message;
            }
            return formatNonError(error);


        };
        var captureStackTrace = Error.captureStackTrace;
        return function CapturedTrace$_captureStackTrace(
            receiver, ignoreUntil) {
            captureStackTrace(receiver, ignoreUntil);
        };
    }
    var err = new Error();

    if (typeof err.stack === "string" &&
        typeof "".startsWith === "function" &&
        (err.stack.startsWith("stackDetection@")) &&
        stackDetection.name === "stackDetection") {

        defineProperty(Error, "stackTraceLimit", {
            writable: true,
            enumerable: false,
            configurable: false,
            value: 25
        });
        rtraceline = /@/;
        var rline = /[@\n]/;

        formatStack = function(stack, error) {
            if (typeof stack === "string") {
                return (error.name + ". " + error.message + "\n" + stack);
            }

            if (error.name !== void 0 &&
                error.message !== void 0) {
                return error.name + ". " + error.message;
            }
            return formatNonError(error);
        };

        return function captureStackTrace(o) {
            var stack = new Error().stack;
            var split = stack.split(rline);
            var len = split.length;
            var ret = "";
            for (var i = 0; i < len; i += 2) {
                ret += split[i];
                ret += "@";
                ret += split[i + 1];
                ret += "\n";
            }
            o.stack = ret;
        };
    } else {
        formatStack = function(stack, error) {
            if (typeof stack === "string") return stack;

            if ((typeof error === "object" ||
                typeof error === "function") &&
                error.name !== void 0 &&
                error.message !== void 0) {
                return error.name + ". " + error.message;
            }
            return formatNonError(error);
        };

        return null;
    }
})();

return CapturedTrace;
};

},{"./es5.js":12,"./util.js":35}],7:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(NEXT_FILTER) {
var util = require("./util.js");
var errors = require("./errors.js");
var tryCatch1 = util.tryCatch1;
var errorObj = util.errorObj;
var keys = require("./es5.js").keys;
var TypeError = errors.TypeError;

function CatchFilter(instances, callback, promise) {
    this._instances = instances;
    this._callback = callback;
    this._promise = promise;
}

function CatchFilter$_safePredicate(predicate, e) {
    var safeObject = {};
    var retfilter = tryCatch1(predicate, safeObject, e);

    if (retfilter === errorObj) return retfilter;

    var safeKeys = keys(safeObject);
    if (safeKeys.length) {
        errorObj.e = new TypeError(
            "Catch filter must inherit from Error "
          + "or be a simple predicate function");
        return errorObj;
    }
    return retfilter;
}

CatchFilter.prototype.doFilter = function CatchFilter$_doFilter(e) {
    var cb = this._callback;
    var promise = this._promise;
    var boundTo = promise._boundTo;
    for (var i = 0, len = this._instances.length; i < len; ++i) {
        var item = this._instances[i];
        var itemIsErrorType = item === Error ||
            (item != null && item.prototype instanceof Error);

        if (itemIsErrorType && e instanceof item) {
            var ret = tryCatch1(cb, boundTo, e);
            if (ret === errorObj) {
                NEXT_FILTER.e = ret.e;
                return NEXT_FILTER;
            }
            return ret;
        } else if (typeof item === "function" && !itemIsErrorType) {
            var shouldHandle = CatchFilter$_safePredicate(item, e);
            if (shouldHandle === errorObj) {
                var trace = errors.canAttach(errorObj.e)
                    ? errorObj.e
                    : new Error(errorObj.e + "");
                this._promise._attachExtraTrace(trace);
                e = errorObj.e;
                break;
            } else if (shouldHandle) {
                var ret = tryCatch1(cb, boundTo, e);
                if (ret === errorObj) {
                    NEXT_FILTER.e = ret.e;
                    return NEXT_FILTER;
                }
                return ret;
            }
        }
    }
    NEXT_FILTER.e = e;
    return NEXT_FILTER;
};

return CatchFilter;
};

},{"./errors.js":10,"./es5.js":12,"./util.js":35}],8:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var util = require("./util.js");
var isPrimitive = util.isPrimitive;
var wrapsPrimitiveReceiver = util.wrapsPrimitiveReceiver;

module.exports = function(Promise) {
var returner = function Promise$_returner() {
    return this;
};
var thrower = function Promise$_thrower() {
    throw this;
};

var wrapper = function Promise$_wrapper(value, action) {
    if (action === 1) {
        return function Promise$_thrower() {
            throw value;
        };
    } else if (action === 2) {
        return function Promise$_returner() {
            return value;
        };
    }
};


Promise.prototype["return"] =
Promise.prototype.thenReturn =
function Promise$thenReturn(value) {
    if (wrapsPrimitiveReceiver && isPrimitive(value)) {
        return this._then(
            wrapper(value, 2),
            void 0,
            void 0,
            void 0,
            void 0
       );
    }
    return this._then(returner, void 0, void 0, value, void 0);
};

Promise.prototype["throw"] =
Promise.prototype.thenThrow =
function Promise$thenThrow(reason) {
    if (wrapsPrimitiveReceiver && isPrimitive(reason)) {
        return this._then(
            wrapper(reason, 1),
            void 0,
            void 0,
            void 0,
            void 0
       );
    }
    return this._then(thrower, void 0, void 0, reason, void 0);
};
};

},{"./util.js":35}],9:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, INTERNAL) {
var PromiseReduce = Promise.reduce;

Promise.prototype.each = function Promise$each(fn) {
    return PromiseReduce(this, fn, null, INTERNAL);
};

Promise.each = function Promise$Each(promises, fn) {
    return PromiseReduce(promises, fn, null, INTERNAL);
};
};

},{}],10:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var Objectfreeze = require("./es5.js").freeze;
var util = require("./util.js");
var inherits = util.inherits;
var notEnumerableProp = util.notEnumerableProp;

function markAsOriginatingFromRejection(e) {
    try {
        notEnumerableProp(e, "isOperational", true);
    }
    catch(ignore) {}
}

function originatesFromRejection(e) {
    if (e == null) return false;
    return ((e instanceof OperationalError) ||
        e["isOperational"] === true);
}

function isError(obj) {
    return obj instanceof Error;
}

function canAttach(obj) {
    return isError(obj);
}

function subError(nameProperty, defaultMessage) {
    function SubError(message) {
        if (!(this instanceof SubError)) return new SubError(message);
        this.message = typeof message === "string" ? message : defaultMessage;
        this.name = nameProperty;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
    inherits(SubError, Error);
    return SubError;
}

var _TypeError, _RangeError;
var CancellationError = subError("CancellationError", "cancellation error");
var TimeoutError = subError("TimeoutError", "timeout error");
var AggregateError = subError("AggregateError", "aggregate error");
try {
    _TypeError = TypeError;
    _RangeError = RangeError;
} catch(e) {
    _TypeError = subError("TypeError", "type error");
    _RangeError = subError("RangeError", "range error");
}

var methods = ("join pop push shift unshift slice filter forEach some " +
    "every map indexOf lastIndexOf reduce reduceRight sort reverse").split(" ");

for (var i = 0; i < methods.length; ++i) {
    if (typeof Array.prototype[methods[i]] === "function") {
        AggregateError.prototype[methods[i]] = Array.prototype[methods[i]];
    }
}

AggregateError.prototype.length = 0;
AggregateError.prototype["isOperational"] = true;
var level = 0;
AggregateError.prototype.toString = function() {
    var indent = Array(level * 4 + 1).join(" ");
    var ret = "\n" + indent + "AggregateError of:" + "\n";
    level++;
    indent = Array(level * 4 + 1).join(" ");
    for (var i = 0; i < this.length; ++i) {
        var str = this[i] === this ? "[Circular AggregateError]" : this[i] + "";
        var lines = str.split("\n");
        for (var j = 0; j < lines.length; ++j) {
            lines[j] = indent + lines[j];
        }
        str = lines.join("\n");
        ret += str + "\n";
    }
    level--;
    return ret;
};

function OperationalError(message) {
    this.name = "OperationalError";
    this.message = message;
    this.cause = message;
    this["isOperational"] = true;

    if (message instanceof Error) {
        this.message = message.message;
        this.stack = message.stack;
    } else if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
    }

}
inherits(OperationalError, Error);

var key = "__BluebirdErrorTypes__";
var errorTypes = Error[key];
if (!errorTypes) {
    errorTypes = Objectfreeze({
        CancellationError: CancellationError,
        TimeoutError: TimeoutError,
        OperationalError: OperationalError,
        RejectionError: OperationalError,
        AggregateError: AggregateError
    });
    notEnumerableProp(Error, key, errorTypes);
}

module.exports = {
    Error: Error,
    TypeError: _TypeError,
    RangeError: _RangeError,
    CancellationError: errorTypes.CancellationError,
    OperationalError: errorTypes.OperationalError,
    TimeoutError: errorTypes.TimeoutError,
    AggregateError: errorTypes.AggregateError,
    originatesFromRejection: originatesFromRejection,
    markAsOriginatingFromRejection: markAsOriginatingFromRejection,
    canAttach: canAttach
};

},{"./es5.js":12,"./util.js":35}],11:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise) {
var TypeError = require('./errors.js').TypeError;

function apiRejection(msg) {
    var error = new TypeError(msg);
    var ret = Promise.rejected(error);
    var parent = ret._peekContext();
    if (parent != null) {
        parent._attachExtraTrace(error);
    }
    return ret;
}

return apiRejection;
};

},{"./errors.js":10}],12:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
var isES5 = (function(){
    "use strict";
    return this === void 0;
})();

if (isES5) {
    module.exports = {
        freeze: Object.freeze,
        defineProperty: Object.defineProperty,
        keys: Object.keys,
        getPrototypeOf: Object.getPrototypeOf,
        isArray: Array.isArray,
        isES5: isES5
    };
} else {
    var has = {}.hasOwnProperty;
    var str = {}.toString;
    var proto = {}.constructor.prototype;

    var ObjectKeys = function ObjectKeys(o) {
        var ret = [];
        for (var key in o) {
            if (has.call(o, key)) {
                ret.push(key);
            }
        }
        return ret;
    }

    var ObjectDefineProperty = function ObjectDefineProperty(o, key, desc) {
        o[key] = desc.value;
        return o;
    }

    var ObjectFreeze = function ObjectFreeze(obj) {
        return obj;
    }

    var ObjectGetPrototypeOf = function ObjectGetPrototypeOf(obj) {
        try {
            return Object(obj).constructor.prototype;
        }
        catch (e) {
            return proto;
        }
    }

    var ArrayIsArray = function ArrayIsArray(obj) {
        try {
            return str.call(obj) === "[object Array]";
        }
        catch(e) {
            return false;
        }
    }

    module.exports = {
        isArray: ArrayIsArray,
        keys: ObjectKeys,
        defineProperty: ObjectDefineProperty,
        freeze: ObjectFreeze,
        getPrototypeOf: ObjectGetPrototypeOf,
        isES5: isES5
    };
}

},{}],13:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, INTERNAL) {
var PromiseMap = Promise.map;

Promise.prototype.filter = function Promise$filter(fn, options) {
    return PromiseMap(this, fn, options, INTERNAL);
};

Promise.filter = function Promise$Filter(promises, fn, options) {
    return PromiseMap(promises, fn, options, INTERNAL);
};
};

},{}],14:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, NEXT_FILTER, cast) {
var util = require("./util.js");
var wrapsPrimitiveReceiver = util.wrapsPrimitiveReceiver;
var isPrimitive = util.isPrimitive;
var thrower = util.thrower;

function returnThis() {
    return this;
}
function throwThis() {
    throw this;
}
function return$(r) {
    return function Promise$_returner() {
        return r;
    };
}
function throw$(r) {
    return function Promise$_thrower() {
        throw r;
    };
}
function promisedFinally(ret, reasonOrValue, isFulfilled) {
    var then;
    if (wrapsPrimitiveReceiver && isPrimitive(reasonOrValue)) {
        then = isFulfilled ? return$(reasonOrValue) : throw$(reasonOrValue);
    } else {
        then = isFulfilled ? returnThis : throwThis;
    }
    return ret._then(then, thrower, void 0, reasonOrValue, void 0);
}

function finallyHandler(reasonOrValue) {
    var promise = this.promise;
    var handler = this.handler;

    var ret = promise._isBound()
                    ? handler.call(promise._boundTo)
                    : handler();

    if (ret !== void 0) {
        var maybePromise = cast(ret, void 0);
        if (maybePromise instanceof Promise) {
            return promisedFinally(maybePromise, reasonOrValue,
                                    promise.isFulfilled());
        }
    }

    if (promise.isRejected()) {
        NEXT_FILTER.e = reasonOrValue;
        return NEXT_FILTER;
    } else {
        return reasonOrValue;
    }
}

function tapHandler(value) {
    var promise = this.promise;
    var handler = this.handler;

    var ret = promise._isBound()
                    ? handler.call(promise._boundTo, value)
                    : handler(value);

    if (ret !== void 0) {
        var maybePromise = cast(ret, void 0);
        if (maybePromise instanceof Promise) {
            return promisedFinally(maybePromise, value, true);
        }
    }
    return value;
}

Promise.prototype._passThroughHandler =
function Promise$_passThroughHandler(handler, isFinally) {
    if (typeof handler !== "function") return this.then();

    var promiseAndHandler = {
        promise: this,
        handler: handler
    };

    return this._then(
            isFinally ? finallyHandler : tapHandler,
            isFinally ? finallyHandler : void 0, void 0,
            promiseAndHandler, void 0);
};

Promise.prototype.lastly =
Promise.prototype["finally"] = function Promise$finally(handler) {
    return this._passThroughHandler(handler, true);
};

Promise.prototype.tap = function Promise$tap(handler) {
    return this._passThroughHandler(handler, false);
};
};

},{"./util.js":35}],15:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, apiRejection, INTERNAL, cast) {
var errors = require("./errors.js");
var TypeError = errors.TypeError;
var deprecated = require("./util.js").deprecated;
var util = require("./util.js");
var errorObj = util.errorObj;
var tryCatch1 = util.tryCatch1;
var yieldHandlers = [];

function promiseFromYieldHandler(value, yieldHandlers) {
    var _errorObj = errorObj;
    var _Promise = Promise;
    var len = yieldHandlers.length;
    for (var i = 0; i < len; ++i) {
        var result = tryCatch1(yieldHandlers[i], void 0, value);
        if (result === _errorObj) {
            return _Promise.reject(_errorObj.e);
        }
        var maybePromise = cast(result, promiseFromYieldHandler);
        if (maybePromise instanceof _Promise) return maybePromise;
    }
    return null;
}

function PromiseSpawn(generatorFunction, receiver, yieldHandler) {
    var promise = this._promise = new Promise(INTERNAL);
    promise._setTrace(void 0);
    this._generatorFunction = generatorFunction;
    this._receiver = receiver;
    this._generator = void 0;
    this._yieldHandlers = typeof yieldHandler === "function"
        ? [yieldHandler].concat(yieldHandlers)
        : yieldHandlers;
}

PromiseSpawn.prototype.promise = function PromiseSpawn$promise() {
    return this._promise;
};

PromiseSpawn.prototype._run = function PromiseSpawn$_run() {
    this._generator = this._generatorFunction.call(this._receiver);
    this._receiver =
        this._generatorFunction = void 0;
    this._next(void 0);
};

PromiseSpawn.prototype._continue = function PromiseSpawn$_continue(result) {
    if (result === errorObj) {
        this._generator = void 0;
        var trace = errors.canAttach(result.e)
            ? result.e : new Error(result.e + "");
        this._promise._attachExtraTrace(trace);
        this._promise._reject(result.e, trace);
        return;
    }

    var value = result.value;
    if (result.done === true) {
        this._generator = void 0;
        if (!this._promise._tryFollow(value)) {
            this._promise._fulfill(value);
        }
    } else {
        var maybePromise = cast(value, void 0);
        if (!(maybePromise instanceof Promise)) {
            maybePromise =
                promiseFromYieldHandler(maybePromise, this._yieldHandlers);
            if (maybePromise === null) {
                this._throw(new TypeError("A value was yielded that could not be treated as a promise"));
                return;
            }
        }
        maybePromise._then(
            this._next,
            this._throw,
            void 0,
            this,
            null
       );
    }
};

PromiseSpawn.prototype._throw = function PromiseSpawn$_throw(reason) {
    if (errors.canAttach(reason))
        this._promise._attachExtraTrace(reason);
    this._continue(
        tryCatch1(this._generator["throw"], this._generator, reason)
   );
};

PromiseSpawn.prototype._next = function PromiseSpawn$_next(value) {
    this._continue(
        tryCatch1(this._generator.next, this._generator, value)
   );
};

Promise.coroutine =
function Promise$Coroutine(generatorFunction, options) {
    if (typeof generatorFunction !== "function") {
        throw new TypeError("generatorFunction must be a function");
    }
    var yieldHandler = Object(options).yieldHandler;
    var PromiseSpawn$ = PromiseSpawn;
    return function () {
        var generator = generatorFunction.apply(this, arguments);
        var spawn = new PromiseSpawn$(void 0, void 0, yieldHandler);
        spawn._generator = generator;
        spawn._next(void 0);
        return spawn.promise();
    };
};

Promise.coroutine.addYieldHandler = function(fn) {
    if (typeof fn !== "function") throw new TypeError("fn must be a function");
    yieldHandlers.push(fn);
};

Promise.spawn = function Promise$Spawn(generatorFunction) {
    deprecated("Promise.spawn is deprecated. Use Promise.coroutine instead.");
    if (typeof generatorFunction !== "function") {
        return apiRejection("generatorFunction must be a function");
    }
    var spawn = new PromiseSpawn(generatorFunction, this);
    var ret = spawn.promise();
    spawn._run(Promise.spawn);
    return ret;
};
};

},{"./errors.js":10,"./util.js":35}],16:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports =
function(Promise, PromiseArray, cast, INTERNAL) {
var util = require("./util.js");
var canEvaluate = util.canEvaluate;
var tryCatch1 = util.tryCatch1;
var errorObj = util.errorObj;


if (canEvaluate) {
    var thenCallback = function(i) {
        return new Function("value", "holder", "                             \n\
            'use strict';                                                    \n\
            holder.pIndex = value;                                           \n\
            holder.checkFulfillment(this);                                   \n\
            ".replace(/Index/g, i));
    };

    var caller = function(count) {
        var values = [];
        for (var i = 1; i <= count; ++i) values.push("holder.p" + i);
        return new Function("holder", "                                      \n\
            'use strict';                                                    \n\
            var callback = holder.fn;                                        \n\
            return callback(values);                                         \n\
            ".replace(/values/g, values.join(", ")));
    };
    var thenCallbacks = [];
    var callers = [void 0];
    for (var i = 1; i <= 5; ++i) {
        thenCallbacks.push(thenCallback(i));
        callers.push(caller(i));
    }

    var Holder = function(total, fn) {
        this.p1 = this.p2 = this.p3 = this.p4 = this.p5 = null;
        this.fn = fn;
        this.total = total;
        this.now = 0;
    };

    Holder.prototype.callers = callers;
    Holder.prototype.checkFulfillment = function(promise) {
        var now = this.now;
        now++;
        var total = this.total;
        if (now >= total) {
            var handler = this.callers[total];
            var ret = tryCatch1(handler, void 0, this);
            if (ret === errorObj) {
                promise._rejectUnchecked(ret.e);
            } else if (!promise._tryFollow(ret)) {
                promise._fulfillUnchecked(ret);
            }
        } else {
            this.now = now;
        }
    };
}




Promise.join = function Promise$Join() {
    var last = arguments.length - 1;
    var fn;
    if (last > 0 && typeof arguments[last] === "function") {
        fn = arguments[last];
        if (last < 6 && canEvaluate) {
            var ret = new Promise(INTERNAL);
            ret._setTrace(void 0);
            var holder = new Holder(last, fn);
            var reject = ret._reject;
            var callbacks = thenCallbacks;
            for (var i = 0; i < last; ++i) {
                var maybePromise = cast(arguments[i], void 0);
                if (maybePromise instanceof Promise) {
                    if (maybePromise.isPending()) {
                        maybePromise._then(callbacks[i], reject,
                                           void 0, ret, holder);
                    } else if (maybePromise.isFulfilled()) {
                        callbacks[i].call(ret,
                                          maybePromise._settledValue, holder);
                    } else {
                        ret._reject(maybePromise._settledValue);
                        maybePromise._unsetRejectionIsUnhandled();
                    }
                } else {
                    callbacks[i].call(ret, maybePromise, holder);
                }
            }
            return ret;
        }
    }
    var $_len = arguments.length;var args = new Array($_len); for(var $_i = 0; $_i < $_len; ++$_i) {args[$_i] = arguments[$_i];}
    var ret = new PromiseArray(args).promise();
    return fn !== void 0 ? ret.spread(fn) : ret;
};

};

},{"./util.js":35}],17:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, PromiseArray, apiRejection, cast, INTERNAL) {
var util = require("./util.js");
var tryCatch3 = util.tryCatch3;
var errorObj = util.errorObj;
var PENDING = {};
var EMPTY_ARRAY = [];

function MappingPromiseArray(promises, fn, limit, _filter) {
    this.constructor$(promises);
    this._callback = fn;
    this._preservedValues = _filter === INTERNAL
        ? new Array(this.length())
        : null;
    this._limit = limit;
    this._inFlight = 0;
    this._queue = limit >= 1 ? [] : EMPTY_ARRAY;
    this._init$(void 0, -2);
}
util.inherits(MappingPromiseArray, PromiseArray);

MappingPromiseArray.prototype._init = function MappingPromiseArray$_init() {};

MappingPromiseArray.prototype._promiseFulfilled =
function MappingPromiseArray$_promiseFulfilled(value, index) {
    var values = this._values;
    if (values === null) return;

    var length = this.length();
    var preservedValues = this._preservedValues;
    var limit = this._limit;
    if (values[index] === PENDING) {
        values[index] = value;
        if (limit >= 1) {
            this._inFlight--;
            this._drainQueue();
            if (this._isResolved()) return;
        }
    } else {
        if (limit >= 1 && this._inFlight >= limit) {
            values[index] = value;
            this._queue.push(index);
            return;
        }
        if (preservedValues !== null) preservedValues[index] = value;

        var callback = this._callback;
        var receiver = this._promise._boundTo;
        var ret = tryCatch3(callback, receiver, value, index, length);
        if (ret === errorObj) return this._reject(ret.e);

        var maybePromise = cast(ret, void 0);
        if (maybePromise instanceof Promise) {
            if (maybePromise.isPending()) {
                if (limit >= 1) this._inFlight++;
                values[index] = PENDING;
                return maybePromise._proxyPromiseArray(this, index);
            } else if (maybePromise.isFulfilled()) {
                ret = maybePromise.value();
            } else {
                maybePromise._unsetRejectionIsUnhandled();
                return this._reject(maybePromise.reason());
            }
        }
        values[index] = ret;
    }
    var totalResolved = ++this._totalResolved;
    if (totalResolved >= length) {
        if (preservedValues !== null) {
            this._filter(values, preservedValues);
        } else {
            this._resolve(values);
        }

    }
};

MappingPromiseArray.prototype._drainQueue =
function MappingPromiseArray$_drainQueue() {
    var queue = this._queue;
    var limit = this._limit;
    var values = this._values;
    while (queue.length > 0 && this._inFlight < limit) {
        var index = queue.pop();
        this._promiseFulfilled(values[index], index);
    }
};

MappingPromiseArray.prototype._filter =
function MappingPromiseArray$_filter(booleans, values) {
    var len = values.length;
    var ret = new Array(len);
    var j = 0;
    for (var i = 0; i < len; ++i) {
        if (booleans[i]) ret[j++] = values[i];
    }
    ret.length = j;
    this._resolve(ret);
};

MappingPromiseArray.prototype.preservedValues =
function MappingPromiseArray$preserveValues() {
    return this._preservedValues;
};

function map(promises, fn, options, _filter) {
    var limit = typeof options === "object" && options !== null
        ? options.concurrency
        : 0;
    limit = typeof limit === "number" &&
        isFinite(limit) && limit >= 1 ? limit : 0;
    return new MappingPromiseArray(promises, fn, limit, _filter);
}

Promise.prototype.map = function Promise$map(fn, options) {
    if (typeof fn !== "function") return apiRejection("fn must be a function");

    return map(this, fn, options, null).promise();
};

Promise.map = function Promise$Map(promises, fn, options, _filter) {
    if (typeof fn !== "function") return apiRejection("fn must be a function");
    return map(promises, fn, options, _filter).promise();
};


};

},{"./util.js":35}],18:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise) {
var util = require("./util.js");
var async = require("./async.js");
var tryCatch2 = util.tryCatch2;
var tryCatch1 = util.tryCatch1;
var errorObj = util.errorObj;

function thrower(r) {
    throw r;
}

function Promise$_spreadAdapter(val, receiver) {
    if (!util.isArray(val)) return Promise$_successAdapter(val, receiver);
    var ret = util.tryCatchApply(this, [null].concat(val), receiver);
    if (ret === errorObj) {
        async.invokeLater(thrower, void 0, ret.e);
    }
}

function Promise$_successAdapter(val, receiver) {
    var nodeback = this;
    var ret = val === void 0
        ? tryCatch1(nodeback, receiver, null)
        : tryCatch2(nodeback, receiver, null, val);
    if (ret === errorObj) {
        async.invokeLater(thrower, void 0, ret.e);
    }
}
function Promise$_errorAdapter(reason, receiver) {
    var nodeback = this;
    var ret = tryCatch1(nodeback, receiver, reason);
    if (ret === errorObj) {
        async.invokeLater(thrower, void 0, ret.e);
    }
}

Promise.prototype.nodeify = function Promise$nodeify(nodeback, options) {
    if (typeof nodeback == "function") {
        var adapter = Promise$_successAdapter;
        if (options !== void 0 && Object(options).spread) {
            adapter = Promise$_spreadAdapter;
        }
        this._then(
            adapter,
            Promise$_errorAdapter,
            void 0,
            nodeback,
            this._boundTo
        );
    }
    return this;
};
};

},{"./async.js":2,"./util.js":35}],19:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, PromiseArray) {
var util = require("./util.js");
var async = require("./async.js");
var errors = require("./errors.js");
var tryCatch1 = util.tryCatch1;
var errorObj = util.errorObj;

Promise.prototype.progressed = function Promise$progressed(handler) {
    return this._then(void 0, void 0, handler, void 0, void 0);
};

Promise.prototype._progress = function Promise$_progress(progressValue) {
    if (this._isFollowingOrFulfilledOrRejected()) return;
    this._progressUnchecked(progressValue);

};

Promise.prototype._progressHandlerAt =
function Promise$_progressHandlerAt(index) {
    return index === 0
        ? this._progressHandler0
        : this[(index << 2) + index - 5 + 2];
};

Promise.prototype._doProgressWith =
function Promise$_doProgressWith(progression) {
    var progressValue = progression.value;
    var handler = progression.handler;
    var promise = progression.promise;
    var receiver = progression.receiver;

    var ret = tryCatch1(handler, receiver, progressValue);
    if (ret === errorObj) {
        if (ret.e != null &&
            ret.e.name !== "StopProgressPropagation") {
            var trace = errors.canAttach(ret.e)
                ? ret.e : new Error(ret.e + "");
            promise._attachExtraTrace(trace);
            promise._progress(ret.e);
        }
    } else if (ret instanceof Promise) {
        ret._then(promise._progress, null, null, promise, void 0);
    } else {
        promise._progress(ret);
    }
};


Promise.prototype._progressUnchecked =
function Promise$_progressUnchecked(progressValue) {
    if (!this.isPending()) return;
    var len = this._length();
    var progress = this._progress;
    for (var i = 0; i < len; i++) {
        var handler = this._progressHandlerAt(i);
        var promise = this._promiseAt(i);
        if (!(promise instanceof Promise)) {
            var receiver = this._receiverAt(i);
            if (typeof handler === "function") {
                handler.call(receiver, progressValue, promise);
            } else if (receiver instanceof Promise && receiver._isProxied()) {
                receiver._progressUnchecked(progressValue);
            } else if (receiver instanceof PromiseArray) {
                receiver._promiseProgressed(progressValue, promise);
            }
            continue;
        }

        if (typeof handler === "function") {
            async.invoke(this._doProgressWith, this, {
                handler: handler,
                promise: promise,
                receiver: this._receiverAt(i),
                value: progressValue
            });
        } else {
            async.invoke(progress, promise, progressValue);
        }
    }
};
};

},{"./async.js":2,"./errors.js":10,"./util.js":35}],20:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var old;
if (typeof Promise !== "undefined") old = Promise;
function noConflict(bluebird) {
    try { if (Promise === bluebird) Promise = old; }
    catch (e) {}
    return bluebird;
}
module.exports = function() {
var util = require("./util.js");
var async = require("./async.js");
var errors = require("./errors.js");

var INTERNAL = function(){};
var APPLY = {};
var NEXT_FILTER = {e: null};

var cast = require("./thenables.js")(Promise, INTERNAL);
var PromiseArray = require("./promise_array.js")(Promise, INTERNAL, cast);
var CapturedTrace = require("./captured_trace.js")();
var CatchFilter = require("./catch_filter.js")(NEXT_FILTER);
var PromiseResolver = require("./promise_resolver.js");

var isArray = util.isArray;

var errorObj = util.errorObj;
var tryCatch1 = util.tryCatch1;
var tryCatch2 = util.tryCatch2;
var tryCatchApply = util.tryCatchApply;
var RangeError = errors.RangeError;
var TypeError = errors.TypeError;
var CancellationError = errors.CancellationError;
var TimeoutError = errors.TimeoutError;
var OperationalError = errors.OperationalError;
var originatesFromRejection = errors.originatesFromRejection;
var markAsOriginatingFromRejection = errors.markAsOriginatingFromRejection;
var canAttach = errors.canAttach;
var thrower = util.thrower;
var apiRejection = require("./errors_api_rejection")(Promise);


var makeSelfResolutionError = function Promise$_makeSelfResolutionError() {
    return new TypeError("circular promise resolution chain");
};

function Promise(resolver) {
    if (typeof resolver !== "function") {
        throw new TypeError("the promise constructor requires a resolver function");
    }
    if (this.constructor !== Promise) {
        throw new TypeError("the promise constructor cannot be invoked directly");
    }
    this._bitField = 0;
    this._fulfillmentHandler0 = void 0;
    this._rejectionHandler0 = void 0;
    this._promise0 = void 0;
    this._receiver0 = void 0;
    this._settledValue = void 0;
    this._boundTo = void 0;
    if (resolver !== INTERNAL) this._resolveFromResolver(resolver);
}

Promise.prototype.bind = function Promise$bind(thisArg) {
    var ret = new Promise(INTERNAL);
    ret._follow(this);
    ret._propagateFrom(this, 2 | 1);
    ret._setBoundTo(thisArg);
    return ret;
};

Promise.prototype.toString = function Promise$toString() {
    return "[object Promise]";
};

Promise.prototype.caught = Promise.prototype["catch"] =
function Promise$catch(fn) {
    var len = arguments.length;
    if (len > 1) {
        var catchInstances = new Array(len - 1),
            j = 0, i;
        for (i = 0; i < len - 1; ++i) {
            var item = arguments[i];
            if (typeof item === "function") {
                catchInstances[j++] = item;
            } else {
                var catchFilterTypeError =
                    new TypeError(
                        "A catch filter must be an error constructor "
                        + "or a filter function");

                this._attachExtraTrace(catchFilterTypeError);
                async.invoke(this._reject, this, catchFilterTypeError);
                return;
            }
        }
        catchInstances.length = j;
        fn = arguments[i];

        this._resetTrace();
        var catchFilter = new CatchFilter(catchInstances, fn, this);
        return this._then(void 0, catchFilter.doFilter, void 0,
            catchFilter, void 0);
    }
    return this._then(void 0, fn, void 0, void 0, void 0);
};

Promise.prototype.then =
function Promise$then(didFulfill, didReject, didProgress) {
    return this._then(didFulfill, didReject, didProgress,
        void 0, void 0);
};


Promise.prototype.done =
function Promise$done(didFulfill, didReject, didProgress) {
    var promise = this._then(didFulfill, didReject, didProgress,
        void 0, void 0);
    promise._setIsFinal();
};

Promise.prototype.spread = function Promise$spread(didFulfill, didReject) {
    return this._then(didFulfill, didReject, void 0,
        APPLY, void 0);
};

Promise.prototype.isCancellable = function Promise$isCancellable() {
    return !this.isResolved() &&
        this._cancellable();
};

Promise.prototype.toJSON = function Promise$toJSON() {
    var ret = {
        isFulfilled: false,
        isRejected: false,
        fulfillmentValue: void 0,
        rejectionReason: void 0
    };
    if (this.isFulfilled()) {
        ret.fulfillmentValue = this._settledValue;
        ret.isFulfilled = true;
    } else if (this.isRejected()) {
        ret.rejectionReason = this._settledValue;
        ret.isRejected = true;
    }
    return ret;
};

Promise.prototype.all = function Promise$all() {
    return new PromiseArray(this).promise();
};


Promise.is = function Promise$Is(val) {
    return val instanceof Promise;
};

Promise.all = function Promise$All(promises) {
    return new PromiseArray(promises).promise();
};

Promise.prototype.error = function Promise$_error(fn) {
    return this.caught(originatesFromRejection, fn);
};

Promise.prototype._resolveFromSyncValue =
function Promise$_resolveFromSyncValue(value) {
    if (value === errorObj) {
        this._cleanValues();
        this._setRejected();
        this._settledValue = value.e;
        this._ensurePossibleRejectionHandled();
    } else {
        var maybePromise = cast(value, void 0);
        if (maybePromise instanceof Promise) {
            this._follow(maybePromise);
        } else {
            this._cleanValues();
            this._setFulfilled();
            this._settledValue = value;
        }
    }
};

Promise.method = function Promise$_Method(fn) {
    if (typeof fn !== "function") {
        throw new TypeError("fn must be a function");
    }
    return function Promise$_method() {
        var value;
        switch(arguments.length) {
        case 0: value = tryCatch1(fn, this, void 0); break;
        case 1: value = tryCatch1(fn, this, arguments[0]); break;
        case 2: value = tryCatch2(fn, this, arguments[0], arguments[1]); break;
        default:
            var $_len = arguments.length;var args = new Array($_len); for(var $_i = 0; $_i < $_len; ++$_i) {args[$_i] = arguments[$_i];}
            value = tryCatchApply(fn, args, this); break;
        }
        var ret = new Promise(INTERNAL);
        ret._setTrace(void 0);
        ret._resolveFromSyncValue(value);
        return ret;
    };
};

Promise.attempt = Promise["try"] = function Promise$_Try(fn, args, ctx) {
    if (typeof fn !== "function") {
        return apiRejection("fn must be a function");
    }
    var value = isArray(args)
        ? tryCatchApply(fn, args, ctx)
        : tryCatch1(fn, ctx, args);

    var ret = new Promise(INTERNAL);
    ret._setTrace(void 0);
    ret._resolveFromSyncValue(value);
    return ret;
};

Promise.defer = Promise.pending = function Promise$Defer() {
    var promise = new Promise(INTERNAL);
    promise._setTrace(void 0);
    return new PromiseResolver(promise);
};

Promise.bind = function Promise$Bind(thisArg) {
    var ret = new Promise(INTERNAL);
    ret._setTrace(void 0);
    ret._setFulfilled();
    ret._setBoundTo(thisArg);
    return ret;
};

Promise.cast = function Promise$_Cast(obj) {
    var ret = cast(obj, void 0);
    if (!(ret instanceof Promise)) {
        var val = ret;
        ret = new Promise(INTERNAL);
        ret._setTrace(void 0);
        ret._setFulfilled();
        ret._cleanValues();
        ret._settledValue = val;
    }
    return ret;
};

Promise.resolve = Promise.fulfilled = Promise.cast;

Promise.reject = Promise.rejected = function Promise$Reject(reason) {
    var ret = new Promise(INTERNAL);
    ret._setTrace(void 0);
    markAsOriginatingFromRejection(reason);
    ret._cleanValues();
    ret._setRejected();
    ret._settledValue = reason;
    if (!canAttach(reason)) {
        var trace = new Error(reason + "");
        ret._setCarriedStackTrace(trace);
    }
    ret._ensurePossibleRejectionHandled();
    return ret;
};

Promise.onPossiblyUnhandledRejection =
function Promise$OnPossiblyUnhandledRejection(fn) {
        CapturedTrace.possiblyUnhandledRejection = typeof fn === "function"
                                                    ? fn : void 0;
};

var unhandledRejectionHandled;
Promise.onUnhandledRejectionHandled =
function Promise$onUnhandledRejectionHandled(fn) {
    unhandledRejectionHandled = typeof fn === "function" ? fn : void 0;
};

var debugging = false || !!(
    typeof process !== "undefined" &&
    typeof process.execPath === "string" &&
    typeof process.env === "object" &&
    (process.env["BLUEBIRD_DEBUG"] ||
        process.env["NODE_ENV"] === "development")
);


Promise.longStackTraces = function Promise$LongStackTraces() {
    if (async.haveItemsQueued() &&
        debugging === false
   ) {
        throw new Error("cannot enable long stack traces after promises have been created");
    }
    debugging = CapturedTrace.isSupported();
};

Promise.hasLongStackTraces = function Promise$HasLongStackTraces() {
    return debugging && CapturedTrace.isSupported();
};

Promise.prototype._then =
function Promise$_then(
    didFulfill,
    didReject,
    didProgress,
    receiver,
    internalData
) {
    var haveInternalData = internalData !== void 0;
    var ret = haveInternalData ? internalData : new Promise(INTERNAL);

    if (!haveInternalData) {
        if (debugging) {
            var haveSameContext = this._peekContext() === this._traceParent;
            ret._traceParent = haveSameContext ? this._traceParent : this;
        }
        ret._propagateFrom(this, 7);
    }

    var callbackIndex =
        this._addCallbacks(didFulfill, didReject, didProgress, ret, receiver);

    if (this.isResolved()) {
        async.invoke(this._queueSettleAt, this, callbackIndex);
    }

    return ret;
};

Promise.prototype._length = function Promise$_length() {
    return this._bitField & 262143;
};

Promise.prototype._isFollowingOrFulfilledOrRejected =
function Promise$_isFollowingOrFulfilledOrRejected() {
    return (this._bitField & 939524096) > 0;
};

Promise.prototype._isFollowing = function Promise$_isFollowing() {
    return (this._bitField & 536870912) === 536870912;
};

Promise.prototype._setLength = function Promise$_setLength(len) {
    this._bitField = (this._bitField & -262144) |
        (len & 262143);
};

Promise.prototype._setFulfilled = function Promise$_setFulfilled() {
    this._bitField = this._bitField | 268435456;
};

Promise.prototype._setRejected = function Promise$_setRejected() {
    this._bitField = this._bitField | 134217728;
};

Promise.prototype._setFollowing = function Promise$_setFollowing() {
    this._bitField = this._bitField | 536870912;
};

Promise.prototype._setIsFinal = function Promise$_setIsFinal() {
    this._bitField = this._bitField | 33554432;
};

Promise.prototype._isFinal = function Promise$_isFinal() {
    return (this._bitField & 33554432) > 0;
};

Promise.prototype._cancellable = function Promise$_cancellable() {
    return (this._bitField & 67108864) > 0;
};

Promise.prototype._setCancellable = function Promise$_setCancellable() {
    this._bitField = this._bitField | 67108864;
};

Promise.prototype._unsetCancellable = function Promise$_unsetCancellable() {
    this._bitField = this._bitField & (~67108864);
};

Promise.prototype._setRejectionIsUnhandled =
function Promise$_setRejectionIsUnhandled() {
    this._bitField = this._bitField | 2097152;
};

Promise.prototype._unsetRejectionIsUnhandled =
function Promise$_unsetRejectionIsUnhandled() {
    this._bitField = this._bitField & (~2097152);
    if (this._isUnhandledRejectionNotified()) {
        this._unsetUnhandledRejectionIsNotified();
        this._notifyUnhandledRejectionIsHandled();
    }
};

Promise.prototype._isRejectionUnhandled =
function Promise$_isRejectionUnhandled() {
    return (this._bitField & 2097152) > 0;
};

Promise.prototype._setUnhandledRejectionIsNotified =
function Promise$_setUnhandledRejectionIsNotified() {
    this._bitField = this._bitField | 524288;
};

Promise.prototype._unsetUnhandledRejectionIsNotified =
function Promise$_unsetUnhandledRejectionIsNotified() {
    this._bitField = this._bitField & (~524288);
};

Promise.prototype._isUnhandledRejectionNotified =
function Promise$_isUnhandledRejectionNotified() {
    return (this._bitField & 524288) > 0;
};

Promise.prototype._setCarriedStackTrace =
function Promise$_setCarriedStackTrace(capturedTrace) {
    this._bitField = this._bitField | 1048576;
    this._fulfillmentHandler0 = capturedTrace;
};

Promise.prototype._unsetCarriedStackTrace =
function Promise$_unsetCarriedStackTrace() {
    this._bitField = this._bitField & (~1048576);
    this._fulfillmentHandler0 = void 0;
};

Promise.prototype._isCarryingStackTrace =
function Promise$_isCarryingStackTrace() {
    return (this._bitField & 1048576) > 0;
};

Promise.prototype._getCarriedStackTrace =
function Promise$_getCarriedStackTrace() {
    return this._isCarryingStackTrace()
        ? this._fulfillmentHandler0
        : void 0;
};

Promise.prototype._receiverAt = function Promise$_receiverAt(index) {
    var ret = index === 0
        ? this._receiver0
        : this[(index << 2) + index - 5 + 4];
    if (this._isBound() && ret === void 0) {
        return this._boundTo;
    }
    return ret;
};

Promise.prototype._promiseAt = function Promise$_promiseAt(index) {
    return index === 0
        ? this._promise0
        : this[(index << 2) + index - 5 + 3];
};

Promise.prototype._fulfillmentHandlerAt =
function Promise$_fulfillmentHandlerAt(index) {
    return index === 0
        ? this._fulfillmentHandler0
        : this[(index << 2) + index - 5 + 0];
};

Promise.prototype._rejectionHandlerAt =
function Promise$_rejectionHandlerAt(index) {
    return index === 0
        ? this._rejectionHandler0
        : this[(index << 2) + index - 5 + 1];
};

Promise.prototype._addCallbacks = function Promise$_addCallbacks(
    fulfill,
    reject,
    progress,
    promise,
    receiver
) {
    var index = this._length();

    if (index >= 262143 - 5) {
        index = 0;
        this._setLength(0);
    }

    if (index === 0) {
        this._promise0 = promise;
        if (receiver !== void 0) this._receiver0 = receiver;
        if (typeof fulfill === "function" && !this._isCarryingStackTrace())
            this._fulfillmentHandler0 = fulfill;
        if (typeof reject === "function") this._rejectionHandler0 = reject;
        if (typeof progress === "function") this._progressHandler0 = progress;
    } else {
        var base = (index << 2) + index - 5;
        this[base + 3] = promise;
        this[base + 4] = receiver;
        this[base + 0] = typeof fulfill === "function"
                                            ? fulfill : void 0;
        this[base + 1] = typeof reject === "function"
                                            ? reject : void 0;
        this[base + 2] = typeof progress === "function"
                                            ? progress : void 0;
    }
    this._setLength(index + 1);
    return index;
};

Promise.prototype._setProxyHandlers =
function Promise$_setProxyHandlers(receiver, promiseSlotValue) {
    var index = this._length();

    if (index >= 262143 - 5) {
        index = 0;
        this._setLength(0);
    }
    if (index === 0) {
        this._promise0 = promiseSlotValue;
        this._receiver0 = receiver;
    } else {
        var base = (index << 2) + index - 5;
        this[base + 3] = promiseSlotValue;
        this[base + 4] = receiver;
        this[base + 0] =
        this[base + 1] =
        this[base + 2] = void 0;
    }
    this._setLength(index + 1);
};

Promise.prototype._proxyPromiseArray =
function Promise$_proxyPromiseArray(promiseArray, index) {
    this._setProxyHandlers(promiseArray, index);
};

Promise.prototype._proxyPromise = function Promise$_proxyPromise(promise) {
    promise._setProxied();
    this._setProxyHandlers(promise, -1);
};

Promise.prototype._setBoundTo = function Promise$_setBoundTo(obj) {
    if (obj !== void 0) {
        this._bitField = this._bitField | 8388608;
        this._boundTo = obj;
    } else {
        this._bitField = this._bitField & (~8388608);
    }
};

Promise.prototype._isBound = function Promise$_isBound() {
    return (this._bitField & 8388608) === 8388608;
};

Promise.prototype._resolveFromResolver =
function Promise$_resolveFromResolver(resolver) {
    var promise = this;
    this._setTrace(void 0);
    this._pushContext();

    function Promise$_resolver(val) {
        if (promise._tryFollow(val)) {
            return;
        }
        promise._fulfill(val);
    }
    function Promise$_rejecter(val) {
        var trace = canAttach(val) ? val : new Error(val + "");
        promise._attachExtraTrace(trace);
        markAsOriginatingFromRejection(val);
        promise._reject(val, trace === val ? void 0 : trace);
    }
    var r = tryCatch2(resolver, void 0, Promise$_resolver, Promise$_rejecter);
    this._popContext();

    if (r !== void 0 && r === errorObj) {
        var e = r.e;
        var trace = canAttach(e) ? e : new Error(e + "");
        promise._reject(e, trace);
    }
};

Promise.prototype._spreadSlowCase =
function Promise$_spreadSlowCase(targetFn, promise, values, boundTo) {
    var promiseForAll = new PromiseArray(values).promise();
    var promise2 = promiseForAll._then(function() {
        return targetFn.apply(boundTo, arguments);
    }, void 0, void 0, APPLY, void 0);
    promise._follow(promise2);
};

Promise.prototype._callSpread =
function Promise$_callSpread(handler, promise, value) {
    var boundTo = this._boundTo;
    if (isArray(value)) {
        for (var i = 0, len = value.length; i < len; ++i) {
            if (cast(value[i], void 0) instanceof Promise) {
                this._spreadSlowCase(handler, promise, value, boundTo);
                return;
            }
        }
    }
    promise._pushContext();
    return tryCatchApply(handler, value, boundTo);
};

Promise.prototype._callHandler =
function Promise$_callHandler(
    handler, receiver, promise, value) {
    var x;
    if (receiver === APPLY && !this.isRejected()) {
        x = this._callSpread(handler, promise, value);
    } else {
        promise._pushContext();
        x = tryCatch1(handler, receiver, value);
    }
    promise._popContext();
    return x;
};

Promise.prototype._settlePromiseFromHandler =
function Promise$_settlePromiseFromHandler(
    handler, receiver, value, promise
) {
    if (!(promise instanceof Promise)) {
        handler.call(receiver, value, promise);
        return;
    }
    var x = this._callHandler(handler, receiver, promise, value);
    if (promise._isFollowing()) return;

    if (x === errorObj || x === promise || x === NEXT_FILTER) {
        var err = x === promise
                    ? makeSelfResolutionError()
                    : x.e;
        var trace = canAttach(err) ? err : new Error(err + "");
        if (x !== NEXT_FILTER) promise._attachExtraTrace(trace);
        promise._rejectUnchecked(err, trace);
    } else {
        var castValue = cast(x, promise);
        if (castValue instanceof Promise) {
            if (castValue.isRejected() &&
                !castValue._isCarryingStackTrace() &&
                !canAttach(castValue._settledValue)) {
                var trace = new Error(castValue._settledValue + "");
                promise._attachExtraTrace(trace);
                castValue._setCarriedStackTrace(trace);
            }
            promise._follow(castValue);
            promise._propagateFrom(castValue, 1);
        } else {
            promise._fulfillUnchecked(x);
        }
    }
};

Promise.prototype._follow =
function Promise$_follow(promise) {
    this._setFollowing();

    if (promise.isPending()) {
        this._propagateFrom(promise, 1);
        promise._proxyPromise(this);
    } else if (promise.isFulfilled()) {
        this._fulfillUnchecked(promise._settledValue);
    } else {
        this._rejectUnchecked(promise._settledValue,
            promise._getCarriedStackTrace());
    }

    if (promise._isRejectionUnhandled()) promise._unsetRejectionIsUnhandled();

    if (debugging &&
        promise._traceParent == null) {
        promise._traceParent = this;
    }
};

Promise.prototype._tryFollow =
function Promise$_tryFollow(value) {
    if (this._isFollowingOrFulfilledOrRejected() ||
        value === this) {
        return false;
    }
    var maybePromise = cast(value, void 0);
    if (!(maybePromise instanceof Promise)) {
        return false;
    }
    this._follow(maybePromise);
    return true;
};

Promise.prototype._resetTrace = function Promise$_resetTrace() {
    if (debugging) {
        this._trace = new CapturedTrace(this._peekContext() === void 0);
    }
};

Promise.prototype._setTrace = function Promise$_setTrace(parent) {
    if (debugging) {
        var context = this._peekContext();
        this._traceParent = context;
        var isTopLevel = context === void 0;
        if (parent !== void 0 &&
            parent._traceParent === context) {
            this._trace = parent._trace;
        } else {
            this._trace = new CapturedTrace(isTopLevel);
        }
    }
    return this;
};

Promise.prototype._attachExtraTrace =
function Promise$_attachExtraTrace(error) {
    if (debugging) {
        var promise = this;
        var stack = error.stack;
        stack = typeof stack === "string" ? stack.split("\n") : [];
        CapturedTrace.protectErrorMessageNewlines(stack);
        var headerLineCount = 1;
        var combinedTraces = 1;
        while(promise != null &&
            promise._trace != null) {
            stack = CapturedTrace.combine(
                stack,
                promise._trace.stack.split("\n")
            );
            promise = promise._traceParent;
            combinedTraces++;
        }

        var stackTraceLimit = Error.stackTraceLimit || 10;
        var max = (stackTraceLimit + headerLineCount) * combinedTraces;
        var len = stack.length;
        if (len > max) {
            stack.length = max;
        }

        if (len > 0)
            stack[0] = stack[0].split("\u0002\u0000\u0001").join("\n");

        if (stack.length <= headerLineCount) {
            error.stack = "(No stack trace)";
        } else {
            error.stack = stack.join("\n");
        }
    }
};

Promise.prototype._cleanValues = function Promise$_cleanValues() {
    if (this._cancellable()) {
        this._cancellationParent = void 0;
    }
};

Promise.prototype._propagateFrom =
function Promise$_propagateFrom(parent, flags) {
    if ((flags & 1) > 0 && parent._cancellable()) {
        this._setCancellable();
        this._cancellationParent = parent;
    }
    if ((flags & 4) > 0) {
        this._setBoundTo(parent._boundTo);
    }
    if ((flags & 2) > 0) {
        this._setTrace(parent);
    }
};

Promise.prototype._fulfill = function Promise$_fulfill(value) {
    if (this._isFollowingOrFulfilledOrRejected()) return;
    this._fulfillUnchecked(value);
};

Promise.prototype._reject =
function Promise$_reject(reason, carriedStackTrace) {
    if (this._isFollowingOrFulfilledOrRejected()) return;
    this._rejectUnchecked(reason, carriedStackTrace);
};

Promise.prototype._settlePromiseAt = function Promise$_settlePromiseAt(index) {
    var handler = this.isFulfilled()
        ? this._fulfillmentHandlerAt(index)
        : this._rejectionHandlerAt(index);

    var value = this._settledValue;
    var receiver = this._receiverAt(index);
    var promise = this._promiseAt(index);

    if (typeof handler === "function") {
        this._settlePromiseFromHandler(handler, receiver, value, promise);
    } else {
        var done = false;
        var isFulfilled = this.isFulfilled();
        if (receiver !== void 0) {
            if (receiver instanceof Promise &&
                receiver._isProxied()) {
                receiver._unsetProxied();

                if (isFulfilled) receiver._fulfillUnchecked(value);
                else receiver._rejectUnchecked(value,
                    this._getCarriedStackTrace());
                done = true;
            } else if (receiver instanceof PromiseArray) {
                if (isFulfilled) receiver._promiseFulfilled(value, promise);
                else receiver._promiseRejected(value, promise);
                done = true;
            }
        }

        if (!done) {
            if (isFulfilled) promise._fulfill(value);
            else promise._reject(value, this._getCarriedStackTrace());
        }
    }

    if (index >= 256) {
        this._queueGC();
    }
};

Promise.prototype._isProxied = function Promise$_isProxied() {
    return (this._bitField & 4194304) === 4194304;
};

Promise.prototype._setProxied = function Promise$_setProxied() {
    this._bitField = this._bitField | 4194304;
};

Promise.prototype._unsetProxied = function Promise$_unsetProxied() {
    this._bitField = this._bitField & (~4194304);
};

Promise.prototype._isGcQueued = function Promise$_isGcQueued() {
    return (this._bitField & -1073741824) === -1073741824;
};

Promise.prototype._setGcQueued = function Promise$_setGcQueued() {
    this._bitField = this._bitField | -1073741824;
};

Promise.prototype._unsetGcQueued = function Promise$_unsetGcQueued() {
    this._bitField = this._bitField & (~-1073741824);
};

Promise.prototype._queueGC = function Promise$_queueGC() {
    if (this._isGcQueued()) return;
    this._setGcQueued();
    async.invokeLater(this._gc, this, void 0);
};

Promise.prototype._gc = function Promise$gc() {
    var len = this._length() * 5;
    for (var i = 0; i < len; i++) {
        delete this[i];
    }
    this._setLength(0);
    this._unsetGcQueued();
};

Promise.prototype._queueSettleAt = function Promise$_queueSettleAt(index) {
    if (this._isRejectionUnhandled()) this._unsetRejectionIsUnhandled();
    async.invoke(this._settlePromiseAt, this, index);
};

Promise.prototype._fulfillUnchecked =
function Promise$_fulfillUnchecked(value) {
    if (!this.isPending()) return;
    if (value === this) {
        var err = makeSelfResolutionError();
        this._attachExtraTrace(err);
        return this._rejectUnchecked(err, void 0);
    }
    this._cleanValues();
    this._setFulfilled();
    this._settledValue = value;
    var len = this._length();

    if (len > 0) {
        async.invoke(this._settlePromises, this, len);
    }
};

Promise.prototype._rejectUncheckedCheckError =
function Promise$_rejectUncheckedCheckError(reason) {
    var trace = canAttach(reason) ? reason : new Error(reason + "");
    this._rejectUnchecked(reason, trace === reason ? void 0 : trace);
};

Promise.prototype._rejectUnchecked =
function Promise$_rejectUnchecked(reason, trace) {
    if (!this.isPending()) return;
    if (reason === this) {
        var err = makeSelfResolutionError();
        this._attachExtraTrace(err);
        return this._rejectUnchecked(err);
    }
    this._cleanValues();
    this._setRejected();
    this._settledValue = reason;

    if (this._isFinal()) {
        async.invokeLater(thrower, void 0, trace === void 0 ? reason : trace);
        return;
    }
    var len = this._length();

    if (trace !== void 0) this._setCarriedStackTrace(trace);

    if (len > 0) {
        async.invoke(this._rejectPromises, this, null);
    } else {
        this._ensurePossibleRejectionHandled();
    }
};

Promise.prototype._rejectPromises = function Promise$_rejectPromises() {
    this._settlePromises();
    this._unsetCarriedStackTrace();
};

Promise.prototype._settlePromises = function Promise$_settlePromises() {
    var len = this._length();
    for (var i = 0; i < len; i++) {
        this._settlePromiseAt(i);
    }
};

Promise.prototype._ensurePossibleRejectionHandled =
function Promise$_ensurePossibleRejectionHandled() {
    this._setRejectionIsUnhandled();
    if (CapturedTrace.possiblyUnhandledRejection !== void 0) {
        async.invokeLater(this._notifyUnhandledRejection, this, void 0);
    }
};

Promise.prototype._notifyUnhandledRejectionIsHandled =
function Promise$_notifyUnhandledRejectionIsHandled() {
    if (typeof unhandledRejectionHandled === "function") {
        async.invokeLater(unhandledRejectionHandled, void 0, this);
    }
};

Promise.prototype._notifyUnhandledRejection =
function Promise$_notifyUnhandledRejection() {
    if (this._isRejectionUnhandled()) {
        var reason = this._settledValue;
        var trace = this._getCarriedStackTrace();

        this._setUnhandledRejectionIsNotified();

        if (trace !== void 0) {
            this._unsetCarriedStackTrace();
            reason = trace;
        }
        if (typeof CapturedTrace.possiblyUnhandledRejection === "function") {
            CapturedTrace.possiblyUnhandledRejection(reason, this);
        }
    }
};

var contextStack = [];
Promise.prototype._peekContext = function Promise$_peekContext() {
    var lastIndex = contextStack.length - 1;
    if (lastIndex >= 0) {
        return contextStack[lastIndex];
    }
    return void 0;

};

Promise.prototype._pushContext = function Promise$_pushContext() {
    if (!debugging) return;
    contextStack.push(this);
};

Promise.prototype._popContext = function Promise$_popContext() {
    if (!debugging) return;
    contextStack.pop();
};

Promise.noConflict = function Promise$NoConflict() {
    return noConflict(Promise);
};

Promise.setScheduler = function(fn) {
    if (typeof fn !== "function") throw new TypeError("fn must be a function");
    async._schedule = fn;
};

if (!CapturedTrace.isSupported()) {
    Promise.longStackTraces = function(){};
    debugging = false;
}

Promise._makeSelfResolutionError = makeSelfResolutionError;
require("./finally.js")(Promise, NEXT_FILTER, cast);
require("./direct_resolve.js")(Promise);
require("./synchronous_inspection.js")(Promise);
require("./join.js")(Promise, PromiseArray, cast, INTERNAL);
Promise.RangeError = RangeError;
Promise.CancellationError = CancellationError;
Promise.TimeoutError = TimeoutError;
Promise.TypeError = TypeError;
Promise.OperationalError = OperationalError;
Promise.RejectionError = OperationalError;
Promise.AggregateError = errors.AggregateError;

util.toFastProperties(Promise);
util.toFastProperties(Promise.prototype);
Promise.Promise = Promise;
require('./timers.js')(Promise,INTERNAL,cast);
require('./race.js')(Promise,INTERNAL,cast);
require('./call_get.js')(Promise);
require('./generators.js')(Promise,apiRejection,INTERNAL,cast);
require('./map.js')(Promise,PromiseArray,apiRejection,cast,INTERNAL);
require('./nodeify.js')(Promise);
require('./promisify.js')(Promise,INTERNAL);
require('./props.js')(Promise,PromiseArray,cast);
require('./reduce.js')(Promise,PromiseArray,apiRejection,cast,INTERNAL);
require('./settle.js')(Promise,PromiseArray);
require('./some.js')(Promise,PromiseArray,apiRejection);
require('./progress.js')(Promise,PromiseArray);
require('./cancel.js')(Promise,INTERNAL);
require('./filter.js')(Promise,INTERNAL);
require('./any.js')(Promise,PromiseArray);
require('./each.js')(Promise,INTERNAL);
require('./using.js')(Promise,apiRejection,cast);

Promise.prototype = Promise.prototype;
return Promise;

};

},{"./any.js":1,"./async.js":2,"./call_get.js":4,"./cancel.js":5,"./captured_trace.js":6,"./catch_filter.js":7,"./direct_resolve.js":8,"./each.js":9,"./errors.js":10,"./errors_api_rejection":11,"./filter.js":13,"./finally.js":14,"./generators.js":15,"./join.js":16,"./map.js":17,"./nodeify.js":18,"./progress.js":19,"./promise_array.js":21,"./promise_resolver.js":22,"./promisify.js":23,"./props.js":24,"./race.js":26,"./reduce.js":27,"./settle.js":29,"./some.js":30,"./synchronous_inspection.js":31,"./thenables.js":32,"./timers.js":33,"./using.js":34,"./util.js":35}],21:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, INTERNAL, cast) {
var canAttach = require("./errors.js").canAttach;
var util = require("./util.js");
var isArray = util.isArray;

function toResolutionValue(val) {
    switch(val) {
    case -1: return void 0;
    case -2: return [];
    case -3: return {};
    }
}

function PromiseArray(values) {
    var promise = this._promise = new Promise(INTERNAL);
    var parent = void 0;
    if (values instanceof Promise) {
        parent = values;
        promise._propagateFrom(parent, 1 | 4);
    }
    promise._setTrace(parent);
    this._values = values;
    this._length = 0;
    this._totalResolved = 0;
    this._init(void 0, -2);
}
PromiseArray.prototype.length = function PromiseArray$length() {
    return this._length;
};

PromiseArray.prototype.promise = function PromiseArray$promise() {
    return this._promise;
};

PromiseArray.prototype._init =
function PromiseArray$_init(_, resolveValueIfEmpty) {
    var values = cast(this._values, void 0);
    if (values instanceof Promise) {
        this._values = values;
        values._setBoundTo(this._promise._boundTo);
        if (values.isFulfilled()) {
            values = values._settledValue;
            if (!isArray(values)) {
                var err = new Promise.TypeError("expecting an array, a promise or a thenable");
                this.__hardReject__(err);
                return;
            }
        } else if (values.isPending()) {
            values._then(
                PromiseArray$_init,
                this._reject,
                void 0,
                this,
                resolveValueIfEmpty
           );
            return;
        } else {
            values._unsetRejectionIsUnhandled();
            this._reject(values._settledValue);
            return;
        }
    } else if (!isArray(values)) {
        var err = new Promise.TypeError("expecting an array, a promise or a thenable");
        this.__hardReject__(err);
        return;
    }

    if (values.length === 0) {
        if (resolveValueIfEmpty === -5) {
            this._resolveEmptyArray();
        }
        else {
            this._resolve(toResolutionValue(resolveValueIfEmpty));
        }
        return;
    }
    var len = this.getActualLength(values.length);
    var newLen = len;
    var newValues = this.shouldCopyValues() ? new Array(len) : this._values;
    var isDirectScanNeeded = false;
    for (var i = 0; i < len; ++i) {
        var maybePromise = cast(values[i], void 0);
        if (maybePromise instanceof Promise) {
            if (maybePromise.isPending()) {
                maybePromise._proxyPromiseArray(this, i);
            } else {
                maybePromise._unsetRejectionIsUnhandled();
                isDirectScanNeeded = true;
            }
        } else {
            isDirectScanNeeded = true;
        }
        newValues[i] = maybePromise;
    }
    this._values = newValues;
    this._length = newLen;
    if (isDirectScanNeeded) {
        this._scanDirectValues(len);
    }
};

PromiseArray.prototype._settlePromiseAt =
function PromiseArray$_settlePromiseAt(index) {
    var value = this._values[index];
    if (!(value instanceof Promise)) {
        this._promiseFulfilled(value, index);
    } else if (value.isFulfilled()) {
        this._promiseFulfilled(value._settledValue, index);
    } else if (value.isRejected()) {
        this._promiseRejected(value._settledValue, index);
    }
};

PromiseArray.prototype._scanDirectValues =
function PromiseArray$_scanDirectValues(len) {
    for (var i = 0; i < len; ++i) {
        if (this._isResolved()) {
            break;
        }
        this._settlePromiseAt(i);
    }
};

PromiseArray.prototype._isResolved = function PromiseArray$_isResolved() {
    return this._values === null;
};

PromiseArray.prototype._resolve = function PromiseArray$_resolve(value) {
    this._values = null;
    this._promise._fulfill(value);
};

PromiseArray.prototype.__hardReject__ =
PromiseArray.prototype._reject = function PromiseArray$_reject(reason) {
    this._values = null;
    var trace = canAttach(reason) ? reason : new Error(reason + "");
    this._promise._attachExtraTrace(trace);
    this._promise._reject(reason, trace);
};

PromiseArray.prototype._promiseProgressed =
function PromiseArray$_promiseProgressed(progressValue, index) {
    if (this._isResolved()) return;
    this._promise._progress({
        index: index,
        value: progressValue
    });
};


PromiseArray.prototype._promiseFulfilled =
function PromiseArray$_promiseFulfilled(value, index) {
    if (this._isResolved()) return;
    this._values[index] = value;
    var totalResolved = ++this._totalResolved;
    if (totalResolved >= this._length) {
        this._resolve(this._values);
    }
};

PromiseArray.prototype._promiseRejected =
function PromiseArray$_promiseRejected(reason, index) {
    if (this._isResolved()) return;
    this._totalResolved++;
    this._reject(reason);
};

PromiseArray.prototype.shouldCopyValues =
function PromiseArray$_shouldCopyValues() {
    return true;
};

PromiseArray.prototype.getActualLength =
function PromiseArray$getActualLength(len) {
    return len;
};

return PromiseArray;
};

},{"./errors.js":10,"./util.js":35}],22:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var util = require("./util.js");
var maybeWrapAsError = util.maybeWrapAsError;
var errors = require("./errors.js");
var TimeoutError = errors.TimeoutError;
var OperationalError = errors.OperationalError;
var async = require("./async.js");
var haveGetters = util.haveGetters;
var es5 = require("./es5.js");

function isUntypedError(obj) {
    return obj instanceof Error &&
        es5.getPrototypeOf(obj) === Error.prototype;
}

function wrapAsOperationalError(obj) {
    var ret;
    if (isUntypedError(obj)) {
        ret = new OperationalError(obj);
    } else {
        ret = obj;
    }
    errors.markAsOriginatingFromRejection(ret);
    return ret;
}

function nodebackForPromise(promise) {
    function PromiseResolver$_callback(err, value) {
        if (promise === null) return;

        if (err) {
            var wrapped = wrapAsOperationalError(maybeWrapAsError(err));
            promise._attachExtraTrace(wrapped);
            promise._reject(wrapped);
        } else if (arguments.length > 2) {
            var $_len = arguments.length;var args = new Array($_len - 1); for(var $_i = 1; $_i < $_len; ++$_i) {args[$_i - 1] = arguments[$_i];}
            promise._fulfill(args);
        } else {
            promise._fulfill(value);
        }

        promise = null;
    }
    return PromiseResolver$_callback;
}


var PromiseResolver;
if (!haveGetters) {
    PromiseResolver = function PromiseResolver(promise) {
        this.promise = promise;
        this.asCallback = nodebackForPromise(promise);
        this.callback = this.asCallback;
    };
}
else {
    PromiseResolver = function PromiseResolver(promise) {
        this.promise = promise;
    };
}
if (haveGetters) {
    var prop = {
        get: function() {
            return nodebackForPromise(this.promise);
        }
    };
    es5.defineProperty(PromiseResolver.prototype, "asCallback", prop);
    es5.defineProperty(PromiseResolver.prototype, "callback", prop);
}

PromiseResolver._nodebackForPromise = nodebackForPromise;

PromiseResolver.prototype.toString = function PromiseResolver$toString() {
    return "[object PromiseResolver]";
};

PromiseResolver.prototype.resolve =
PromiseResolver.prototype.fulfill = function PromiseResolver$resolve(value) {
    if (!(this instanceof PromiseResolver)) {
        throw new TypeError("Illegal invocation, resolver resolve/reject must be called within a resolver context. Consider using the promise constructor instead.");
    }

    var promise = this.promise;
    if (promise._tryFollow(value)) {
        return;
    }
    async.invoke(promise._fulfill, promise, value);
};

PromiseResolver.prototype.reject = function PromiseResolver$reject(reason) {
    if (!(this instanceof PromiseResolver)) {
        throw new TypeError("Illegal invocation, resolver resolve/reject must be called within a resolver context. Consider using the promise constructor instead.");
    }

    var promise = this.promise;
    errors.markAsOriginatingFromRejection(reason);
    var trace = errors.canAttach(reason) ? reason : new Error(reason + "");
    promise._attachExtraTrace(trace);
    async.invoke(promise._reject, promise, reason);
    if (trace !== reason) {
        async.invoke(this._setCarriedStackTrace, this, trace);
    }
};

PromiseResolver.prototype.progress =
function PromiseResolver$progress(value) {
    if (!(this instanceof PromiseResolver)) {
        throw new TypeError("Illegal invocation, resolver resolve/reject must be called within a resolver context. Consider using the promise constructor instead.");
    }
    async.invoke(this.promise._progress, this.promise, value);
};

PromiseResolver.prototype.cancel = function PromiseResolver$cancel() {
    async.invoke(this.promise.cancel, this.promise, void 0);
};

PromiseResolver.prototype.timeout = function PromiseResolver$timeout() {
    this.reject(new TimeoutError("timeout"));
};

PromiseResolver.prototype.isResolved = function PromiseResolver$isResolved() {
    return this.promise.isResolved();
};

PromiseResolver.prototype.toJSON = function PromiseResolver$toJSON() {
    return this.promise.toJSON();
};

PromiseResolver.prototype._setCarriedStackTrace =
function PromiseResolver$_setCarriedStackTrace(trace) {
    if (this.promise.isRejected()) {
        this.promise._setCarriedStackTrace(trace);
    }
};

module.exports = PromiseResolver;

},{"./async.js":2,"./errors.js":10,"./es5.js":12,"./util.js":35}],23:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, INTERNAL) {
var THIS = {};
var util = require("./util.js");
var nodebackForPromise = require("./promise_resolver.js")
    ._nodebackForPromise;
var withAppended = util.withAppended;
var maybeWrapAsError = util.maybeWrapAsError;
var canEvaluate = util.canEvaluate;
var TypeError = require("./errors").TypeError;
var defaultSuffix = "Async";
var defaultFilter = function(name, func) {
    return util.isIdentifier(name) &&
        name.charAt(0) !== "_" &&
        !util.isClass(func);
};
var defaultPromisified = {__isPromisified__: true};


function escapeIdentRegex(str) {
    return str.replace(/([$])/, "\\$");
}

function isPromisified(fn) {
    try {
        return fn.__isPromisified__ === true;
    }
    catch (e) {
        return false;
    }
}

function hasPromisified(obj, key, suffix) {
    var val = util.getDataPropertyOrDefault(obj, key + suffix,
                                            defaultPromisified);
    return val ? isPromisified(val) : false;
}
function checkValid(ret, suffix, suffixRegexp) {
    for (var i = 0; i < ret.length; i += 2) {
        var key = ret[i];
        if (suffixRegexp.test(key)) {
            var keyWithoutAsyncSuffix = key.replace(suffixRegexp, "");
            for (var j = 0; j < ret.length; j += 2) {
                if (ret[j] === keyWithoutAsyncSuffix) {
                    throw new TypeError("Cannot promisify an API " +
                        "that has normal methods with '"+suffix+"'-suffix");
                }
            }
        }
    }
}

function promisifiableMethods(obj, suffix, suffixRegexp, filter) {
    var keys = util.inheritedDataKeys(obj);
    var ret = [];
    for (var i = 0; i < keys.length; ++i) {
        var key = keys[i];
        var value = obj[key];
        if (typeof value === "function" &&
            !isPromisified(value) &&
            !hasPromisified(obj, key, suffix) &&
            filter(key, value, obj)) {
            ret.push(key, value);
        }
    }
    checkValid(ret, suffix, suffixRegexp);
    return ret;
}

function switchCaseArgumentOrder(likelyArgumentCount) {
    var ret = [likelyArgumentCount];
    var min = Math.max(0, likelyArgumentCount - 1 - 5);
    for(var i = likelyArgumentCount - 1; i >= min; --i) {
        if (i === likelyArgumentCount) continue;
        ret.push(i);
    }
    for(var i = likelyArgumentCount + 1; i <= 5; ++i) {
        ret.push(i);
    }
    return ret;
}

function argumentSequence(argumentCount) {
    return util.filledRange(argumentCount, "arguments[", "]");
}

function parameterDeclaration(parameterCount) {
    return util.filledRange(parameterCount, "_arg", "");
}

function parameterCount(fn) {
    if (typeof fn.length === "number") {
        return Math.max(Math.min(fn.length, 1023 + 1), 0);
    }
    return 0;
}

function generatePropertyAccess(key) {
    if (util.isIdentifier(key)) {
        return "." + key;
    }
    else return "['" + key.replace(/(['\\])/g, "\\$1") + "']";
}

function makeNodePromisifiedEval(callback, receiver, originalName, fn, suffix) {
    var newParameterCount = Math.max(0, parameterCount(fn) - 1);
    var argumentOrder = switchCaseArgumentOrder(newParameterCount);
    var callbackName =
        (typeof originalName === "string" && util.isIdentifier(originalName)
            ? originalName + suffix
            : "promisified");

    function generateCallForArgumentCount(count) {
        var args = argumentSequence(count).join(", ");
        var comma = count > 0 ? ", " : "";
        var ret;
        if (typeof callback === "string") {
            ret = "                                                          \n\
                this.method(args, fn);                                       \n\
                break;                                                       \n\
            ".replace(".method", generatePropertyAccess(callback));
        } else if (receiver === THIS) {
            ret =  "                                                         \n\
                callback.call(this, args, fn);                               \n\
                break;                                                       \n\
            ";
        } else if (receiver !== void 0) {
            ret =  "                                                         \n\
                callback.call(receiver, args, fn);                           \n\
                break;                                                       \n\
            ";
        } else {
            ret =  "                                                         \n\
                callback(args, fn);                                          \n\
                break;                                                       \n\
            ";
        }
        return ret.replace("args", args).replace(", ", comma);
    }

    function generateArgumentSwitchCase() {
        var ret = "";
        for(var i = 0; i < argumentOrder.length; ++i) {
            ret += "case " + argumentOrder[i] +":" +
                generateCallForArgumentCount(argumentOrder[i]);
        }
        var codeForCall;
        if (typeof callback === "string") {
            codeForCall = "                                                  \n\
                this.property.apply(this, args);                             \n\
            "
                .replace(".property", generatePropertyAccess(callback));
        } else if (receiver === THIS) {
            codeForCall = "                                                  \n\
                callback.apply(this, args);                                  \n\
            ";
        } else {
            codeForCall = "                                                  \n\
                callback.apply(receiver, args);                              \n\
            ";
        }

        ret += "                                                             \n\
        default:                                                             \n\
            var args = new Array(len + 1);                                   \n\
            var i = 0;                                                       \n\
            for (var i = 0; i < len; ++i) {                                  \n\
               args[i] = arguments[i];                                       \n\
            }                                                                \n\
            args[i] = fn;                                                    \n\
            [CodeForCall]                                                    \n\
            break;                                                           \n\
        ".replace("[CodeForCall]", codeForCall);
        return ret;
    }

    return new Function("Promise",
                        "callback",
                        "receiver",
                        "withAppended",
                        "maybeWrapAsError",
                        "nodebackForPromise",
                        "INTERNAL","                                         \n\
        var ret = function FunctionName(Parameters) {                        \n\
            'use strict';                                                    \n\
            var len = arguments.length;                                      \n\
            var promise = new Promise(INTERNAL);                             \n\
            promise._setTrace(void 0);                                       \n\
            var fn = nodebackForPromise(promise);                            \n\
            try {                                                            \n\
                switch(len) {                                                \n\
                    [CodeForSwitchCase]                                      \n\
                }                                                            \n\
            } catch (e) {                                                    \n\
                var wrapped = maybeWrapAsError(e);                           \n\
                promise._attachExtraTrace(wrapped);                          \n\
                promise._reject(wrapped);                                    \n\
            }                                                                \n\
            return promise;                                                  \n\
        };                                                                   \n\
        ret.__isPromisified__ = true;                                        \n\
        return ret;                                                          \n\
        "
        .replace("FunctionName", callbackName)
        .replace("Parameters", parameterDeclaration(newParameterCount))
        .replace("[CodeForSwitchCase]", generateArgumentSwitchCase()))(
            Promise,
            callback,
            receiver,
            withAppended,
            maybeWrapAsError,
            nodebackForPromise,
            INTERNAL
        );
}

function makeNodePromisifiedClosure(callback, receiver) {
    function promisified() {
        var _receiver = receiver;
        if (receiver === THIS) _receiver = this;
        if (typeof callback === "string") {
            callback = _receiver[callback];
        }
        var promise = new Promise(INTERNAL);
        promise._setTrace(void 0);
        var fn = nodebackForPromise(promise);
        try {
            callback.apply(_receiver, withAppended(arguments, fn));
        } catch(e) {
            var wrapped = maybeWrapAsError(e);
            promise._attachExtraTrace(wrapped);
            promise._reject(wrapped);
        }
        return promise;
    }
    promisified.__isPromisified__ = true;
    return promisified;
}

var makeNodePromisified = canEvaluate
    ? makeNodePromisifiedEval
    : makeNodePromisifiedClosure;

function promisifyAll(obj, suffix, filter, promisifier) {
    var suffixRegexp = new RegExp(escapeIdentRegex(suffix) + "$");
    var methods =
        promisifiableMethods(obj, suffix, suffixRegexp, filter);

    for (var i = 0, len = methods.length; i < len; i+= 2) {
        var key = methods[i];
        var fn = methods[i+1];
        var promisifiedKey = key + suffix;
        obj[promisifiedKey] = promisifier === makeNodePromisified
                ? makeNodePromisified(key, THIS, key, fn, suffix)
                : promisifier(fn);
    }
    util.toFastProperties(obj);
    return obj;
}

function promisify(callback, receiver) {
    return makeNodePromisified(callback, receiver, void 0, callback);
}

Promise.promisify = function Promise$Promisify(fn, receiver) {
    if (typeof fn !== "function") {
        throw new TypeError("fn must be a function");
    }
    if (isPromisified(fn)) {
        return fn;
    }
    return promisify(fn, arguments.length < 2 ? THIS : receiver);
};

Promise.promisifyAll = function Promise$PromisifyAll(target, options) {
    if (typeof target !== "function" && typeof target !== "object") {
        throw new TypeError("the target of promisifyAll must be an object or a function");
    }
    options = Object(options);
    var suffix = options.suffix;
    if (typeof suffix !== "string") suffix = defaultSuffix;
    var filter = options.filter;
    if (typeof filter !== "function") filter = defaultFilter;
    var promisifier = options.promisifier;
    if (typeof promisifier !== "function") promisifier = makeNodePromisified;

    if (!util.isIdentifier(suffix)) {
        throw new RangeError("suffix must be a valid identifier");
    }

    var keys = util.inheritedDataKeys(target, {includeHidden: true});
    for (var i = 0; i < keys.length; ++i) {
        var value = target[keys[i]];
        if (keys[i] !== "constructor" &&
            util.isClass(value)) {
            promisifyAll(value.prototype, suffix, filter, promisifier);
            promisifyAll(value, suffix, filter, promisifier);
        }
    }

    return promisifyAll(target, suffix, filter, promisifier);
};
};


},{"./errors":10,"./promise_resolver.js":22,"./util.js":35}],24:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, PromiseArray, cast) {
var util = require("./util.js");
var apiRejection = require("./errors_api_rejection")(Promise);
var isObject = util.isObject;
var es5 = require("./es5.js");

function PropertiesPromiseArray(obj) {
    var keys = es5.keys(obj);
    var len = keys.length;
    var values = new Array(len * 2);
    for (var i = 0; i < len; ++i) {
        var key = keys[i];
        values[i] = obj[key];
        values[i + len] = key;
    }
    this.constructor$(values);
}
util.inherits(PropertiesPromiseArray, PromiseArray);

PropertiesPromiseArray.prototype._init =
function PropertiesPromiseArray$_init() {
    this._init$(void 0, -3) ;
};

PropertiesPromiseArray.prototype._promiseFulfilled =
function PropertiesPromiseArray$_promiseFulfilled(value, index) {
    if (this._isResolved()) return;
    this._values[index] = value;
    var totalResolved = ++this._totalResolved;
    if (totalResolved >= this._length) {
        var val = {};
        var keyOffset = this.length();
        for (var i = 0, len = this.length(); i < len; ++i) {
            val[this._values[i + keyOffset]] = this._values[i];
        }
        this._resolve(val);
    }
};

PropertiesPromiseArray.prototype._promiseProgressed =
function PropertiesPromiseArray$_promiseProgressed(value, index) {
    if (this._isResolved()) return;

    this._promise._progress({
        key: this._values[index + this.length()],
        value: value
    });
};

PropertiesPromiseArray.prototype.shouldCopyValues =
function PropertiesPromiseArray$_shouldCopyValues() {
    return false;
};

PropertiesPromiseArray.prototype.getActualLength =
function PropertiesPromiseArray$getActualLength(len) {
    return len >> 1;
};

function Promise$_Props(promises) {
    var ret;
    var castValue = cast(promises, void 0);

    if (!isObject(castValue)) {
        return apiRejection("cannot await properties of a non-object");
    } else if (castValue instanceof Promise) {
        ret = castValue._then(Promise.props, void 0, void 0, void 0, void 0);
    } else {
        ret = new PropertiesPromiseArray(castValue).promise();
    }

    if (castValue instanceof Promise) {
        ret._propagateFrom(castValue, 4);
    }
    return ret;
}

Promise.prototype.props = function Promise$props() {
    return Promise$_Props(this);
};

Promise.props = function Promise$Props(promises) {
    return Promise$_Props(promises);
};
};

},{"./errors_api_rejection":11,"./es5.js":12,"./util.js":35}],25:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
function arrayCopy(src, srcIndex, dst, dstIndex, len) {
    for (var j = 0; j < len; ++j) {
        dst[j + dstIndex] = src[j + srcIndex];
    }
}

function Queue(capacity) {
    this._capacity = capacity;
    this._length = 0;
    this._front = 0;
    this._makeCapacity();
}

Queue.prototype._willBeOverCapacity =
function Queue$_willBeOverCapacity(size) {
    return this._capacity < size;
};

Queue.prototype._pushOne = function Queue$_pushOne(arg) {
    var length = this.length();
    this._checkCapacity(length + 1);
    var i = (this._front + length) & (this._capacity - 1);
    this[i] = arg;
    this._length = length + 1;
};

Queue.prototype.push = function Queue$push(fn, receiver, arg) {
    var length = this.length() + 3;
    if (this._willBeOverCapacity(length)) {
        this._pushOne(fn);
        this._pushOne(receiver);
        this._pushOne(arg);
        return;
    }
    var j = this._front + length - 3;
    this._checkCapacity(length);
    var wrapMask = this._capacity - 1;
    this[(j + 0) & wrapMask] = fn;
    this[(j + 1) & wrapMask] = receiver;
    this[(j + 2) & wrapMask] = arg;
    this._length = length;
};

Queue.prototype.shift = function Queue$shift() {
    var front = this._front,
        ret = this[front];

    this[front] = void 0;
    this._front = (front + 1) & (this._capacity - 1);
    this._length--;
    return ret;
};

Queue.prototype.length = function Queue$length() {
    return this._length;
};

Queue.prototype._makeCapacity = function Queue$_makeCapacity() {
    var len = this._capacity;
    for (var i = 0; i < len; ++i) {
        this[i] = void 0;
    }
};

Queue.prototype._checkCapacity = function Queue$_checkCapacity(size) {
    if (this._capacity < size) {
        this._resizeTo(this._capacity << 3);
    }
};

Queue.prototype._resizeTo = function Queue$_resizeTo(capacity) {
    var oldFront = this._front;
    var oldCapacity = this._capacity;
    var oldQueue = new Array(oldCapacity);
    var length = this.length();

    arrayCopy(this, 0, oldQueue, 0, oldCapacity);
    this._capacity = capacity;
    this._makeCapacity();
    this._front = 0;
    if (oldFront + length <= oldCapacity) {
        arrayCopy(oldQueue, oldFront, this, 0, length);
    } else {        var lengthBeforeWrapping =
            length - ((oldFront + length) & (oldCapacity - 1));

        arrayCopy(oldQueue, oldFront, this, 0, lengthBeforeWrapping);
        arrayCopy(oldQueue, 0, this, lengthBeforeWrapping,
                    length - lengthBeforeWrapping);
    }
};

module.exports = Queue;

},{}],26:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, INTERNAL, cast) {
var apiRejection = require("./errors_api_rejection.js")(Promise);
var isArray = require("./util.js").isArray;

var raceLater = function Promise$_raceLater(promise) {
    return promise.then(function(array) {
        return Promise$_Race(array, promise);
    });
};

var hasOwn = {}.hasOwnProperty;
function Promise$_Race(promises, parent) {
    var maybePromise = cast(promises, void 0);

    if (maybePromise instanceof Promise) {
        return raceLater(maybePromise);
    } else if (!isArray(promises)) {
        return apiRejection("expecting an array, a promise or a thenable");
    }

    var ret = new Promise(INTERNAL);
    if (parent !== void 0) {
        ret._propagateFrom(parent, 7);
    } else {
        ret._setTrace(void 0);
    }
    var fulfill = ret._fulfill;
    var reject = ret._reject;
    for (var i = 0, len = promises.length; i < len; ++i) {
        var val = promises[i];

        if (val === void 0 && !(hasOwn.call(promises, i))) {
            continue;
        }

        Promise.cast(val)._then(fulfill, reject, void 0, ret, null);
    }
    return ret;
}

Promise.race = function Promise$Race(promises) {
    return Promise$_Race(promises, void 0);
};

Promise.prototype.race = function Promise$race() {
    return Promise$_Race(this, void 0);
};

};

},{"./errors_api_rejection.js":11,"./util.js":35}],27:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, PromiseArray, apiRejection, cast, INTERNAL) {
var util = require("./util.js");
var tryCatch4 = util.tryCatch4;
var tryCatch3 = util.tryCatch3;
var errorObj = util.errorObj;
function ReductionPromiseArray(promises, fn, accum, _each) {
    this.constructor$(promises);
    this._preservedValues = _each === INTERNAL ? [] : null;
    this._zerothIsAccum = (accum === void 0);
    this._gotAccum = false;
    this._reducingIndex = (this._zerothIsAccum ? 1 : 0);
    this._valuesPhase = undefined;

    var maybePromise = cast(accum, void 0);
    var rejected = false;
    var isPromise = maybePromise instanceof Promise;
    if (isPromise) {
        if (maybePromise.isPending()) {
            maybePromise._proxyPromiseArray(this, -1);
        } else if (maybePromise.isFulfilled()) {
            accum = maybePromise.value();
            this._gotAccum = true;
        } else {
            maybePromise._unsetRejectionIsUnhandled();
            this._reject(maybePromise.reason());
            rejected = true;
        }
    }
    if (!(isPromise || this._zerothIsAccum)) this._gotAccum = true;
    this._callback = fn;
    this._accum = accum;
    if (!rejected) this._init$(void 0, -5);
}
util.inherits(ReductionPromiseArray, PromiseArray);

ReductionPromiseArray.prototype._init =
function ReductionPromiseArray$_init() {};

ReductionPromiseArray.prototype._resolveEmptyArray =
function ReductionPromiseArray$_resolveEmptyArray() {
    if (this._gotAccum || this._zerothIsAccum) {
        this._resolve(this._preservedValues !== null
                        ? [] : this._accum);
    }
};

ReductionPromiseArray.prototype._promiseFulfilled =
function ReductionPromiseArray$_promiseFulfilled(value, index) {
    var values = this._values;
    if (values === null) return;
    var length = this.length();
    var preservedValues = this._preservedValues;
    var isEach = preservedValues !== null;
    var gotAccum = this._gotAccum;
    var valuesPhase = this._valuesPhase;
    var valuesPhaseIndex;
    if (!valuesPhase) {
        valuesPhase = this._valuesPhase = Array(length);
        for (valuesPhaseIndex=0; valuesPhaseIndex<length; ++valuesPhaseIndex) {
            valuesPhase[valuesPhaseIndex] = 0;
        }
    }
    valuesPhaseIndex = valuesPhase[index];

    if (index === 0 && this._zerothIsAccum) {
        if (!gotAccum) {
            this._accum = value;
            this._gotAccum = gotAccum = true;
        }
        valuesPhase[index] = ((valuesPhaseIndex === 0)
            ? 1 : 2);
    } else if (index === -1) {
        if (!gotAccum) {
            this._accum = value;
            this._gotAccum = gotAccum = true;
        }
    } else {
        if (valuesPhaseIndex === 0) {
            valuesPhase[index] = 1;
        }
        else {
            valuesPhase[index] = 2;
            if (gotAccum) {
                this._accum = value;
            }
        }
    }
    if (!gotAccum) return;

    var callback = this._callback;
    var receiver = this._promise._boundTo;
    var ret;

    for (var i = this._reducingIndex; i < length; ++i) {
        valuesPhaseIndex = valuesPhase[i];
        if (valuesPhaseIndex === 2) {
            this._reducingIndex = i + 1;
            continue;
        }
        if (valuesPhaseIndex !== 1) return;

        value = values[i];
        if (value instanceof Promise) {
            if (value.isFulfilled()) {
                value = value._settledValue;
            } else if (value.isPending()) {
                return;
            } else {
                value._unsetRejectionIsUnhandled();
                return this._reject(value.reason());
            }
        }

        if (isEach) {
            preservedValues.push(value);
            ret = tryCatch3(callback, receiver, value, i, length);
        }
        else {
            ret = tryCatch4(callback, receiver, this._accum, value, i, length);
        }

        if (ret === errorObj) return this._reject(ret.e);

        var maybePromise = cast(ret, void 0);
        if (maybePromise instanceof Promise) {
            if (maybePromise.isPending()) {
                valuesPhase[i] = 4;
                return maybePromise._proxyPromiseArray(this, i);
            } else if (maybePromise.isFulfilled()) {
                ret = maybePromise.value();
            } else {
                maybePromise._unsetRejectionIsUnhandled();
                return this._reject(maybePromise.reason());
            }
        }

        this._reducingIndex = i + 1;
        this._accum = ret;
    }

    if (this._reducingIndex < length) return;
    this._resolve(isEach ? preservedValues : this._accum);
};

function reduce(promises, fn, initialValue, _each) {
    if (typeof fn !== "function") return apiRejection("fn must be a function");
    var array = new ReductionPromiseArray(promises, fn, initialValue, _each);
    return array.promise();
}

Promise.prototype.reduce = function Promise$reduce(fn, initialValue) {
    return reduce(this, fn, initialValue, null);
};

Promise.reduce = function Promise$Reduce(promises, fn, initialValue, _each) {
    return reduce(promises, fn, initialValue, _each);
};
};

},{"./util.js":35}],28:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var schedule;
var _MutationObserver;
if (typeof process === "object" && typeof process.version === "string") {
    schedule = function Promise$_Scheduler(fn) {
        process.nextTick(fn);
    };
}
else if ((typeof MutationObserver !== "undefined" &&
         (_MutationObserver = MutationObserver)) ||
         (typeof WebKitMutationObserver !== "undefined" &&
         (_MutationObserver = WebKitMutationObserver))) {
    schedule = (function() {
        var div = document.createElement("div");
        var queuedFn = void 0;
        var observer = new _MutationObserver(
            function Promise$_Scheduler() {
                var fn = queuedFn;
                queuedFn = void 0;
                fn();
            }
       );
        observer.observe(div, {
            attributes: true
        });
        return function Promise$_Scheduler(fn) {
            queuedFn = fn;
            div.setAttribute("class", "foo");
        };

    })();
}
else if (typeof setTimeout !== "undefined") {
    schedule = function Promise$_Scheduler(fn) {
        setTimeout(fn, 0);
    };
}
else throw new Error("no async scheduler available");
module.exports = schedule;

},{}],29:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports =
    function(Promise, PromiseArray) {
var PromiseInspection = Promise.PromiseInspection;
var util = require("./util.js");

function SettledPromiseArray(values) {
    this.constructor$(values);
}
util.inherits(SettledPromiseArray, PromiseArray);

SettledPromiseArray.prototype._promiseResolved =
function SettledPromiseArray$_promiseResolved(index, inspection) {
    this._values[index] = inspection;
    var totalResolved = ++this._totalResolved;
    if (totalResolved >= this._length) {
        this._resolve(this._values);
    }
};

SettledPromiseArray.prototype._promiseFulfilled =
function SettledPromiseArray$_promiseFulfilled(value, index) {
    if (this._isResolved()) return;
    var ret = new PromiseInspection();
    ret._bitField = 268435456;
    ret._settledValue = value;
    this._promiseResolved(index, ret);
};
SettledPromiseArray.prototype._promiseRejected =
function SettledPromiseArray$_promiseRejected(reason, index) {
    if (this._isResolved()) return;
    var ret = new PromiseInspection();
    ret._bitField = 134217728;
    ret._settledValue = reason;
    this._promiseResolved(index, ret);
};

Promise.settle = function Promise$Settle(promises) {
    return new SettledPromiseArray(promises).promise();
};

Promise.prototype.settle = function Promise$settle() {
    return new SettledPromiseArray(this).promise();
};
};

},{"./util.js":35}],30:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports =
function(Promise, PromiseArray, apiRejection) {
var util = require("./util.js");
var RangeError = require("./errors.js").RangeError;
var AggregateError = require("./errors.js").AggregateError;
var isArray = util.isArray;


function SomePromiseArray(values) {
    this.constructor$(values);
    this._howMany = 0;
    this._unwrap = false;
    this._initialized = false;
}
util.inherits(SomePromiseArray, PromiseArray);

SomePromiseArray.prototype._init = function SomePromiseArray$_init() {
    if (!this._initialized) {
        return;
    }
    if (this._howMany === 0) {
        this._resolve([]);
        return;
    }
    this._init$(void 0, -5);
    var isArrayResolved = isArray(this._values);
    if (!this._isResolved() &&
        isArrayResolved &&
        this._howMany > this._canPossiblyFulfill()) {
        this._reject(this._getRangeError(this.length()));
    }
};

SomePromiseArray.prototype.init = function SomePromiseArray$init() {
    this._initialized = true;
    this._init();
};

SomePromiseArray.prototype.setUnwrap = function SomePromiseArray$setUnwrap() {
    this._unwrap = true;
};

SomePromiseArray.prototype.howMany = function SomePromiseArray$howMany() {
    return this._howMany;
};

SomePromiseArray.prototype.setHowMany =
function SomePromiseArray$setHowMany(count) {
    if (this._isResolved()) return;
    this._howMany = count;
};

SomePromiseArray.prototype._promiseFulfilled =
function SomePromiseArray$_promiseFulfilled(value) {
    if (this._isResolved()) return;
    this._addFulfilled(value);
    if (this._fulfilled() === this.howMany()) {
        this._values.length = this.howMany();
        if (this.howMany() === 1 && this._unwrap) {
            this._resolve(this._values[0]);
        } else {
            this._resolve(this._values);
        }
    }

};
SomePromiseArray.prototype._promiseRejected =
function SomePromiseArray$_promiseRejected(reason) {
    if (this._isResolved()) return;
    this._addRejected(reason);
    if (this.howMany() > this._canPossiblyFulfill()) {
        var e = new AggregateError();
        for (var i = this.length(); i < this._values.length; ++i) {
            e.push(this._values[i]);
        }
        this._reject(e);
    }
};

SomePromiseArray.prototype._fulfilled = function SomePromiseArray$_fulfilled() {
    return this._totalResolved;
};

SomePromiseArray.prototype._rejected = function SomePromiseArray$_rejected() {
    return this._values.length - this.length();
};

SomePromiseArray.prototype._addRejected =
function SomePromiseArray$_addRejected(reason) {
    this._values.push(reason);
};

SomePromiseArray.prototype._addFulfilled =
function SomePromiseArray$_addFulfilled(value) {
    this._values[this._totalResolved++] = value;
};

SomePromiseArray.prototype._canPossiblyFulfill =
function SomePromiseArray$_canPossiblyFulfill() {
    return this.length() - this._rejected();
};

SomePromiseArray.prototype._getRangeError =
function SomePromiseArray$_getRangeError(count) {
    var message = "Input array must contain at least " +
            this._howMany + " items but contains only " + count + " items";
    return new RangeError(message);
};

SomePromiseArray.prototype._resolveEmptyArray =
function SomePromiseArray$_resolveEmptyArray() {
    this._reject(this._getRangeError(0));
};

function Promise$_Some(promises, howMany) {
    if ((howMany | 0) !== howMany || howMany < 0) {
        return apiRejection("expecting a positive integer");
    }
    var ret = new SomePromiseArray(promises);
    var promise = ret.promise();
    if (promise.isRejected()) {
        return promise;
    }
    ret.setHowMany(howMany);
    ret.init();
    return promise;
}

Promise.some = function Promise$Some(promises, howMany) {
    return Promise$_Some(promises, howMany);
};

Promise.prototype.some = function Promise$some(howMany) {
    return Promise$_Some(this, howMany);
};

Promise._SomePromiseArray = SomePromiseArray;
};

},{"./errors.js":10,"./util.js":35}],31:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise) {
function PromiseInspection(promise) {
    if (promise !== void 0) {
        this._bitField = promise._bitField;
        this._settledValue = promise.isResolved()
            ? promise._settledValue
            : void 0;
    }
    else {
        this._bitField = 0;
        this._settledValue = void 0;
    }
}

PromiseInspection.prototype.isFulfilled =
Promise.prototype.isFulfilled = function Promise$isFulfilled() {
    return (this._bitField & 268435456) > 0;
};

PromiseInspection.prototype.isRejected =
Promise.prototype.isRejected = function Promise$isRejected() {
    return (this._bitField & 134217728) > 0;
};

PromiseInspection.prototype.isPending =
Promise.prototype.isPending = function Promise$isPending() {
    return (this._bitField & 402653184) === 0;
};

PromiseInspection.prototype.value =
Promise.prototype.value = function Promise$value() {
    if (!this.isFulfilled()) {
        throw new TypeError("cannot get fulfillment value of a non-fulfilled promise");
    }
    return this._settledValue;
};

PromiseInspection.prototype.error =
PromiseInspection.prototype.reason =
Promise.prototype.reason = function Promise$reason() {
    if (!this.isRejected()) {
        throw new TypeError("cannot get rejection reason of a non-rejected promise");
    }
    return this._settledValue;
};

PromiseInspection.prototype.isResolved =
Promise.prototype.isResolved = function Promise$isResolved() {
    return (this._bitField & 402653184) > 0;
};

Promise.PromiseInspection = PromiseInspection;
};

},{}],32:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, INTERNAL) {
var util = require("./util.js");
var canAttach = require("./errors.js").canAttach;
var errorObj = util.errorObj;
var isObject = util.isObject;

function getThen(obj) {
    try {
        return obj.then;
    }
    catch(e) {
        errorObj.e = e;
        return errorObj;
    }
}

function Promise$_Cast(obj, originalPromise) {
    if (isObject(obj)) {
        if (obj instanceof Promise) {
            return obj;
        }
        else if (isAnyBluebirdPromise(obj)) {
            var ret = new Promise(INTERNAL);
            ret._setTrace(void 0);
            obj._then(
                ret._fulfillUnchecked,
                ret._rejectUncheckedCheckError,
                ret._progressUnchecked,
                ret,
                null
            );
            ret._setFollowing();
            return ret;
        }
        var then = getThen(obj);
        if (then === errorObj) {
            if (originalPromise !== void 0 && canAttach(then.e)) {
                originalPromise._attachExtraTrace(then.e);
            }
            return Promise.reject(then.e);
        } else if (typeof then === "function") {
            return Promise$_doThenable(obj, then, originalPromise);
        }
    }
    return obj;
}

var hasProp = {}.hasOwnProperty;
function isAnyBluebirdPromise(obj) {
    return hasProp.call(obj, "_promise0");
}

function Promise$_doThenable(x, then, originalPromise) {
    var resolver = Promise.defer();
    var called = false;
    try {
        then.call(
            x,
            Promise$_resolveFromThenable,
            Promise$_rejectFromThenable,
            Promise$_progressFromThenable
        );
    } catch(e) {
        if (!called) {
            called = true;
            var trace = canAttach(e) ? e : new Error(e + "");
            if (originalPromise !== void 0) {
                originalPromise._attachExtraTrace(trace);
            }
            resolver.promise._reject(e, trace);
        }
    }
    return resolver.promise;

    function Promise$_resolveFromThenable(y) {
        if (called) return;
        called = true;

        if (x === y) {
            var e = Promise._makeSelfResolutionError();
            if (originalPromise !== void 0) {
                originalPromise._attachExtraTrace(e);
            }
            resolver.promise._reject(e, void 0);
            return;
        }
        resolver.resolve(y);
    }

    function Promise$_rejectFromThenable(r) {
        if (called) return;
        called = true;
        var trace = canAttach(r) ? r : new Error(r + "");
        if (originalPromise !== void 0) {
            originalPromise._attachExtraTrace(trace);
        }
        resolver.promise._reject(r, trace);
    }

    function Promise$_progressFromThenable(v) {
        if (called) return;
        var promise = resolver.promise;
        if (typeof promise._progress === "function") {
            promise._progress(v);
        }
    }
}

return Promise$_Cast;
};

},{"./errors.js":10,"./util.js":35}],33:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var _setTimeout = function(fn, ms) {
    var len = arguments.length;
    var arg0 = arguments[2];
    var arg1 = arguments[3];
    var arg2 = len >= 5 ? arguments[4] : void 0;
    setTimeout(function() {
        fn(arg0, arg1, arg2);
    }, ms);
};

module.exports = function(Promise, INTERNAL, cast) {
var util = require("./util.js");
var errors = require("./errors.js");
var apiRejection = require("./errors_api_rejection")(Promise);
var TimeoutError = Promise.TimeoutError;

var afterTimeout = function Promise$_afterTimeout(promise, message, ms) {
    if (!promise.isPending()) return;
    if (typeof message !== "string") {
        message = "operation timed out after" + " " + ms + " ms"
    }
    var err = new TimeoutError(message);
    errors.markAsOriginatingFromRejection(err);
    promise._attachExtraTrace(err);
    promise._cancel(err);
};

var afterDelay = function Promise$_afterDelay(value, promise) {
    promise._fulfill(value);
};

var delay = Promise.delay = function Promise$Delay(value, ms) {
    if (ms === void 0) {
        ms = value;
        value = void 0;
    }
    ms = +ms;
    var maybePromise = cast(value, void 0);
    var promise = new Promise(INTERNAL);

    if (maybePromise instanceof Promise) {
        promise._propagateFrom(maybePromise, 7);
        promise._follow(maybePromise);
        return promise.then(function(value) {
            return Promise.delay(value, ms);
        });
    } else {
        promise._setTrace(void 0);
        _setTimeout(afterDelay, ms, value, promise);
    }
    return promise;
};

Promise.prototype.delay = function Promise$delay(ms) {
    return delay(this, ms);
};

Promise.prototype.timeout = function Promise$timeout(ms, message) {
    ms = +ms;

    var ret = new Promise(INTERNAL);
    ret._propagateFrom(this, 7);
    ret._follow(this);
    _setTimeout(afterTimeout, ms, ret, message, ms);
    return ret.cancellable();
};

};

},{"./errors.js":10,"./errors_api_rejection":11,"./util.js":35}],34:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function (Promise, apiRejection, cast) {
    var TypeError = require("./errors.js").TypeError;
    var inherits = require("./util.js").inherits;
    var PromiseInspection = Promise.PromiseInspection;

    function inspectionMapper(inspections) {
        var len = inspections.length;
        for (var i = 0; i < len; ++i) {
            var inspection = inspections[i];
            if (inspection.isRejected()) {
                return Promise.reject(inspection.error());
            }
            inspections[i] = inspection.value();
        }
        return inspections;
    }

    function thrower(e) {
        setTimeout(function(){throw e;}, 0);
    }

    function dispose(resources, inspection) {
        var i = 0;
        var len = resources.length;
        var ret = Promise.defer();
        function iterator() {
            if (i >= len) return ret.resolve();
            var maybePromise = cast(resources[i++], void 0);
            if (maybePromise instanceof Promise &&
                maybePromise._isDisposable()) {
                try {
                    maybePromise = cast(maybePromise._getDisposer()
                                        .tryDispose(inspection), void 0);
                } catch (e) {
                    return thrower(e);
                }
                if (maybePromise instanceof Promise) {
                    return maybePromise._then(iterator, thrower,
                                              null, null, null);
                }
            }
            iterator();
        }
        iterator();
        return ret.promise;
    }

    function disposerSuccess(value) {
        var inspection = new PromiseInspection();
        inspection._settledValue = value;
        inspection._bitField = 268435456;
        return dispose(this, inspection).thenReturn(value);
    }

    function disposerFail(reason) {
        var inspection = new PromiseInspection();
        inspection._settledValue = reason;
        inspection._bitField = 134217728;
        return dispose(this, inspection).thenThrow(reason);
    }

    function Disposer(data, promise) {
        this._data = data;
        this._promise = promise;
    }

    Disposer.prototype.data = function Disposer$data() {
        return this._data;
    };

    Disposer.prototype.promise = function Disposer$promise() {
        return this._promise;
    };

    Disposer.prototype.resource = function Disposer$resource() {
        if (this.promise().isFulfilled()) {
            return this.promise().value();
        }
        return null;
    };

    Disposer.prototype.tryDispose = function(inspection) {
        var resource = this.resource();
        var ret = resource !== null
            ? this.doDispose(resource, inspection) : null;
        this._promise._unsetDisposable();
        this._data = this._promise = null;
        return ret;
    };

    function FunctionDisposer(fn, promise) {
        this.constructor$(fn, promise);
    }
    inherits(FunctionDisposer, Disposer);

    FunctionDisposer.prototype.doDispose = function (resource, inspection) {
        var fn = this.data();
        return fn.call(resource, resource, inspection);
    };

    Promise.using = function Promise$using() {
        var len = arguments.length;
        if (len < 2) return apiRejection(
                        "you must pass at least 2 arguments to Promise.using");
        var fn = arguments[len - 1];
        if (typeof fn !== "function") return apiRejection("fn must be a function");
        len--;
        var resources = new Array(len);
        for (var i = 0; i < len; ++i) {
            var resource = arguments[i];
            if (resource instanceof Disposer) {
                var disposer = resource;
                resource = resource.promise();
                resource._setDisposable(disposer);
            }
            resources[i] = resource;
        }

        return Promise.settle(resources)
            .then(inspectionMapper)
            .spread(fn)
            ._then(disposerSuccess, disposerFail, void 0, resources, void 0);
    };

    Promise.prototype._setDisposable =
    function Promise$_setDisposable(disposer) {
        this._bitField = this._bitField | 262144;
        this._disposer = disposer;
    };

    Promise.prototype._isDisposable = function Promise$_isDisposable() {
        return (this._bitField & 262144) > 0;
    };

    Promise.prototype._getDisposer = function Promise$_getDisposer() {
        return this._disposer;
    };

    Promise.prototype._unsetDisposable = function Promise$_unsetDisposable() {
        this._bitField = this._bitField & (~262144);
        this._disposer = void 0;
    };

    Promise.prototype.disposer = function Promise$disposer(fn) {
        if (typeof fn === "function") {
            return new FunctionDisposer(fn, this);
        }
        throw new TypeError();
    };

};

},{"./errors.js":10,"./util.js":35}],35:[function(require,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var es5 = require("./es5.js");
var haveGetters = (function(){
    try {
        var o = {};
        es5.defineProperty(o, "f", {
            get: function () {
                return 3;
            }
        });
        return o.f === 3;
    }
    catch (e) {
        return false;
    }

})();
var canEvaluate = typeof navigator == "undefined";
var errorObj = {e: {}};
function tryCatch1(fn, receiver, arg) {
    try { return fn.call(receiver, arg); }
    catch (e) {
        errorObj.e = e;
        return errorObj;
    }
}

function tryCatch2(fn, receiver, arg, arg2) {
    try { return fn.call(receiver, arg, arg2); }
    catch (e) {
        errorObj.e = e;
        return errorObj;
    }
}

function tryCatch3(fn, receiver, arg, arg2, arg3) {
    try { return fn.call(receiver, arg, arg2, arg3); }
    catch (e) {
        errorObj.e = e;
        return errorObj;
    }
}

function tryCatch4(fn, receiver, arg, arg2, arg3, arg4) {
    try { return fn.call(receiver, arg, arg2, arg3, arg4); }
    catch (e) {
        errorObj.e = e;
        return errorObj;
    }
}

function tryCatchApply(fn, args, receiver) {
    try { return fn.apply(receiver, args); }
    catch (e) {
        errorObj.e = e;
        return errorObj;
    }
}

var inherits = function(Child, Parent) {
    var hasProp = {}.hasOwnProperty;

    function T() {
        this.constructor = Child;
        this.constructor$ = Parent;
        for (var propertyName in Parent.prototype) {
            if (hasProp.call(Parent.prototype, propertyName) &&
                propertyName.charAt(propertyName.length-1) !== "$"
           ) {
                this[propertyName + "$"] = Parent.prototype[propertyName];
            }
        }
    }
    T.prototype = Parent.prototype;
    Child.prototype = new T();
    return Child.prototype;
};

function asString(val) {
    return typeof val === "string" ? val : ("" + val);
}

function isPrimitive(val) {
    return val == null || val === true || val === false ||
        typeof val === "string" || typeof val === "number";

}

function isObject(value) {
    return !isPrimitive(value);
}

function maybeWrapAsError(maybeError) {
    if (!isPrimitive(maybeError)) return maybeError;

    return new Error(asString(maybeError));
}

function withAppended(target, appendee) {
    var len = target.length;
    var ret = new Array(len + 1);
    var i;
    for (i = 0; i < len; ++i) {
        ret[i] = target[i];
    }
    ret[i] = appendee;
    return ret;
}

function getDataPropertyOrDefault(obj, key, defaultValue) {
    if (es5.isES5) {
        var desc = Object.getOwnPropertyDescriptor(obj, key);
        if (desc != null) {
            return desc.get == null && desc.set == null
                    ? desc.value
                    : defaultValue;
        }
    } else {
        return {}.hasOwnProperty.call(obj, key) ? obj[key] : void 0;
    }
}

function notEnumerableProp(obj, name, value) {
    if (isPrimitive(obj)) return obj;
    var descriptor = {
        value: value,
        configurable: true,
        enumerable: false,
        writable: true
    };
    es5.defineProperty(obj, name, descriptor);
    return obj;
}


var wrapsPrimitiveReceiver = (function() {
    return this !== "string";
}).call("string");

function thrower(r) {
    throw r;
}

var inheritedDataKeys = (function() {
    if (es5.isES5) {
        return function(obj, opts) {
            var ret = [];
            var visitedKeys = Object.create(null);
            var getKeys = Object(opts).includeHidden
                ? Object.getOwnPropertyNames
                : Object.keys;
            while (obj != null) {
                var keys;
                try {
                    keys = getKeys(obj);
                } catch (e) {
                    return ret;
                }
                for (var i = 0; i < keys.length; ++i) {
                    var key = keys[i];
                    if (visitedKeys[key]) continue;
                    visitedKeys[key] = true;
                    var desc = Object.getOwnPropertyDescriptor(obj, key);
                    if (desc != null && desc.get == null && desc.set == null) {
                        ret.push(key);
                    }
                }
                obj = es5.getPrototypeOf(obj);
            }
            return ret;
        };
    } else {
        return function(obj) {
            var ret = [];
            /*jshint forin:false */
            for (var key in obj) {
                ret.push(key);
            }
            return ret;
        };
    }

})();

function isClass(fn) {
    try {
        if (typeof fn === "function") {
            var keys = es5.keys(fn.prototype);
            return keys.length > 0 &&
                   !(keys.length === 1 && keys[0] === "constructor");
        }
        return false;
    } catch (e) {
        return false;
    }
}

function toFastProperties(obj) {
    /*jshint -W027*/
    function f() {}
    f.prototype = obj;
    return f;
    eval(obj);
}

var rident = /^[a-z$_][a-z$_0-9]*$/i;
function isIdentifier(str) {
    return rident.test(str);
}

function filledRange(count, prefix, suffix) {
    var ret = new Array(count);
    for(var i = 0; i < count; ++i) {
        ret[i] = prefix + i + suffix;
    }
    return ret;
}

var ret = {
    isClass: isClass,
    isIdentifier: isIdentifier,
    inheritedDataKeys: inheritedDataKeys,
    getDataPropertyOrDefault: getDataPropertyOrDefault,
    thrower: thrower,
    isArray: es5.isArray,
    haveGetters: haveGetters,
    notEnumerableProp: notEnumerableProp,
    isPrimitive: isPrimitive,
    isObject: isObject,
    canEvaluate: canEvaluate,
    errorObj: errorObj,
    tryCatch1: tryCatch1,
    tryCatch2: tryCatch2,
    tryCatch3: tryCatch3,
    tryCatch4: tryCatch4,
    tryCatchApply: tryCatchApply,
    inherits: inherits,
    withAppended: withAppended,
    asString: asString,
    maybeWrapAsError: maybeWrapAsError,
    wrapsPrimitiveReceiver: wrapsPrimitiveReceiver,
    toFastProperties: toFastProperties,
    filledRange: filledRange
};

module.exports = ret;

},{"./es5.js":12}]},{},[3])
(3)
});
;

return module && module.exports && Object.keys(module.exports).length
        ? module.exports : exports;
})()
,
'stompjs': (function() {
var exports = {}; var module = { exports: exports };

// Generated by CoffeeScript 1.7.1
/*
   Stomp Over WebSocket http://www.jmesnil.net/stomp-websocket/doc/ | Apache License V2.0

   Copyright (C) 2010-2013 [Jeff Mesnil](http://jmesnil.net/)
   Copyright (C) 2012 [FuseSource, Inc.](http://fusesource.com)
 */
(function(){var t,e,n,i,r={}.hasOwnProperty,o=[].slice;t={LF:"\n",NULL:"\x00"};n=function(){var e;function n(t,e,n){this.command=t;this.headers=e!=null?e:{};this.body=n!=null?n:""}n.prototype.toString=function(){var e,i,o,s,u;e=[this.command];o=this.headers["content-length"]===false?true:false;if(o){delete this.headers["content-length"]}u=this.headers;for(i in u){if(!r.call(u,i))continue;s=u[i];e.push(""+i+":"+s)}if(this.body&&!o){e.push("content-length:"+n.sizeOfUTF8(this.body))}e.push(t.LF+this.body);return e.join(t.LF)};n.sizeOfUTF8=function(t){if(t){return encodeURI(t).match(/%..|./g).length}else{return 0}};e=function(e){var i,r,o,s,u,a,c,f,h,l,p,d,g,b,m,v,y;s=e.search(RegExp(""+t.LF+t.LF));u=e.substring(0,s).split(t.LF);o=u.shift();a={};d=function(t){return t.replace(/^\s+|\s+$/g,"")};v=u.reverse();for(g=0,m=v.length;g<m;g++){l=v[g];f=l.indexOf(":");a[d(l.substring(0,f))]=d(l.substring(f+1))}i="";p=s+2;if(a["content-length"]){h=parseInt(a["content-length"]);i=(""+e).substring(p,p+h)}else{r=null;for(c=b=p,y=e.length;p<=y?b<y:b>y;c=p<=y?++b:--b){r=e.charAt(c);if(r===t.NULL){break}i+=r}}return new n(o,a,i)};n.unmarshall=function(n){var i,r,o,s;r=n.split(RegExp(""+t.NULL+t.LF+"*"));s={frames:[],partial:""};s.frames=function(){var t,n,o,s;o=r.slice(0,-1);s=[];for(t=0,n=o.length;t<n;t++){i=o[t];s.push(e(i))}return s}();o=r.slice(-1)[0];if(o===t.LF||o.search(RegExp(""+t.NULL+t.LF+"*$"))!==-1){s.frames.push(e(o))}else{s.partial=o}return s};n.marshall=function(e,i,r){var o;o=new n(e,i,r);return o.toString()+t.NULL};return n}();e=function(){var e;function r(t){this.ws=t;this.ws.binaryType="arraybuffer";this.counter=0;this.connected=false;this.heartbeat={outgoing:1e4,incoming:1e4};this.maxWebSocketFrameSize=16*1024;this.subscriptions={};this.partialData=""}r.prototype.debug=function(t){var e;return typeof window!=="undefined"&&window!==null?(e=window.console)!=null?e.log(t):void 0:void 0};e=function(){if(Date.now){return Date.now()}else{return(new Date).valueOf}};r.prototype._transmit=function(t,e,i){var r;r=n.marshall(t,e,i);if(typeof this.debug==="function"){this.debug(">>> "+r)}while(true){if(r.length>this.maxWebSocketFrameSize){this.ws.send(r.substring(0,this.maxWebSocketFrameSize));r=r.substring(this.maxWebSocketFrameSize);if(typeof this.debug==="function"){this.debug("remaining = "+r.length)}}else{return this.ws.send(r)}}};r.prototype._setupHeartbeat=function(n){var r,o,s,u,a,c;if((a=n.version)!==i.VERSIONS.V1_1&&a!==i.VERSIONS.V1_2){return}c=function(){var t,e,i,r;i=n["heart-beat"].split(",");r=[];for(t=0,e=i.length;t<e;t++){u=i[t];r.push(parseInt(u))}return r}(),o=c[0],r=c[1];if(!(this.heartbeat.outgoing===0||r===0)){s=Math.max(this.heartbeat.outgoing,r);if(typeof this.debug==="function"){this.debug("send PING every "+s+"ms")}this.pinger=i.setInterval(s,function(e){return function(){e.ws.send(t.LF);return typeof e.debug==="function"?e.debug(">>> PING"):void 0}}(this))}if(!(this.heartbeat.incoming===0||o===0)){s=Math.max(this.heartbeat.incoming,o);if(typeof this.debug==="function"){this.debug("check PONG every "+s+"ms")}return this.ponger=i.setInterval(s,function(t){return function(){var n;n=e()-t.serverActivity;if(n>s*2){if(typeof t.debug==="function"){t.debug("did not receive server activity for the last "+n+"ms")}return t.ws.close()}}}(this))}};r.prototype._parseConnect=function(){var t,e,n,i;t=1<=arguments.length?o.call(arguments,0):[];i={};switch(t.length){case 2:i=t[0],e=t[1];break;case 3:if(t[1]instanceof Function){i=t[0],e=t[1],n=t[2]}else{i.login=t[0],i.passcode=t[1],e=t[2]}break;case 4:i.login=t[0],i.passcode=t[1],e=t[2],n=t[3];break;default:i.login=t[0],i.passcode=t[1],e=t[2],n=t[3],i.host=t[4]}return[i,e,n]};r.prototype.connect=function(){var r,s,u,a;r=1<=arguments.length?o.call(arguments,0):[];a=this._parseConnect.apply(this,r);u=a[0],this.connectCallback=a[1],s=a[2];if(typeof this.debug==="function"){this.debug("Opening Web Socket...")}this.ws.onmessage=function(i){return function(r){var o,u,a,c,f,h,l,p,d,g,b,m,v;c=typeof ArrayBuffer!=="undefined"&&r.data instanceof ArrayBuffer?(o=new Uint8Array(r.data),typeof i.debug==="function"?i.debug("--- got data length: "+o.length):void 0,function(){var t,e,n;n=[];for(t=0,e=o.length;t<e;t++){u=o[t];n.push(String.fromCharCode(u))}return n}().join("")):r.data;i.serverActivity=e();if(c===t.LF){if(typeof i.debug==="function"){i.debug("<<< PONG")}return}if(typeof i.debug==="function"){i.debug("<<< "+c)}d=n.unmarshall(i.partialData+c);i.partialData=d.partial;m=d.frames;v=[];for(g=0,b=m.length;g<b;g++){f=m[g];switch(f.command){case"CONNECTED":if(typeof i.debug==="function"){i.debug("connected to server "+f.headers.server)}i.connected=true;i._setupHeartbeat(f.headers);v.push(typeof i.connectCallback==="function"?i.connectCallback(f):void 0);break;case"MESSAGE":p=f.headers.subscription;l=i.subscriptions[p]||i.onreceive;if(l){a=i;h=f.headers["message-id"];f.ack=function(t){if(t==null){t={}}return a.ack(h,p,t)};f.nack=function(t){if(t==null){t={}}return a.nack(h,p,t)};v.push(l(f))}else{v.push(typeof i.debug==="function"?i.debug("Unhandled received MESSAGE: "+f):void 0)}break;case"RECEIPT":v.push(typeof i.onreceipt==="function"?i.onreceipt(f):void 0);break;case"ERROR":v.push(typeof s==="function"?s(f):void 0);break;default:v.push(typeof i.debug==="function"?i.debug("Unhandled frame: "+f):void 0)}}return v}}(this);this.ws.onclose=function(t){return function(){var e;e="Whoops! Lost connection to "+t.ws.url;if(typeof t.debug==="function"){t.debug(e)}t._cleanUp();return typeof s==="function"?s(e):void 0}}(this);return this.ws.onopen=function(t){return function(){if(typeof t.debug==="function"){t.debug("Web Socket Opened...")}u["accept-version"]=i.VERSIONS.supportedVersions();u["heart-beat"]=[t.heartbeat.outgoing,t.heartbeat.incoming].join(",");return t._transmit("CONNECT",u)}}(this)};r.prototype.disconnect=function(t,e){if(e==null){e={}}this._transmit("DISCONNECT",e);this.ws.onclose=null;this.ws.close();this._cleanUp();return typeof t==="function"?t():void 0};r.prototype._cleanUp=function(){this.connected=false;if(this.pinger){i.clearInterval(this.pinger)}if(this.ponger){return i.clearInterval(this.ponger)}};r.prototype.send=function(t,e,n){if(e==null){e={}}if(n==null){n=""}e.destination=t;return this._transmit("SEND",e,n)};r.prototype.subscribe=function(t,e,n){var i;if(n==null){n={}}if(!n.id){n.id="sub-"+this.counter++}n.destination=t;this.subscriptions[n.id]=e;this._transmit("SUBSCRIBE",n);i=this;return{id:n.id,unsubscribe:function(){return i.unsubscribe(n.id)}}};r.prototype.unsubscribe=function(t){delete this.subscriptions[t];return this._transmit("UNSUBSCRIBE",{id:t})};r.prototype.begin=function(t){var e,n;n=t||"tx-"+this.counter++;this._transmit("BEGIN",{transaction:n});e=this;return{id:n,commit:function(){return e.commit(n)},abort:function(){return e.abort(n)}}};r.prototype.commit=function(t){return this._transmit("COMMIT",{transaction:t})};r.prototype.abort=function(t){return this._transmit("ABORT",{transaction:t})};r.prototype.ack=function(t,e,n){if(n==null){n={}}n["message-id"]=t;n.subscription=e;return this._transmit("ACK",n)};r.prototype.nack=function(t,e,n){if(n==null){n={}}n["message-id"]=t;n.subscription=e;return this._transmit("NACK",n)};return r}();i={VERSIONS:{V1_0:"1.0",V1_1:"1.1",V1_2:"1.2",supportedVersions:function(){return"1.1,1.0"}},client:function(t,n){var r,o;if(n==null){n=["v10.stomp","v11.stomp"]}r=i.WebSocketClass||WebSocket;o=new r(t,n);return new e(o)},over:function(t){return new e(t)},Frame:n};if(typeof exports!=="undefined"&&exports!==null){exports.Stomp=i}if(typeof window!=="undefined"&&window!==null){i.setInterval=function(t,e){return window.setInterval(e,t)};i.clearInterval=function(t){return window.clearInterval(t)};window.Stomp=i}else if(!exports){self.Stomp=i}}).call(this);

return module && module.exports && Object.keys(module.exports).length
        ? module.exports : exports;
})()

    };

//    if(typeof modules[m] !== 'function') {
//        throw new Error("module not found " + m);
//    }

    return modules[m];
};

return Compose; }).call(self);
    if (typeof define === 'function' && define.amd) {
        define(function(require, exports, module) {
            exports = $$Compose;
            return $$Compose;
        });
    }
    else {
        if(typeof window.require === 'undefined') {

            if(window.Compose) {
                window.Compose_conflicting = window.Compose;
            }

            window.Compose = $$Compose;
        };
    }

}).call(window);
