
var conf = require('./test/config.json');

var composelib = require("./index");
composelib.setup({
    debug: conf.debug,
    apiKey: conf.apiKey,
    url: conf.url,
    transport: conf.transport
}).then(function(api){

    var smartphone = null;
    var smartphoneDefinition = require('./test/spec/smartphone.so').definition;

    return api
        .create(smartphoneDefinition)
        .then(function(so) {
            console.log("Created %s", so.id);
            smartphone = so;
            return api.list();
        })
        .then(function(list) {

            console.log("List", list);

            return api.load(smartphone.id);
        })
        .then(function(so) {

            console.log("Loaded ", so.id);

            var time = new Date().getTime();

            so.customFields.newTestField = time;
            return so.update()
        })
        .then(function(so) {

            console.log("updated so", so.customFields.newTestField);

            smartphone = so;
            var stream = so.getStream('location');

            var raw = {
                latitude: "11.123",
                longitude: "45.321"
            };

            var lastUpdate = (new Date).toString();

            console.log("push data %j", raw);
            return stream.push(raw, lastUpdate);
        })
        .then(function() {
            console.log("pushed data ");
            return smartphone.getStream('location').pull('lastUpdate')
        })
        .then(function(data) {
            console.log("pulled data ", data.toJson());
            return smartphone.getStream('location').pull();
        })
        .then(function(data) {
            console.log("ALL data ", data.toJson());
            console.log("delete so");
            return smartphone.delete();
        })
        .catch(function(e) {
            console.error("Error!", e);
        })
        .finally(function() {
            console.log("Completed");
        });

//    it('Push a bunch parallel requests', function(done) {
//
//        var stream = smartphone.getStream('location');
//        var getData = function(i) {
//            return {
//                channels: {
//                    latitude:  11 + Math.random(),
//                    longitude: 45 + Math.random()
//                },
//                lastUpdate: (new Date).getTime() + (i * 2000)
//            };
//        };
//
//        var amount = 50;
//        var counter = 0;
//        for(var i = 0; i < amount; i++) {
//
//            var data = getData(i);
//            stream.push(data.channels, data.lastUpdate)
//                .then(function() {
//                    counter++;
//                })
//                .catch(console.log);
//        }
//
//        var intv = setInterval(function() {
//
//            if(counter !== amount) return;
//
//            clearInterval(intv);
//
//            setTimeout(function() {
//                stream.pull().then(function(data) {
//
////                    console.log(data);
////                    console.log(smartphone.id);
//
//                    expect(data.size()).toEqual(amount + 1);
//                })
//                .catch(console.log)
//                .finally(done);
//            }, 10000);
//
//
//        }, 100);
//
//    });
//
//    it('Delete SO', function(done) {
//        smartphone.delete()
//            .then(function(so) {
//                expect(so.id).toEqual(null);
//            })
//            .catch(console.log)
//            .finally(done);
//    });
});
