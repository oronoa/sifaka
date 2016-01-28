/*global suite, test, suiteSetup, suiteTeardown, setup, Object, Array */

var Backend = require("../../backends/redis");
var redis = require("redis");
var DEBUG = false;
var should = require('should');
var client;
suite('Redis Backend', function () {
    suiteSetup(function (done) {
        done();
    });

    suiteTeardown(function (done) {
        done();
    });

    setup(function (done) {
        var host = "localhost";
        client = redis.createClient({host: host, return_buffers: true, prefix: "sifaka-test:"});
        var multi = client.multi();
        client.del("test:data:abc");
        client.del("test:lock:abc");
        multi.exec(function (err, data) {
            if(err) {
                throw err;
            }
            done();
        });
    });

    test('should contain a get method', function (done) {
        var b = new Backend({namespace: "test", client: client});

        var CachePolicy = require("../../cache_policies/static");
        var policy = new CachePolicy({expiryTime: 100, staleTime: 10}); // Set to remove item after 100s, recalculate every 1s
        // First check the data isn't in the backend, and don't claim the lock, as we're not intending to do any work
        b.get("abc", {noLock: true}, function (err, data, status) {
            should.exist(status);
            status.should.have.property("hit", false);
            status.should.have.property("locked", false);
            status.should.have.property("ownLock", false);
            status.should.have.property("stale", false);
            status.should.have.property("expired", false);

            policy.calculate("abc", 10, "fasd", {}, {}, function (err, cp) {
                // Now set the data in the cache
                b.store("abc", 123,{}, null, cp, {}, function (err, success) {
                    // Try a get again, this time claiming the global lock
                    b.get("abc", {}, function (err, data, status) {
                        should.exist(status);
                        status.should.have.property("hit", true);
                        status.should.have.property("locked", false);
                        status.should.have.property("ownLock", false);
                        status.should.have.property("stale", false);
                        status.should.have.property("expired", false);
                        should.exist(data);

                        data = data * 1; // Remeber, we need to cast back from a string
                        data.should.equal(123);
                        done();
                    });
                });
            });
        });
    });

    var sharedTests = require("./common_tests")(DEBUG);
    var runTest = function (testName, tst) {
        test(testName, function (done) {
            var testFn = tst.bind(this);
            var b = new Backend({namespace: "test", client: client});
            return testFn(b, done)
        });
    }

    for(var testName in sharedTests) {
        runTest(testName, sharedTests[testName]);
    }

});








