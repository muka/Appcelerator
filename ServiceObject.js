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

    var buildQueryString = function(obj, prefix) {

        var qs = '';
        var qsparts = [];

        for(var key in obj) {
            qsparts.push(key + '=' + obj[key]);
        }

        qs = (prefix === undefined ? '?' : prefix) + qsparts.join('&');
        return qs;
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
    Subscription.prototype.toJson =
    Subscription.prototype.toJSON = function(asString) {
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

            so.getClient().post(url, me.toJSON(), function(data) {

                if(!data.id) {
                    return reject(new ComposeError("Error creating subscription on stream " + me.container().name));
                }

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
            so.getClient().put(url, me.toJSON(), function(data) {
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
     * Load a subscription
     *
     * @return {Promise} Promise callback with result
     */
    SubscriptionList.prototype.load = function(id) {
        var me = this;

        var stream = me.container();
        var so = stream.container();
        return new Promise(function(resolve, reject) {
            var url = '/subscriptions/'+ id;
            so.getClient().get(url, null, function(data) {
                var sub = stream.addSubscription(data)
                resolve(sub);
            }, reject);
        }).bind(stream);
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
    Actuation.prototype.toJson = Actuation.prototype.toJSON = function(asString) {
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

            body = body || ""

            var client = me.container().getClient()
            var url = '/'+ me.container().id +'/actuations/'+ me.name;

            client.request({
                method: 'POST',
                path: url,
                headers: {
                    'Content-Type': 'text/plain'
                },
                body: body.toString(),
                success: function(data) {

                    me.id = data.id;
                    me.createdAt = data.createdAt;

                    resolve(me);
                },
                error: reject
            })

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
     * @param {mixed} newStatus optional, set a new status of the actuation
     * @return {Promise} Promise callback with result
     */
    Actuation.prototype.status = function(newStatus) {
        var me = this;
        return new Promise(function(resolve, reject) {

            if(!me.id) {
                throw new ComposeError("Actuation must have an id, use invoke or refresh the list before continue");
            }

            var url = '/actuations/'+ me.id;
            var client = me.container().getClient();

            var cb = function(data) {
                resolve(data.status);
            };

            var is_setValue = (newStatus !== undefined);
            client.request({
                method: is_setValue ? 'put' : 'get',
                path: url,
                headers: {
                    'Content-Type': is_setValue ? 'text/plain' : 'application/json'
                },
                body: is_setValue ? newStatus : null,
                success: cb,
                error: reject
            })

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
            me.container().getClient().delete(url, null, function(data) {
//                if(data.status === 'cancelled') {
//                    me.reset();
//                }
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
        // track available listener
        this.__$listener = null
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
    ActuationList.prototype.toJson = ActuationList.prototype.toJSON = function(asString) {
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
                resolve(me.container().getActions());

            }, reject);

        }).bind(me.container());
    };

    /**
     * Listen for actuation request
     *
     * @return {Promise} A promise for the subscription object creation
     */
    ActuationList.prototype.listen = function(fn) {

        var me = this
        return new Promise(function(success, failure) {

            // do not subscibe multiple times
            if(!me.__$listener) {
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
                    me.__$listener = false
                    return failure(e);
                }
            }

            if(fn && typeof fn === 'function') {
                me.container().on('actions', fn);
            }

            me.__$listener = true
            success();
        });

    };

    /**
     * Stop listening for actuations
     *
     * @return {Promise} A promise for the subscription object creation
     */
    ActuationList.prototype.listen = function() {

        var me = this
        return new Promise(function(success, failure) {

            if(!me.__$listener) {
                return success()
            }

            try {

                me.container().getClient().unsubscribe({
                    uuid: me.container().id + '.actions',
                    topic: 'actions',
                    actions: me
                });

            }
            catch(e) {
                return failure(e);
            }

            me.__$listener = false
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

        // BEWARE: !== doesn't work!
        if(arguments[0]*1 != arguments[0]) {
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
            data.asObject = data.toJson = data.toJSON = function() {

                var res = {
                    channels: {},
                    lastUpdate: data.lastUpdate
                };

                for(var i in data.channels) {
                    (function(_i) {
                        res.channels[_i] =  data.channels[_i]['current-value'];
                    })(i);
                }

                return res;
            };

            return data;
        }

        return null;
    };

    DataBag.prototype.toJson = DataBag.prototype.toJSON = function(asString) {

        var me = this;

        var obj = {
            getList: function() { return me.getList(); },
            forEach: function(fn) {
                me.forEach(function(el, i) {
                    fn.apply(me, [me.get(i), i]);
                });
            }
        };

        return compose.util.List.Enumerable.prototype.toJSON.call(obj, asString);
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
                destination: compose.config.apiKeyToken
            }
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
            throw new compose.error.ValidationError("prepareData expect a readable Date value");
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
     * @param {String} timeModifier  optional, possible values: lastUpdate, 1199192940 (time ago as timestamp)
     * @param {int} size             optional, the number of elements to return
     * @param {int} from             optional, the first value to get from the list for paging
     *
     * @return {Promise}             Promise callback with result
     */
    Stream.prototype.pull = function(timeModifier, size, from) {

        var me = this;
        timeModifier = timeModifier ? timeModifier : "";

        var qs = '';
        if(size || from !== undefined) {

            var obj = {};
            if(size) obj.size = size;
            if(from !== undefined) obj.from = from;

            qs = buildQueryString(obj);
        }

        return new Promise(function(resolve, reject) {

            if(!me.container().id) {
                throw new ComposeError("Missing ServiceObject id.");
            }

            var url = '/' + me.container().id + '/streams/' + me.name + '/' + timeModifier + qs;
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
     * @param {Object} options      search options
     * @param {int} size            optional, the number of elements to return
     * @param {int} from            optional, the first value to get from the list for paging
     *
     * @return {Promise} Promise callback with result
     */
    Stream.prototype.search = function(searchOptions, size, from) {

        var me = this;

        return new Promise(function(resolve, reject) {

            if(!me.container().id) {
                throw new ComposeError("Missing ServiceObject id.");
            }

            if(!searchOptions) {
                throw new ComposeError("No params provided for search");
            }

            var loadParams = function(options) {
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

                        // convert to seconds
                        return Math.round(date.getTime()/1000);
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

                return params;
            };

            // Handle "array-based" search with multiple params
            if(searchOptions instanceof Array) {
                var params = [];
                for(var i=0, len=searchOptions.length; i < len; i++) {
                    var param = loadParams(searchOptions[i]);
                    params.push(param);
                }
            }
            else {
                var params = loadParams(searchOptions);
            }

            var qs = '';
            if(size || from !== undefined) {

                var obj = {};
                if(size) obj.size = size;
                if(from !== undefined) obj.from = from;

                qs = buildQueryString(obj);
            }

            var url = '/' + me.container().id + '/streams/' + me.name + '/search' + qs;
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

            me.getClient().post('/', me.toJSON(), function(data) {
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

            me.getClient().put('/'+ me.id, me.toJSON(), function(data) {
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
            wo = wo.toJSON();
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
     * @return {Promise}
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

    /**
     * Search for Service Objects.
     * Example parameters:
     * 1) free-form query: { query: "some params" }
     * 2) field params:
     * {
     *   name: "Object Name",
     *   description: "optional description"
     *   customFields: {
     *      param1: "value"
     *   }
     * }
     *
     *
     * @params Object search parameters
     * @return {Promise}
     */
    solib.search = function(params) {
        var client = solib.client();
        return new Promise(function(resolve, reject) {
            client.post('/search', params, function(data) {
                client.ServiceObject = null;
                var json = typeof data === 'string' ? JSON.parse(data) : data;
                resolve(json);
            }, reject);
        }).bind(client);
    };

};
