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
        cache.should.have.property("exists");
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
        var stored = 0;
        var result = {somekey: "a", anotherKey: 7, aDate: new Date("2016-01-01")};
        var workFunction = function (callback) {
            setTimeout(function(){callback(null, result, function(){
                stored += 1;
            })}, 50);
        };
        var count = 0;
        var complete = function(err, data, meta){
            count ++;
            should.exist(meta);

            meta.should.have.property("stale");
            meta.should.have.property("staleTime");
            meta.should.have.property("expiryTime");

            data.should.be.type("object");
            data.should.deepEqual(result);
            if(count == 3) {
                backend.storage.should.have.property(key);
                var stored = backend.storage[key];
                stored.should.have.property("data");
                stored.data.should.be.type("string");
                stored.data.should.equal('{"somekey":"a","anotherKey":7,"aDate":"2016-01-01T00:00:00.000Z"}');
                done();
            }
        }

        cache.get(key, workFunction, {}, complete);
        cache.get(key, workFunction, {}, complete);
        setTimeout(function () {
            cache.get(key, workFunction, {}, complete);
        }, 75);

    });
    test('should deal with serialization errors', function (done) {
        var Sifaka = require("../index.js").Sifaka;
        should.exist(Sifaka);
        var Backend = require("../backends/inmemory-test");
        var serializer = require("../serializers/test/error").error();
        var options = {statsInterval: 75, serializer: serializer};
        var backend = new Backend()
        var cache = new Sifaka(backend, options);
        var key = "abc";
        var stored = 0;
        var result = {somekey: "a", anotherKey: 7, aDate: new Date("2016-01-01")};
        var workCounter = 0;
        var workFunction = function (callback) {
            workCounter +=1;
            setTimeout(function(){callback(null, result, function(){
                stored += 1;
            })}, 50);
        };
        var count = 0;
        var complete = function(err, data, meta){
            count ++;
            
            should.exist(err);
            should.exist(meta);

            data.should.be.type("object"); // We still want the work to have occurred
            data.should.deepEqual(result);
            if(count == 3) {
                backend.storage.should.not.have.property(key);
                workCounter.should.equal(2);
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







