"use strict";
var EventEmitter = require('events');
var noop = function () {
};

function Sifaka(backend, options) {
    EventEmitter.call(this);
    var self = this;

    this.options = options || {};
    this.backend = backend;
    this.storage = {};
    this.debugLogger = (options.debug === true ? console.log : options.debug) || null;
    this.initialLockCheckDelay = typeof options.initialLockCheckDelay !== "undefined" ? options.initialLockCheckDelay : 20;
    this.lockCheckInterval = typeof options.lockCheckInterval !== "undefined" ? options.lockCheckInterval : 20;
    this.lockCheckBackoff = typeof options.lockCheckBackoff !== "undefined" ? options.lockCheckBackoff : 20;
    this.cachePolicy = options.cachePolicy || new (require("./cache_policies/static"))();
    this.statsInterval = options.statsInterval || 0;
    this.serializer = options.serializer || null;
    this.stats = {hit: 0, miss: 0, work: 0};
    this.name = options.name || null;

    if(this.statsInterval) {
        this.lastStats = new Date();
        setTimeout(function () {
            self._logStats();
        }, this.statsInterval);
    }

    if(this.debugLogger) {
        this.debug("", "---- Initialising Cache ----")
    }

    this.namespace = options.namespace || null;
    this.pendingCallbacks = {};
    this.locks = {};
    this.lockCheckCounts = {};

}

require("util").inherits(Sifaka, EventEmitter);

Sifaka.prototype.debug = function (key, message) {
    if(this.namespace) {
        message = this.namespace + ":" + key + "\t" + message;
    } else {
        message = key + "\t" + message;
    }

    if(this.name) {
        message = "[" + this.name + "]\t" + message;
    }

    if(this.debugLogger) {
        this.debugLogger(new Date() * 1 + "\t" + message);
    }
};

Sifaka.prototype.toString = function () {
    var message = "Sifaka";
    if(this.name) {
        message += " [" + this.name + "]\n";
    }

    message += require("util").inspect(this.stats);
    return message;
};

Sifaka.prototype.exists = function (key, options, callback) {
    if(arguments.length === 2 && typeof arguments[1] === "function") {
        callback = options;
        options = {};
    }
    this.backend.exists(key, options, callback);
};

Sifaka.prototype.get = function (key, workFn, options, callback) {
    var self = this;

    if(arguments.length === 3 && typeof arguments[2] === "function") {
        callback = options;
        options = {};
    }
    if(options.metaOnly && ["hit", "miss"].indexOf(options.metaOnly) == -1) {
        throw new RangeError("options.metaOnly should be one of hit or miss");
    }

    self.debug(key, "GET");

    if(this.locks[key]) {
        // This node is already polling the lock on this key
        self.debug(key, "CACHE MISS - LOCK PENDING");
        self._addPending(key, callback, options);
    } else {

        self.backend.get(key, options, function (err, data, state, extra) {
            if(err) {
                if(typeof err === "string") {
                    err = new Error(err);
                }
                if(typeof err.cached === 'undefined') {
                    err.cached = true;
                }
            }

            if(state.hit === true) {
                self.stats.hit++;
                self.debug(key, "CACHE HIT");

                if(options.metaOnly === "hit") {
                    // Pass "data" through here - so that we can verify in the tests that the backends are returning
                    // undefined (and hopefully not fetching data from the store)
                    callback(err, data, state, extra);
                } else {
                    self._deserialize(data, extra, function (deserializeErr, deSerializedData, deSerializedExtra) {
                        callback(err || deserializeErr, deSerializedData, state, deSerializedExtra);
                    });
                }

                // check if we need to refresh the data in the background
                if(state.stale) {
                    self.stats.stale++;
                    self.backend.lock(key, null, function (err, acquired) {
                        if(acquired) {
                            self.debug(key, "GOT LOCK FOR STALE REFRESH");

                            self._doWork(key, options, workFn, state);
                        }

                    });
                }
            } else {
                self.stats.miss++;
                if(options.metaOnly === "miss") {
                    // We don't need to wait for a result to be calculated, or trigger one
                    self.debug(key, "META ONLY CACHE MISS");
                    return callback(err, void 0, state);
                } else {
                    self._addPending(key, callback, options);
                }
                self.debug(key, "CACHE MISS");

                if(err && err.cacheUnavailable === true) { // Failed to get, so lets try to do the work once, locally
                    if(!self.locks[key] || self.locks[key]._called) {
                        self.locks[key] = self._watchLock(key); // We're already aware of this lock being held
                        self.debug(key, "UNABLE TO READ CACHE - DOING WORK");
                        self._doWork(key, options, workFn, state);
                    }
                } else {
                    self.backend.lock(key, null, function (err, acquired) {
                        if(acquired === true) {
                            self.debug(key, "GOT LOCK");
                            self._doWork(key, options, workFn, state);
                        } else {
                            self.debug(key, "WAITING FOR LOCK");
                            if(!self.locks[key] || self.locks[key]._called) {
                                self.locks[key] = self._watchLock(key); // We're already aware of this lock being held
                            }
                        }
                    });
                }
            }
        });
    }
};
Sifaka.prototype._addPending = function (key, callback, options) {
    this.debug(key, "PENDING ADDED");

    this.pendingCallbacks[key] = this.pendingCallbacks[key] || [];
    this.pendingCallbacks[key].push({options: options, cb: callback});
};
Sifaka.prototype._calculateCacheTimes = function (key, duration, data, extra, state, options, callback) {
    options = options || {};
    extra = extra || {};
    (options.policy || this.cachePolicy).calculate(key, duration, data, extra, state, callback);
};
Sifaka.prototype._checkForResult = function (key) {
    var self = this;

    this.backend.get(key, {noLock: true}, function (err, data, state, extra) {
        if(state.hit) {
            if(err) {
                if(typeof err === "string") {
                    err = new Error(err);
                }
                err.cached = true;
            }
            self.debug(key, "RESULT CHECK: HIT");
            self.locks[key] = null;
            self.lockCheckCounts[key] = 0;
            self._deserialize(data, extra, function (err, deSerializedData, deSerializedExtra) {
                self._resolvePendingCallbacks(key, err, deSerializedData, deSerializedExtra, false, state);
            });
        } else {
            self.lockCheckCounts[key] += 1;
            var nextInterval = self.lockCheckInterval + (self.lockCheckCounts[key] * self.lockCheckBackoff);
            if(!self.locks[key] || self.locks[key]._called) {
                self.locks[key] = setTimeout(function () {
                    self._checkForResult(key)
                }, nextInterval);
                self.debug(key, "RESULT CHECK: MISS - CHECKING AGAIN IN " + nextInterval + "ms");
            }
        }
    });
};

