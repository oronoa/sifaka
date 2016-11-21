/*global suite, test, suiteSetup, suiteTeardown, setup, Object, Array */

var Backend = require("../../backends/inmemory-test");
var Sifaka = require("../../index.js").Sifaka;

var DEBUG = false;

var should = require('should');
suite('InMemoryTest Backend', function () {
    suiteSetup(function (done) {
        done();
    });

    suiteTeardown(function (done) {
        done();
    });

    setup(function (done) {
        done();
    });

    test('should contain a get method', function (done) {
        var b = new Backend();

        var CachePolicy = require("../../cache_policies/static");
        var policy = new CachePolicy({expiryTime: 100, staleTime: 10}); // Set to remove item after 100s, recalculate every 1s

        // First check the data isn't in the backend, and don't claim the lock, as we're not intending to do any work
        b.get("abc", {noLock: true}, function (err, data, status) {
            should.exist(status);
            status.should.have.property("hit", false);
            status.should.have.property("locked", false);
            status.should.have.property("ownLock", false);

            policy.calculate("abc", 10, "fasd", {}, {}, function (err, cp) {
                // Now set the data in the cache
                b.store("abc", 123, {}, null, cp, {}, function (err, success) {
                    // Try a get again, this time claiming the global lock
                    b.get("abc", {}, function (err, data, status, extra) {
                        should.exist(status);
                        status.should.have.property("hit", true);
                        status.should.have.property("locked", false);
                        status.should.have.property("ownLock", false);
                        should.exist(data);
                        data.should.equal(123);
                        done();
                    });
                });
            });
        });
    });

    test('continue to work if the cache backend fails', function (done) {
        // If the backend "goes away" (network issues or similar), we still want to try do somethign sensible and return a value if we can.
        // If the get fails (returns an error with.cacheUnavailable = true), then add in a pending callback, and queue up requests for the same thing.
        // Do work locally.
        // When the backend becomes available again, carry on as normal. Mocked up using the in-memory backend

        this.timeout(5000);

        var b = new Backend();

        var CachePolicy = require("../../cache_policies/static");
        var policy = new CachePolicy({expiryTime: 100, staleTime: 10}); // Set to remove item after 100s, recalculate every 1s

        var cache = new Sifaka(b, {policy: policy, debug: DEBUG})
        should.exist(cache);

        b.operationsFail = true; // Cause ops to fail
        var key = "abc";
        var returnValue = "12345asdf";
        var callCount = 0;
        var workFunction = function (callback) {
            callCount += 1;
            setTimeout(function () {
                callback(null, returnValue, {test: "a", second: "b"});
            }, 300);
        };
        var completionCount = 0;
        var complete = function (err, data, meta, extra) {
            should.not.exist(err);
            should.exist(data);
            should.exist(meta);
            should.exist(extra);
            extra.should.be.type("object");
            extra.should.have.property("test", "a");
            extra.should.have.property("second", "b");

            data.should.equal("12345asdf");
            completionCount += 1;

            if(completionCount == 2) { // Two original requests - should have been served from one call.
                callCount.should.equal(1);
                setTimeout(function () {
                    cache.get(key, workFunction, complete);
                }, 100);
            }

            if(completionCount == 3) {
                // another, should be have been served by another call to work
                callCount.should.equal(2);
                b.storage.should.not.have.property(key);
                b.operationsFail = false; // Fix everything
                setTimeout(function () {
                    cache.get(key, workFunction, complete);
                }, 100);
            }
            if(completionCount == 4) {
                setTimeout(function () {
                    cache.get(key, workFunction, complete);
                }, 100);
            }

            if(completionCount == 5) {
                callCount.should.equal(3);
                b.storage.should.have.property(key);
                done();
            }

        }

        cache.get(key, workFunction, complete);
        setTimeout(function () {
            cache.get(key, workFunction, complete);
        }, 100);

    });
    
    
    
   test('not fail if a remote lock expires', function (done) {
        // If a remote worker obtains the lock, then dies without returning data, the other workers will check the remote lock
        // Until it times out. When this happens, a worker will get the lock

        this.timeout(5000);

        var b = new Backend();

        var CachePolicy = require("../../cache_policies/static");
        var policy = new CachePolicy({expiryTime: 100, staleTime: 10}); // Set to remove item after 100s, recalculate every 1s
        var cache = new Sifaka(b, {policy: policy, debug: DEBUG,
            initialLockCheckDelayMs: 20,
            lockCheckIntervalMs: 20,
            lockCheckBackoffMs: 10,
            lockCheckBackoffExponent: 1.6
        })
        should.exist(cache);

        var key = "abc";
        var returnValue = "12345asdf";
        var callCount = 0;
      
        var workFunction = function (callback) {
            callCount += 1;
            setTimeout(function () {
                callback(null, returnValue, {test: "a", second: "b"});
            }, 300);
        };
        var completionCount = 0;
        var complete = function (err, data, meta, extra) {
            should.not.exist(err);
            should.exist(data);
            should.exist(meta);
            should.exist(extra);
            extra.should.be.type("object");
            extra.should.have.property("test", "a");
            extra.should.have.property("second", "b");

            data.should.equal("12345asdf");
            completionCount += 1;

            if(completionCount == 2) { // Two original requests - should have been served from one call.
                callCount.should.equal(1);
                setTimeout(function () {
                    cache.get(key, workFunction, complete);
                }, 100);
            }

            if(completionCount == 3) {
                // another, should be have been served by another call to work
                callCount.should.equal(1);
                setTimeout(function () {
                    cache.get(key, workFunction, complete);
                }, 100);
            }
            if(completionCount == 4) {
                setTimeout(function () {
                    cache.get(key, workFunction, complete);
                }, 100);
            }

            if(completionCount == 5) {
                callCount.should.equal(1);
                b.storage.should.have.property(key);
                done();
            }

        }
       
        
        // Set the remote lock as something else
        b._locks[key] = "SOMEREMOTELOCK";
        b.storage[key] = {
           "data": "12345asdf",
           "extra": {
             "test": "a",
             "second": "b"
           }
         }
         b.timings[key] = {expiry: new Date() - 1000, stale: new Date()-30000}
       
       cache.get(key, workFunction, complete); // Will hit the remote lock, will wait for it to expire
       cache.get(key, workFunction, complete); // Will hit the remote lock, will wait for it to expire
       
       setTimeout(function(){
           cache.get(key, workFunction, complete); // Will hit the remote lock, will wait for it to expire
       }, 150);
       
       setTimeout(function(){
           cache.debug(key, "Remote Lock Removed")
           delete b._locks[key];
       }, 300);
    });

    var sharedTests = require("./common_tests")(DEBUG);
    var runTest = function (testName, tst) {
       test(testName, function (done) {
           var testFn = tst.bind(this);
           var b = new Backend();
           return testFn(b, done)
       });
    }

    for(var testName in sharedTests) {
       runTest(testName, sharedTests[testName]);
    }

});








