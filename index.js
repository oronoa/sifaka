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
    this.initialLockCheckDelay = typeof options.initialLockCheckDelay !== "undefined" ? options.initialLockCheckDelay : 50;
    this.lockCheckInterval = typeof options.lockCheckInterval !== "undefined" ? options.lockCheckInterval : 50;
    this.lockCheckBackoff = typeof options.lockCheckBackoff !== "undefined" ? options.lockCheckBackoff : 50;
    this.cachePolicy = options.cachePolicy || new (require("./cache_policies/static"))();
    this.statsInterval = options.statsInterval || 0;
    this.stats = {hit: 0, miss: 0, work: 0};

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
    if(this.debugLogger) {
        this.debugLogger(new Date() * 1 + "\t" + message);
    }
};
Sifaka.prototype.get = function (key, workFn, options, callback) {
    var self = this;

    if(arguments.length === 3 && typeof arguments[2] === "function") {
        callback = options;
        options = {};
    }

    self.debug(key, "GET");

    if(this.locks[key]) {
        // This node is already polling the lock on this key
        self.debug(key, "CACHE MISS - LOCK PENDING");
        self._addPending(key, callback);
    } else {

        self.backend.get(key, options, function (err, data, state) {
            if(err) {
                if(typeof err === "string") {
                    err = new Error(err);
                }
                err.cached = true;
            }

            if(state.hit === true) {
                self.stats.hit++;
                self.debug(key, "CACHE HIT");
                callback(err, data);

                // check if we need to refresh the data in the background
                if(state.stale) {
                    self.stats.stale++;
                    self.backend.lock(key, null, function (err, acquired) {
                        if(acquired) {
                            self._doWork(key, workFn);
                        }
                    });
                }
            } else {
                self.stats.miss++;
                self._addPending(key, callback);
                self.debug(key, "CACHE MISS");
                self.backend.lock(key, null, function (err, acquired) {
                    if(acquired === true) {
                        self._doWork(key, workFn);
                    } else {
                        self.debug(key, "WAITING FOR LOCK");
                        self.locks[key] = self._watchLock(key); // We're already aware of this lock being held
                    }
                });
            }
        });
    }
};
Sifaka.prototype._addPending = function (key, callback) {
    this.debug(key, "PENDING ADDED");

    this.pendingCallbacks[key] = this.pendingCallbacks[key] || [];
    this.pendingCallbacks[key].push(callback);
};
Sifaka.prototype._calculateCacheTimes = function (key, duration, data, callback) {
    this.cachePolicy.calculate(key, duration, data, callback);
};
Sifaka.prototype._checkForResult = function (key) {
    var self = this;

    this.backend.get(key, {noLock: true}, function (err, data, state) {
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
            self._resolvePendingCallbacks(key, err, data);
        } else {
            self.lockCheckCounts[key] += 1;
            var nextInterval = self.lockCheckInterval + (self.lockCheckCounts[key] * self.lockCheckBackoff);
            self.locks[key] = setTimeout(function () {
                self._checkForResult(key)
            }, nextInterval);
            self.debug(key, "RESULT CHECK: MISS - CHECKING AGAIN IN " + nextInterval + "ms");
        }
    });

};
Sifaka.prototype._doWork = function (key, workFunction, callback) {
    var self = this;
    self.debug(key, "TRIGGERING WORK");
    var start = new Date();
    workFunction(function (workError, data) {
        self.stats.work++;
        var duration = new Date() - start;
        if(workError && !workError.cache) {
            self.backend.unlock(key, {}, function () {
                self._resolvePendingCallbacks(key, workError, data);
            });
        } else {
            self._calculateCacheTimes(key, duration, data, function (err, cachePolicyResult) {
                self.backend.store(key, data, workError, {unlock: true, cachePolicy: cachePolicyResult}, noop);
                self._resolvePendingCallbacks(key, workError, data);

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
Sifaka.prototype._resolvePendingCallbacks = function (key, err, data) {
    var self = this;
    if(self.locks[key]) {
        clearTimeout(self.locks[key]);
        self.locks[key] = null;
        self.backend.unlock(key, {}, noop);
    }

    this.debug(key, "RESOLVING PENDING CALLBACKS");
    this.pendingCallbacks[key] = this.pendingCallbacks[key] || [];
    while(this.pendingCallbacks[key].length) {
        var cb = this.pendingCallbacks[key].shift();
        cb(err, data);
    }
};
Sifaka.prototype._watchLock = function (key) {
    var self = this;
    self.lockCheckCounts[key] = 0;
    return setTimeout(function () {
        self._checkForResult(key)
    }, self.options.initialLockCheckDelay);
};
module.exports = Sifaka;