Sifaka.prototype._serialize = function (data, extra, callback) {
    var serializer = this.options.serializer;
    if(serializer) {
        serializer.serialize(data, extra, {}, callback);
    } else {
        callback(null, data, extra);
    }
};
Sifaka.prototype._deserialize = function (data, extra, callback) {
    var serializer = this.options.serializer;
    if(serializer) {
        serializer.deserialize(data, extra, {}, callback);
    } else {
        callback(null, data, extra);
    }
};

Sifaka.prototype._doWork = function (key, options, workFunction, state, callback) {
    var self = this;
    self.debug(key, "TRIGGERING WORK");
    var start = new Date();
    workFunction(function (workError, data, extra, storedCallback) {
        if(arguments.length == 3 && typeof extra === "function") {
            storedCallback = extra;
            extra = null;
        }

        if(typeof extra == "undefined") {
            extra = null;
        }

        self.stats.work++;
        var duration = new Date() - start;
        if(workError && !workError.cache) {
            self.debug(key, "ERROR, NOT CACHED: " + workError + " - UNLOCKING");

            self.backend.unlock(key, {}, function () {
                self.debug(key, "UNLOCKED AFTER WORK THAT ERRORED");
                self._resolvePendingCallbacks(key, workError, data, extra, true, state);
            });
        } else {
            self._calculateCacheTimes(key, duration, data, extra, state, options, function (err, cachePolicyResult) {

                if(!cachePolicyResult.noCache) {

                    state.staleTime = cachePolicyResult.staleTimeAbs;
                    state.expiryTime = cachePolicyResult.expiryTimeAbs;

                    self._serialize(data, extra, function (err, serializedData, serializedExtra) {
                        self.debug(key, "STORING AND UNLOCKING....");
                        self.backend.store(key, serializedData, serializedExtra, workError, cachePolicyResult, {
                            unlock: true
                        }, function (storedError, storedResult) {

                            if(storedError || !storedResult){
                                throw(storedError);
                            }

                            self._resolvePendingCallbacks(key, workError, data, extra, true, state);
                            if(storedCallback) {
                                storedCallback(storedError, storedResult);
                            }
                        });
                    });
                } else {
                    self.debug(key, "UNLOCKING - NOCACHE FROM POLICY");
                    self.backend.unlock(key, options, function () {
                        self._resolvePendingCallbacks(key, workError, data, extra, true, state);
                    });
                }

                // Needed?
                if(callback) {
                    callback(null);
                }
            });
        }
    });
};
Sifaka.prototype._logStats = function () {
    var self = this;
    var currentStats = this.stats;
    var lastStats = this.lastStats;
    this.lastStats = new Date();
    setTimeout(function () {
        self._logStats()
    }, this.statsInterval);
    currentStats.duration = this.lastStats - lastStats;
    this.stats = {hit: 0, miss: 0, work: 0};
    this.emit("stats", currentStats);
};
Sifaka.prototype._resolvePendingCallbacks = function (key, err, data, extra, didWork, state) {
    var self = this;
    if(self.locks[key]) {
        clearTimeout(self.locks[key]);
        self.locks[key] = null;
        if(!didWork) {
            self.debug(key, "UNLOCKING");

            self.backend.unlock(key, {}, noop);
        }
    }

    this.debug(key, "RESOLVING PENDING CALLBACKS");
    this.pendingCallbacks[key] = this.pendingCallbacks[key] || [];
    state.pending = true;
    while(this.pendingCallbacks[key].length) {
        var pending = this.pendingCallbacks[key].shift();
        var cb = pending.cb;
        var options = pending.options;

        if(options.metaOnly && options.metaOnly == "miss") {
            cb(err, void 0, state, extra);
        } else {
            cb(err, data, state, extra);
        }
    }
};
Sifaka.prototype._watchLock = function (key) {
    var self = this;
    self.lockCheckCounts[key] = 0;

    if(!self.locks[key] || self.locks[key]._called) {
        return setTimeout(function () {
            self._checkForResult(key)
        }, self.options.initialLockCheckDelay);
    } else {
        return self.locks[key];
    }
};
module.exports = {
    Sifaka: Sifaka,
    backends: require("./backends"),
    cache_policies: require("./cache_policies"),
    serializers: require("./serializers")
};