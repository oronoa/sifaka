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
        var Sifaka = require("../index.js");
        should.exist(Sifaka);
        var Backend = require("../backends/inmemory-test");
        var options = {};
        var cache = new Sifaka(new Backend(), options)
        should.exist(cache);
        cache.should.have.property("get");
        done();
    });
    //test('should deal with errors in the work function', function (done) {
    //    var Sifaka = require("../index.js");
    //    should.exist(Sifaka);
    //    var Backend = require("../backends/inmemory-test");
    //    var options = {};
    //    var cache = new Sifaka(new Backend(), options)
    //    should.exist(cache);
    //    cache.should.have.property("get");
    //
    //    cache.get("abc", function (callback) {
    //        callback(new Error("Something went wrong"), null);
    //    }, {}, function (err, data) {
    //        should.exist(err);
    //        err.should.have.property("message", "Something went wrong");
    //        done();
    //    });
    //});
    //
    //test('should deal with errors in the work function when there is a pending queue', function (done) {
    //    var Sifaka = require("../index.js");
    //    should.exist(Sifaka);
    //    var Backend = require("../backends/inmemory-test");
    //    var options = {};
    //    var cache = new Sifaka(new Backend(), options)
    //
    //    var workFn = function (callback) {
    //        setTimeout(function () {
    //            callback(new Error("boom"), null);
    //        }, 300);
    //    }
    //
    //    var count = 0;
    //    var complete = function (err, data) {
    //        count += 1;
    //        should.exist(err);
    //        err.should.have.property("message", "boom");
    //        if(count == 2) {
    //            done();
    //        }
    //    }
    //    cache.get("abc", workFn, {}, complete);
    //    cache.get("abc", workFn, {}, complete);
    //});
    //
    //test('should cache with errors in the work function', function (done) {
    //    var Sifaka = require("../index.js");
    //    should.exist(Sifaka);
    //    var Backend = require("../backends/inmemory-test");
    //    var options = {};
    //    var cache = new Sifaka(new Backend(), options)
    //    var workCount = 1;
    //    var workFn = function (callback) {
    //        setTimeout(function () {
    //            var error = new Error("boom");
    //            error.cache = true;
    //            callback(error, null);
    //        }, 300);
    //    }
    //
    //    var count = 0;
    //    var complete = function (err, data) {
    //        count += 1;
    //        should.exist(err);
    //        err.should.have.property("message", "boom");
    //        if(count == 2) {
    //            workCount.should.equal(1);
    //            done();
    //        } else {
    //            cache.get("abc", workFn, {}, complete);
    //        }
    //    }
    //
    //    cache.get("abc", workFn, {}, complete);
    //});

    test('should emit stats', function (done) {
        var Sifaka = require("../index.js");
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
});







