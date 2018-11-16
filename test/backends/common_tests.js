var should = require("should");
var Sifaka = require("../../index.js").Sifaka;



var errorIfCalled = function(callback){
    callback(new Error("Should not be called"));
}



module.exports = function (DEBUG) {
    return {
        'should pass through a get to a work function': function (backend, done) {
            should.exist(Sifaka);
            var options = {debug: DEBUG};
            var cache = new Sifaka(backend, options)
            should.exist(cache);

            var returnValue = "12345asdf";
            cache.get("abc", function (callback) {
                var extraData = {test: "a", second: "b"};
                callback(null, returnValue, extraData);
            }, {}, function (err, data, meta, extra) {
                should.exist(meta);
                should.exist(extra);
                extra.should.be.type("object");
                extra.should.have.property("test", "a");
                extra.should.have.property("second", "b");
                should.not.exist(err);
                should.exist(data);
                data.should.equal("12345asdf");
                meta.should.have.property("stale");
                meta.should.have.property("hit", false);
                meta.should.have.property("staleTime");
                setTimeout(function () {
                    cache.get("abc", function (callback) {
                        var extraData = {test: "a", second: "b"};
                        callback(null, returnValue, extraData);
                    }, {}, function (err, data, meta, extra) {
                        should.exist(meta);
                        should.exist(extra);
                        extra.should.be.type("object");
                        extra.should.have.property("test", "a");
                        extra.should.have.property("second", "b");
                        meta.should.have.property("hit", true);
                        done();
                    });
                }, 500);
            });
        },

        'should correctly return a positive exists call': function (backend, done) {
            should.exist(Sifaka);
            var options = {debug: DEBUG};
            var cache = new Sifaka(backend, options)
            should.exist(cache);

            var returnValue = "12345asdf";
            cache.get("abc", function (callback) {
                callback(null, returnValue, {test: "a", second: "b"});
            }, {}, function (err, data, meta) {
                should.exist(meta);
                should.not.exist(err);
                should.exist(data);
                data.should.equal("12345asdf");
                meta.should.have.property("stale");
                meta.should.have.property("staleTime");
                cache.exists("abc", {}, function (err, exists, meta) {
                    should.exist(meta)
                    meta.hit.should.equal(true);
                    meta.should.have.property("stale");
                    meta.should.have.property("staleTime");

                    exists.should.equal(true);
                    done();
                })
            });
        },

        'should correctly return a negative exists call': function (backend, done) {
            should.exist(Sifaka);
            var options = {debug: DEBUG};
            var cache = new Sifaka(backend, options)
            should.exist(cache);
            cache.exists("abc", {}, function (err, exists, meta) {
                should.exist(meta);
                meta.hit.should.equal(false);
                exists.should.equal(false);
                done();
            });

        },

        'should only fire the work function once': function (backend, done) {
            should.exist(Sifaka);
            var options = {debug: DEBUG};
            var cache = new Sifaka(backend, options)
            should.exist(cache);
            var key = "abc";
            var returnValue = "12345asdf";
            var callCount = 0;
            var workFunction = function (callback) {
                callCount += 1;
                setTimeout(function () {
                    callback(null, returnValue, {test: "a", second: "b"});
                }, 1000);
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

                if(completionCount == 2) {
                    callCount.should.equal(1);

                    if(backend.name == "inmemory-test") {// In-memory only
                        backend.should.have.property("_locks");
                        backend._locks.should.have.property(key, null);
                    }
                    done();
                }
            }

            cache.get(key, workFunction, {}, complete);
            cache.get(key, workFunction, {}, complete);
        },

        'should return only meta when requested on hit': function (backend, done) {

            should.exist(Sifaka);
            var options = {debug: DEBUG};
            var cache = new Sifaka(backend, options)
            should.exist(cache);
            var key = "abc";
            var returnValue = "12345asdf";
            var callCount = 0;
            var workFunction = function (callback) {
                callCount += 1;
                setTimeout(function () {
                    cache.debug("", "Finished Work")
                    callback(null, returnValue, {test: "a", second: "b"}, function (err, succeeded) {
                        should.not.exist(err);
                        succeeded.should.equal(true);
                        cache.get(key, errorIfCalled, {metaOnly: "hit"}, complete);
                    });
                }, 300);
            };
            var completionCount = 0;
            var complete = function (err, data, meta, extra) {
                should.not.exist(err);

                should.exist(meta);

                completionCount += 1;

                should.exist(extra);
                extra.should.be.type("object");
                extra.should.have.property("test", "a");
                extra.should.have.property("second", "b");

                if(completionCount < 3) {
                    meta.hit.should.equal(false, "Completion " + completionCount + " should have been a miss, but registered as a hit.");
                    meta.should.have.property("pending", true);
                    meta.should.have.property("stale");
                    meta.should.have.property("staleTime");
                    should.exist(data);
                    data.should.equal(returnValue);
                }

                if(completionCount == 3) {
                    callCount.should.equal(1);
                    meta.should.not.have.property("pending");
                    meta.should.have.property("stale");
                    meta.should.have.property("staleTime");
                    meta.hit.should.equal(true);
                    should.not.exist(data);
                    done();
                }
            }

            cache.get(key, workFunction, {metaOnly: "hit"}, complete);
            cache.get(key, workFunction, {metaOnly: "hit"}, complete);
        },

        'should return only meta when requested on miss': function (backend, done) {

            should.exist(Sifaka);
            var options = {debug: DEBUG};
            var cache = new Sifaka(backend, options)
            should.exist(cache);
            var key = "abc";
            var returnValue = "12345asdf";
            var callCount = 0;
            var workFunction = function (callback) {
                callCount += 1;
                setTimeout(function () {
                    callback(null, returnValue, {test: "a", second: "b"});
                    // Trigger the third cache call once we know we will get a hit
                    setTimeout(function () {
                        cache.get(key, errorIfCalled, {metaOnly: "miss"}, complete)
                    }, 200);
                }, 200);
            };
            var completionCount = 0;
            var complete = function (err, data, meta, extra) {
                should.not.exist(err);

                should.exist(meta);

                completionCount += 1;

                if(completionCount < 3) {
                    // first two requests should be misses, and no work should happen
                    callCount.should.equal(0);
                    meta.hit.should.equal(false);
                    meta.should.not.have.property("pending"); // We should have bypassed the pending callbacks
                    should.not.exist(data);
                }

                if(completionCount == 2) {
                    // Trigger a full-fat request, so we get a hit
                    cache.get(key, workFunction, {}, complete);
                }

                if(completionCount == 3) {
                    // Response from normal query
                    callCount.should.equal(1);
                    should.exist(data);

                    should.exist(extra);
                    extra.should.be.type("object");
                    extra.should.have.property("test", "a");
                    extra.should.have.property("second", "b");
                    data.should.equal(returnValue);

                }

                if(completionCount == 4) {
                    callCount.should.equal(1);
                    meta.should.not.have.property("pending");
                    meta.hit.should.equal(true);
                    should.exist(data);
                    data.should.equal(returnValue);
                    done();
                }
            }

            cache.get(key, workFunction, {metaOnly: "miss"}, complete);
            cache.get(key, workFunction, {metaOnly: "miss"}, complete);
        },

        'should resolve callbacks on a lock held elsewhere': function (backend, done) {
            this.timeout(5000);
            should.exist(Sifaka);

            var CachePolicy = require("../../cache_policies/static");
            var policy = new CachePolicy({expiryTime: 100, staleTime: 10}); // Set to remove item after 100s, recalculate every 1s

            var options = {debug: DEBUG, initialLockCheckDelayMs: 50, lockCheckIntervalMs: 200, lockCheckBackoffMs: 0};
            var cache = new Sifaka(backend, options)
            should.exist(cache);

            var key = "abc";
            var returnValue = "12345asdf";
            var callCount = 0;
            var workFunction = function () {
                callCount += 1;
                throw new Error("Should not be called");
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

                if(completionCount == 2) {
                    callCount.should.equal(0); // We never called "our" work function
                    cache.remoteLockChecks.should.not.have.property(key);
                    if(backend.name == "inmemory-test") {// In-memory only
                        backend.should.have.property("_locks");
                        backend._locks.should.have.property(key, null);
                    }
                    done();
                }
            }

            // Simulate a remote lock being claimed
            backend.get(key, {}, function (err, data, state, extra) {
                state.should.have.property("hit", false);
                state.should.have.property("ownLock", false);
                state.should.have.property("locked", false);

                backend.lock(key, {lockID: "someOtherValue"}, function (err, acquired) {
                    acquired.should.equal(true);

                    if(backend.name == "inmemory-test") {// In-memory only
                        backend.should.have.property("_locks");
                        backend._locks.should.have.property(key, "someOtherValue");
                    }
                    setTimeout(function () {
                        policy.calculate("abc", 10, "fasd", {}, {}, function (err, cp) {
                            backend.store(key, returnValue, {
                                test: "a", second: "b"
                            }, null, cp, {unlock: true}, function () {
                            });
                        });
                    }, 1000);
                });
            });

            // Make two calls to get - these will need to wait for the remote work (above) to complete before a result is available.
            cache.get(key, workFunction, {}, complete);
            cache.get(key, workFunction, {}, complete);
        },

        /**
         * Two requests come in before the work has been done. A third request comes in after the work is complete. The 3rd
         * should be returned directly from the cache.
         */
        'should return result from cache after pendingCallbacks have cleared': function (backend, done) {
            should.exist(Sifaka);
            var options = {debug: DEBUG};
            var cache = new Sifaka(backend, options)
            should.exist(cache);

            var returnValue = "12345asdf";
            var callCount = 0;
            var workFunction = function (callback) {
                callCount += 1;
                setTimeout(function () {
                    callback(null, returnValue, {test: "a", second: "b"});
                }, 200);
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

                if(completionCount == 3) {
                    callCount.should.equal(1);
                    done();
                }
            }

            cache.get("abc", workFunction, {}, complete);
            cache.get("abc", workFunction, {}, complete);
            setTimeout(function () {
                cache.get("abc", workFunction, {}, complete);
            }, 500);

        },

        /**
         * Two requests come in before the work has been done. A third request comes in after the work is complete. The 3rd
         * should be returned directly from the cache.
         */
        'should respect a noCache flag set by the policy calculation and not store the result': function (backend, done) {
            should.exist(Sifaka);
            var options = {debug: DEBUG};
            var cache = new Sifaka(backend, options)
            should.exist(cache);
            var Policy = require("../../cache_policies").noCache;
            var policy = new Policy();

            var returnValue = "12345asdf";
            var callCount = 0;
            var workFunction = function (callback) {
                callCount += 1;
                setTimeout(function () {
                    callback(null, returnValue, {test: "a", second: "b"});
                }, 200);
            };
            var completionCount = 0;
            var complete = function (err, data, meta, extra) {
                should.exist(meta);
                should.not.exist(err);
                should.exist(data);
                data.should.equal("12345asdf");

                should.exist(extra);
                extra.should.be.type("object");
                extra.should.have.property("test", "a");
                extra.should.have.property("second", "b");
                completionCount += 1;

                if(completionCount == 3) {
                    callCount.should.equal(2); // The third call should also hit the work function
                    done();
                }
            }

            cache.get("abc", workFunction, {policy: policy}, complete);
            cache.get("abc", workFunction, {policy: policy}, complete);
            setTimeout(function () {
                cache.get("abc", workFunction, {policy: policy}, complete);
            }, 500);

        },

        /**
         * Two requests come in before the work has been done. A third request comes in after the work is complete. The 3rd
         * should be returned directly from the cache.
         */
        'should refresh data in the background': function (backend, done) {
            this.timeout(5000);
            should.exist(Sifaka);
            var CachePolicy = require("../../cache_policies/static");

            var policy = new CachePolicy({expiryTime: 100, staleTime: 1}); // Set to remove item after 100s, recalculate every 1s

            var options = {debug: DEBUG, cachePolicy: policy};
            var cache = new Sifaka(backend, options)
            should.exist(cache);

            var returnValues = ["12345asdf", "wibble"];

            var callCount = 0;
            var workFunction = function (callback) {
                var result = returnValues[callCount];
                callCount += 1;
                setTimeout(function () {
                    callback(null, result, {test: "a", second: "b"});
                }, 200);
            };
            var completionCount = 0;

            var complete = function (err, data, meta, extra) {
                should.not.exist(err);
                should.exist(data);

                should.exist(extra);
                extra.should.be.type("object");
                extra.should.have.property("test", "a");
                extra.should.have.property("second", "b");

                var duration = new Date() - start;

                completionCount += 1;

                //console.log("Complete: " + completionCount + "\t" + data + "\t" + duration)
                switch(completionCount) {
                    case 1:
                        data.should.equal("12345asdf");
                        duration.should.be.approximately(220, 40);
                        break;
                    case 2:
                        data.should.equal("12345asdf");
                        duration.should.be.approximately(550, 50);
                        break;
                    case 3:
                        data.should.equal("12345asdf");
                        duration.should.be.approximately(1550, 50);
                        break;
                    case 4:
                        data.should.equal("wibble");
                        duration.should.be.approximately(2050, 50);
                        done();
                        break;
                    default:
                        throw new Error("Too many completions");
                }

            }

            var start = new Date();

            // Should cause 1x workfunction
            cache.get("abc", workFunction, {}, complete);
            setTimeout(function () {
                cache.get("abc", workFunction, {}, complete);
            }, 500);

            // Should return the stale value, immediately
            setTimeout(function () {
                cache.get("abc", workFunction, {}, complete);
            }, 1500);

            // Should return the new value, immediately
            setTimeout(function () {
                cache.get("abc", workFunction, {}, complete);
            }, 2000);

        },

        'should deal with errors in the work function': function (backend, done) {
            var options = {};
            var cache = new Sifaka(backend, options)
            should.exist(cache);
            cache.should.have.property("get");

            cache.get("abc", function (callback) {
                callback(new Error("Something went wrong"), null);
            }, {}, function (err, data) {
                should.exist(err);
                err.should.have.property("message", "Something went wrong");
                done();
            });
        },

        'should deal with errors in the work function when there is a pending queue': function (backend, done) {
            var options = {};
            var cache = new Sifaka(backend, options)

            var workFn = function (callback) {
                setTimeout(function () {
                    callback(new Error("boom"), null);
                }, 300);
            }

            var count = 0;
            var complete = function (err, data) {
                count += 1;
                should.exist(err);
                err.should.have.property("message", "boom");
                if(count == 2) {
                    done();
                }
            }
            cache.get("abc", workFn, {}, complete);
            cache.get("abc", workFn, {}, complete);
        },

        'should cache with errors in the work function': function (backend, done) {
            var options = {};
            var cache = new Sifaka(backend, options)
            var workCount = 1;
            var workFn = function (callback) {
                setTimeout(function () {
                    var error = new Error("boom");
                    error.cache = true;
                    callback(error, null);
                }, 300);
            }

            var count = 0;
            var complete = function (err, data) {
                count += 1;
                should.exist(err);
                err.should.have.property("message", "boom");
                if(count == 2) {
                    workCount.should.equal(1);
                    err.should.have.property("cached", true);
                    done();
                } else {
                    setTimeout(function () {
                        cache.get("abc", workFn, {}, complete);
                    }, 500);
                }
            }
            cache.get("abc", workFn, {}, complete);
        }
    };
};