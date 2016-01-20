/*global suite, test, suiteSetup, suiteTeardown, setup, Object, Array */

var should = require('should');

var DEBUG = false;
var noop = function () {
};

suite('Core ', function () {
    suiteSetup(function (done) {
        done();
    });

    suiteTeardown(function (done) {
        done();
    });

    setup(function (done) {
        done();
    });

    test('should have basic properties', function (done) {
        var Sifaka = require("../index.js").Sifaka;
        should.exist(Sifaka);
        var Backend = require("../backends/inmemory-test");
        var options = {};
        var cache = new Sifaka(new Backend(), options)
        should.exist(cache);
        cache.should.have.property("get");
        done();
    });

    test('should emit stats', function (done) {
        var Sifaka = require("../index.js").Sifaka;
        should.exist(Sifaka);
        var Backend = require("../backends/inmemory-test");
        var options = {statsInterval: 75};
        var cache = new Sifaka(new Backend(), options)

        var stats = [];
        cache.on("stats", function (statsIn) {
            stats.push(statsIn);
        });
        should.exist(cache);
        cache.should.have.property("get");

        cache.get("abc", function (callback) {
            callback(null, "a");
        }, {}, function () {

            setTimeout(function () {
                cache.get("abc", function (callback) {
                    callback(null, "a");
                }, {}, noop);
            }, 100);
        });

        setTimeout(function () {
            stats.length.should.equal(2);
            stats[0].should.containEql({hit: 0, miss: 1, work: 1})
            stats[1].should.containEql({hit: 1, miss: 0, work: 0})
            done();
        }, 200)
    });

    test('should serialize', function (done) {
        var Sifaka = require("../index.js").Sifaka;
        should.exist(Sifaka);
        var Backend = require("../backends/inmemory-test");
        var serializer = require("../serializers/").json({reviver: require("../serializers/").jsonRevivers.ISODate});

        var options = {statsInterval: 75, serializer: serializer};
        var backend = new Backend()
        var cache = new Sifaka(backend, options);
        var key = "abc";

        var result = {somekey: "a", anotherKey: 7, aDate: new Date("2016-01-01")};
        var workFunction = function (callback) {
            setTimeout(function(){callback(null, result)}, 50);
        };
        var count = 0;
        var complete = function(err, data){
            count ++;
            backend.storage.should.have.property(key);
            var stored = backend.storage[key];
            stored.should.have.property("data");
            stored.data.should.be.type("string");
            stored.data.should.equal('{"somekey":"a","anotherKey":7,"aDate":"2016-01-01T00:00:00.000Z"}');
            data.should.be.type("object");
            data.should.deepEqual(result);
            if(count == 3) {
                done();
            }
        }

        cache.get(key, workFunction, {}, complete);
        cache.get(key, workFunction, {}, complete);
        setTimeout(function () {
            cache.get(key, workFunction, {}, complete);
        }, 75);

    });
});







