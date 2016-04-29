var assert = require('chai').assert;
var Promise = require('bluebird');

var compose;
var smartphone;
var smartphoneDefinition;

describe('ServiceObject', function () {

    before(function () {
        var composelib = require("../../index");
        compose = new composelib({
            // debug: true,
            apiKey: "Bearer token",
            url: "http://localhost:8080",
            transport: 'http'
        });
        smartphoneDefinition = require('./smartphone.so').definition;
    });


    it('Create SO', function () {
        return compose.create(smartphoneDefinition)
            .then(function (so) {
                assert.notEqual(so.id, null);
                smartphone = so;
                return Promise.resolve();
            });
    });


    it('List SO', function () {
        return compose.list()
            .then(function (list) {
                assert.equal(list.length > 0, true);
                return Promise.resolve();
            });
    });

    it('Load SO', function () {
        return compose.load(smartphone.id)
            .then(function (so) {
                assert.equal(so.id, smartphone.id);
            });
    });

    it('Update SO custom fields', function () {
        var time = new Date().getTime();
        smartphone.customFields.newTestField = time;
        return smartphone.update()
            .then(function (so) {
                assert.equal(smartphone.customFields.newTestField, time);
            });
    });

    it('Push and pull stream data', function (done) {

        var stream = smartphone.getStream('mylocation');
        var raw = {
            latitude: 11.123,
            longitude: 45.321
        };
        var lastUpdate = (new Date()).toString();

        var pushData = stream.prepareData(raw, lastUpdate);

        assert.equal(raw.longitude, pushData.channels.longitude['current-value']);
        assert.equal(lastUpdate, new Date(pushData.lastUpdate * 1000).toString());

        return stream.push(raw)
            .then(function () {

                setTimeout(function () {

                    stream.pull('lastUpdate')
                        .then(function (data, raw) {

                            var record = data.last();

                            expect(record.lastUpdate).toEqual(pushData.lastUpdate);
                            expect(record.get("latitude")).toEqual(pushData.channels.latitude['current-value']);

                        })
                        .catch(console.log)
                        .finally(done);

                }, 2000);
                return Promise.resolve();
            });

    });

    it('Push a bunch parallel requests', function (done) {

        var stream = smartphone.getStream('mylocation');
        var getData = function (i) {
            return {
                channels: {
                    latitude: 11 + Math.random(),
                    longitude: 45 + Math.random()
                },
                lastUpdate: (new Date()).getTime() + (i * 2000)
            };
        };

        var amount = 50;
        var counter = 0;
        for(var i = 0; i < amount; i++) {

            var data = getData(i);
            stream.push(data.channels, data.lastUpdate)
                .then(function () {
                    counter++;
                })
                .catch(console.log);
        }

        var intv = setInterval(function () {

            if(counter !== amount) return;

            clearInterval(intv);

            setTimeout(function () {
                stream.pull().then(function (data) {
                        assert.equal(data.size(), amount + 1);
                    })
                    .catch(console.log)
                    .finally(done);
            }, 10000);


        }, 100);

    });

    it('Delete SO', function () {
        return smartphone.delete()
            .then(function (so) {
                assert.equal(so.id, null);
                return Promise.resolve();
            });
    });
});
