compose.io - COMPOSE JS library
========

compose.io is the [COMPOSE] JavaScript library designed to be used with [Titanium Appcelerator] platform, node.js and modern browsers.

[Titanium Appcelerator]:http://www.appcelerator.com
[COMPOSE]:http://www.compose-project.eu
[REST API]:http://docs.servioticy.com/

#Topics

- [Installation](#installation)
    - [Appcelerator Titanium Mobile](#appcelerator-titanium-mobile)
    - [Node.js](#nodejs)
    - [Browser](#browser)
- [Library configuration](#library-configuration)
- [Example usage](#example-usage)
    - [List all Service Objects](#list-all-service-objects)
    - [Search for Service Objects](#search-for-service-objects)
    - [Create a Service Object](#create-a-service-object)
    - [Load a Service Object definition](#load-a-service-object-definition)
    - [Sending data update](#sending-data-update)
    - [Loading a Service Object by ID](#loading-a-service-object-by-id)
    - [Retrieving data from a Service Object](#retrieving-data-from-a-service-object)
    - [Search for data in a Stream](#search-for-data-in-a-stream)
        - [Numeric range](#numeric-range)
        - [Time range](#time-range)
        - [Match](#match)
        - [Bounding box](#bounding-box)
        - [Distance](#distance)
- [Getting realtime updates](#getting-realtime-updates)
    - [Listening for updates to a stream](#listening-for-updates-to-a-stream)
    - [Listening for all the updates](#listening-for-all-the-updates)
- [Actuations](#actuations)
    - [Invoking an actuation](#invoking-an-actuation)
    - [Listening for actuations](#listening-for-actuations)
- [Additional notes](#additional-notes)
    - [Async impl](#async-impl)
    - [API support](#api-support)
- [Tests](#tests)
- [Contributing](#contributing)
- [Docs](#docs)
- [License](#license)
- [Changelog](#Changelog)

---

#Installation

##Appcelerator Titanium Mobile

First you will need to install the native [mqtt module for Titanium](https://github.com/compose-eu/MobileSDK/tree/master/MQTT)

Extract the archive to `<project>/modules` and add to your `tiapp.xml` the module reference

```xml
<modules>
    <module platform="android">it.uhopper.mqtt</module>
</modules>
```

Add `build/titanium/compose` library inside the `Resources` folder (or `app/lib` if you use Alloy) in your project, then in the code

`var compose = require('compose')`

##Node.js

Install the module from the git repository

` npm i compose-eu/Appcelerator`

and then import it in your code

`var Compose = require('compose.io')`


##Browser

Add dependency to your page

`<script src="js/compose.io/build/browser/compose.js"></script>`

` console.log(window.Compose); `

For an AMD-enabled setup (like with [require.js](http://requirejs.org/))

```
require.config({
    paths: {
        "compose.io": "compose.io/build/browser/compose",
    }
});

require(['compose.io'], function(Compose) {
    var api = new Compose('<apiKey>');
});

```

The library is also configured to be used with `browserify` to support UMD node-like `require`. To generate the whole library as a bundle use eg.

`browserify index.js > compose-bundle.js`

#Library configuration

The minimal configuration required is the apiKey to access the API.

Please refer to the [online demo](http://www.servioticy.com/?page_id=73) section on servioticy.com to request your api key.

```
var api1 = new Compose('your api key 1');

// load another apiKey
var api2 = new Compose('your api key 2');
```

Details of available options:

```
var api = new Compose({

    // api key
    apiKey: '<api key>',

    // transport type, one of http, mqtt, stomp
    transport: 'mqtt'

    // All optional from here on

    // Compose API endpoint
    url: 'http://api.servioticy.com'

    // Additional configuration to be passed to sub-modules handling data transmission
    // can be passed by adding a properties matching the transport name
    mqtt: {
        proto: 'mqtt', // or 'mqtts'
        host: 'api.servioticy.com',
        port: 1883
        user: 'compose',
        password: 'shines'
    }
    stomp: { /* see above.. */}
});

```

#Example usage


##List all Service Objects

```

api.list()
    .then(function(list) {

        console.info("List loaded, " + list.length + " elements");

    })

    // .catch is optional, will report errors, if any occurs
    .catch(function(e) {
        console.warn("An error occured!");
    })
    // .finally is optional too, will run after the request is completed (either if failed)
    .finally(function() {
        console.log("Done");
    });

```

Load all the Service Objects in the list.

```
api.list().map(api.load).then(function(list) {
    // list is an array containing ServiceObject instances
    list.forEach(function(so) {
        console.log(so.id, so.toString());
    })
})
// .catch(fn).finally(fn)
;
```

Get the data from all the Service Objects in the list

```
api.list().map(api.load).map(function(so) {
    // return a Promise to use further chainability
    return so.getStream("location") && so.getStream("location").pull();
})
.then(function(res) {
    // res is now a list of DataBag
    res.forEach(function(dataset) {
        console.log( "Last position registered for " +
            dataset.container() // Stream reference
                .container() // ServiceObject reference
                    .id +
            + " is " + dataset.last().get('latitude') + ", " + dataset.last().get('longitude') );
    });

})
// .catch(fn).finally(fn)
;
```

Delete all the ServiceObject
```
api.list().map(api.delete).then(function() {
    console.log("Done");
})
// .catch(fn).finally(fn)
;
```

##Search for Service Objects


```

// at least one option is required, multiple option will be AND-ed together

var params = {
  query: "*berry", // Free-textquery, use * fro wildcard
  name: "drone", // match any title containing `drone` work
  description: "drone",
  customFields: {
     model: "a4b2788"
  }
};

api.search().then(function(list) {
    console.log("Found " + list.length);
})
// .catch(fn).finally(fn)

```

##Create a Service Object

Follows a pseudo drone definition as per COMPOSE spec.

The `location` stream will keep track of the movement of the drone

```
var droneDefinition = {
   "name": "Drone",
   "description": "My amazing drone",
   "public":"false",
   "streams": {
         "location": {
            "channels": {
                "latitude": {
                    "type": "Number",
                    "unit": "degrees"
                },
                "longitude": {
                    "type": "Number",
                    "unit": "degrees"
                }
            },
            "description": "GPS location",
            "type": "sensor"
        }
    },
    "customFields": {
        model: 'drone-001',
        colors: ['red', 'blue']
    },
    "actions": [],
    "properties": []
}
```

Create the drone Service Object on the backend

```

api.create(droneDefinition)
    .then(function(drone) {

        // drone is the new ServiceObject create
        console.info("Drone ServiceObject created, id" + drone.id);
        console.info(drone.toString());

        // see below how to use the drone object to send and receive data

    }).catch(function(e) {

        console.warn("An error occured!");
        console.error(e);

    });


```

##Load a Service Object definition

The json definition can be stored in the `./definitions` folder (eg `./definitions/drone.json`)
The definition path can be specified either as a path eg. `../so/definitions/drone.json`

```
// use just the json filename
api.getDefinition("drone")
    .then(api.create) // enjoy Promise
    .then(function(drone) {
        console.log("Drone SO loaded!");
    });

```

##Sending data update

First you have to select the stream you want to use, `location` in our case, and the send the data with the `push` method.

The first argument is a list of key/value pair as channel name / channel value;

The second argument (optional, default is set to now) is a readable date value for the channels data to send

```javascript

drone.getStream('location').push({
    latitude: 11.234,
    longitude: 45.432
}, new Date()).then(successCallback);

```

##Loading a Service Object by ID

Imagine now to work on a mobile application to control the drone.

```
var soid = '<ServiceObject id>';
api.load(soid)
    .then(function(drone) {

        // drone is the new ServiceObject
        console.info("Drone ServiceObject created, id" + drone.id);
        console.info(drone.toString());

    })
//  .catch(fn)
//  .finally(fn)
    ;
```

##Retrieving data from a Service Object

Load the drone Service Object by its ID (or load the list and search for it)

The returned value is a `DataBag` object which expose some simplified methods to use the data from the stream

```

drone.getStream("location")
    .pull().then(function(data) {

        console.log("Data for stream loaded " + data.size());

        // iterate results
        while(data.next()) {
            // current return the data stored at the position of the internal cursor
            var value = data.current();
            console.log("Data loaded " + value.get("latitude") + ", " + value.get("longitude"));
        }

        // Stream reference
        var StreamRef = data.container();
        // ServiceObject reference
        var ServiceObjectRef = StreamRef.container();

        console.log("Data for " + data.container().container().name + "." + data.container().name);
        // will print `Data for Drone.location`

        // count the data list
        var count = data.size();

        // get the current index (position in the list)
        var index = data.index();

        // reset internal cursor
        // data.index() will return 0
        data.reset();

        // first data stored
        data.first();

        // last data stored
        data.last();

        // get data at a certain index
        var item = data.at(index);

        console.log(item);
        // the original format of the data
        // { channels: { latitude: { current-value: 'val' } } }

        console.log(item.asObject());
        // simple js object with the data
        // { latitude: 'val', longitude: 'val' }

        // shorthand to get the values
        var lat = item.get("latitude"),
            lng = item.get("longitude");
        console.log( lat , lng );

        //get a value from the list
        // data.get(index, channel_name, defaultValue)
        var lng1 = data.get(data.size()-1, "longitude", -1);

        console.log( (lng === lng1) ? "It works!" : "Something went wrong.." );

    });

```

##Search for data in a Stream

Methods to search for data in a stream. All search method returns promises

Available search types are

- [Numeric range](#numeric-range)
- [Time range](#time-range)
- [Match](#match)
- [Bounding box](#bounding-box)
- [Distance](#distance)

###Numeric Range

Search for data in a stream matching a numeric range constrain

```
drone.getStream('stream name').searchByNumber("channel name", { from: 'val1', to: 'val2' });
drone.getStream('stream name').searchByNumber("channel name", val_from, val_to });
```

To combine with other filters
```
drone.getStream('stream name').search({
    numeric: {
        channel: 'channel name',
        from: 'val1'
        to: 'val2'
    }
});
```

###Time Range

Search for data in a time range, creation date (`lastUpdate`) value will be used to match the search

```
// timeFrom / timeTo can be any value readable as a javascript `Date`
drone.getStream('stream name').searchByTime(timeFrom, timeTo);
drone.getStream('stream name').searchByTime("Tue May 13 2014 10:21:18 GMT+0200 (CEST)", new Date());
```

To combine with other filters
```
drone.getStream('stream name').search({
    time: {
        from: 1368433278000,
        to:   1399969278000
    }
});
```

###Match

Search for a matching value in a provided channel

```
drone.getStream('stream name').searchByText("channel name", "string to search");
```

To combine with other filters
```
drone.getStream('stream name').search({
    match: {
        channel: "channel name",
        string: "string to search"
    }
});
```

###Bounding box

Search by a delimiting [bounding box](http://en.wikipedia.org/wiki/Minimum_bounding_box)

This search type will look to match a channel named `location` with a geojson value. [See API docs](http://docs.servioticypublic.apiary.io/#dataqueries)


```
drone.getStream('stream name').searchByBoundingBox([
    // upper point
    { latitude: '', longitude: '' },
    // lower point
    { latitude: '', longitude: '' }
]);
```

To combine with other filters (incompatible with distance, if both provided `bbox` will be used )
```
drone.getStream('stream name').search({
    bbox: {
        coords: [
            // upper point
            { latitude: '', longitude: '' },
            // lower point
            { latitude: '', longitude: '' }
        ]
        // or
        // coords: [ toplat, toplon, bottomlat, bottomlon ]
    }
});
```

###Distance

Search data by distance

```
// default unit is km
drone.getStream('stream name').searchByDistance({ latitude: 11,longitude: 46 }, 10);

// specifying a unit
drone.getStream('stream name').searchByDistance({ latitude: 11,longitude: 46 }, 1000, 'm');
```

To combine with other filters (incompatible with bbox, if both provided `bbox` will be used )

```
drone.getStream('stream name').search({
    distance: {
        position: { latitude: 11, longitude: 46 },
        // or
        // position: [11, 46],
        value: 1,
        unit: 'km'
    }
});

```

#Getting realtime updates

Realtime updates works __only__ with _mqtt_ and _stomp_ transport types as two-way communication is available.
To use `http` please see the subproject `examples/subscriptions` to setup a base http server to receive subscriptions

##Listening for updates to a stream

It is possible to get real time updates for a specific stream by subscribinf to the stream

```
drone.getStream('stream name').subscribe(function(data) {
    console.log("Stream updated!");
    console.log(data);
}) // .then().catch().finally()
```

To stop listening

```
drone.getStream('stream name').unubscribe(); // .then().catch().finally()
```

Under the hood, the library will take care to retrieve a fresh list of available subscriptions, create a new `pubsub` subscription
if not already available and subscribe to the dedicated topic.

##Listening for all the updates

In some case could be useful to receive all the notifications available, to do so use listen to the `data` event on the ServiceObject

```
// register to updates
drone.on("data", function(data, raw) {
    console.log("Received data ", data);
    console.log("Raw message was ", raw);
})

// unregister from updates
drone.off("data")


```

#Actuations

Actuations allow to perform operations on a Service Object. Actuation need to be specified when creating a Service Object

###Invoking an actuation

To invoke an actuation use the `invoke` method and provide additional parameters as argument

Note that the argument passed to `invoke` **must** be a string, so to send JSON take care of serialize

```

var body = JSON.stringify({ some: 'params' }); // must be a string!
drone.getAction('turn-left').invoke(body) // .then().catch().finally()

```

###Listening for actuations

On the device side you can listen for actions and implement actuations on their arrival.

```

drone.getActions().listen(function(id, params, raw) {

    console.log("Perform actuation %s with params: %s", id, params);

}) // .then().catch().finally()

// or
// drone.on('actions', function(id, params, raw) {  });


```

#Additional notes

Browser support has been tested on latest Firefox, Chrome and IE 11 (any feedback is appreciated)

##Async impl

Async request are implemented as [Promise](http://promises-aplus.github.io/promises-spec/), using the [bluebird](https://github.com/petkaantonov/bluebird) library

**Notes**:

To debug easier your code try setting `api.lib.Promise.longStackTraces(true)` to see more details of exceptions thrown (* Titanium seems not supporting it)

##API support

Current status of the library follows the [Servioticy docs](http://docs.servioticy.com) reference implementation.

*Service Objects*

* All available CRUD operation are supported
* List of SO

*Streams*

* refresh - load a fresh list of streams
* push - send data
* pull - receive data list (filtered search adapted support TBD)
* search - partially tested, implemented

*Subscriptions*

* tested, implemented
* http subscription [unsupported]
* pubsub subscriptions (per stream)

*Actuations*

* tested, mostly implemented (need status api impl)

#Tests

Unit tests are available in spec/ and use Jasmine Spec

For node.js [jasmine-node](https://github.com/mhevery/jasmine-node) is used.

Titanium tests support are under development and will use [tishadow](http://tishadow.yydigital.com/) tests enviroment (jasmine)

Browser tests are `undefined` at the moment, but will be covered

`npm test`

#Contributing

Any help is welcome!

Feel free to open an issue or contact us to discuss the library status and future development.

#Docs

API docs needs review. Can be generated using `jsdoc` and will be added to the repository once the library has a stable release.

`npm install -g jsdoc`

`jsdoc ./`

#Changelog

**v0.6.0**

- Reviewed and tested subscriptions and actuations
- Initial support for `Bearer` tokens

**v0.5.2**

- Added titanium build

**v0.5.0**

- Added build tool for browser

**v0.4.1**

- Added argument to actuation.invoke

**v0.4**

- Subscription via stomp over ws and mqtt are better supported
- minor bug fixes

**v0.3**

- API break: `compose.setup()` returns now a Promise with a library instance as argument
- require refactoring, compatible with UMD loading (browserify)
- dropped "plain" ws in favor of stomp-over-js

**v0.2**

- subscription support
- stomp support

**v0.1**

- Initial release

#License

Apache2

Copyright CREATE-NET
Developed for COMPOSE project (compose-project.eu)

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

