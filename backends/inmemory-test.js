"use strict";

/**
 * InMemoryTest storage for local testing only. Do not use in any form of production.
 * Does not feature any data expiry.
 * @param options
 * @constructor
 */
function InMemoryTest(options) {
    this.options = options || {};
    this.storage = {};
    this._locks = {};
    this.lockID = (Math.random() * 1E12).toString(36);
    this.timings = {};
    this.operationsFail = false;
    this.name = "inmemory-test";
}
InMemoryTest.prototype.clear = function (callback) {
    this._locks = {};
    this.timings = {};
    this.storage = {};
}
InMemoryTest.prototype._getState = function (key, callback) {
    var expiryState = {expired: false, stale: false};
    var timings = this.timings[key] || {};
    var now = new Date();

    expiryState.staleTime = timings.stale;
    expiryState.expiryTime = timings.expiry;

    if(timings.expiry && timings.expiry < now) {
        expiryState.expired = true;
    }

    if(timings.stale && timings.stale < now) {
        expiryState.stale = true;
    }

    callback(null, expiryState);

}

InMemoryTest.prototype.get = function (key, options, callback) {
    var state = {locked: false, ownLock: false, stale: false, hit: false};
    var self = this;

    if(this.operationsFail) { // Allow operations to fail for testing
        var error = new Error("Cache Unavailable");
        error.cacheUnavailable = true;
        return callback(error, null, state);
    }

    this._getState(key, function (err, expiryState) {

        // Figure out lock state
        if(self._locks[key]) {
            state.ownLock = (self._locks[key] === self.lockID); // Someone else got to the lock if they don't match. Contrived for testing
            state.locked = true;
        }

        if(typeof self.storage[key] !== "undefined" && !expiryState.expired) {
            state.hit = true;
            state.stale = expiryState.stale;
            state.expiryTime = expiryState.expiryTime;
            state.staleTime = expiryState.staleTime;
        } else {
            state.hit = false;
        }

        var data = self.storage[key];
        err = null;
        if(data) {
            err = data.error || null;
        }

        var value = void 0;
        var extra = void 0;

        if(data) {
            extra = data.extra
        }

        if(options.metaOnly == "hit") {
            value = void 0;
        } else {
            if(data) {
                value = data.data;
            }
        }

        return callback(err, value, state, extra);
    });
}
InMemoryTest.prototype.exists = function (key, options, callback) {
    var state = {locked: false, ownLock: false, stale: false, hit: false};
    var self = this;

    if(this.operationsFail) { // Allow operations to fail for testing
        var error = new Error("Cache Unavailable");
        error.cacheUnavailable = true;
        state.cacheUnavailable = true;
        return callback(error, null, state);
    }

    this._getState(key, function (err, expiryState) {
        // Figure out lock state
        if(self._locks[key]) {
            state.ownLock = (self._locks[key] === self.lockID); // Someone else got to the lock if they don't match. Contrived for testing
            state.locked = true;
        }

        if(typeof self.storage[key] !== "undefined" && !expiryState.expired) {
            state.hit = true;
            state.stale = expiryState.stale;
            exists = true;
        } else {
            state.hit = false;
            exists = true;
        }

        state.expiryTime = expiryState.expiryTime;
        state.staleTime = expiryState.staleTime;

        err = null;
        var exists = state.hit;

        return callback(err, exists, state);
    });
}

/**
 * Remove a distributed lock
 * @param key
 * @param options
 * @param callback
 * @returns {*}
 */
InMemoryTest.prototype.unlock = function (key, options, callback) {

    if(this.operationsFail) { // Allow operations to fail for testing
        var error = new Error("Cache Unavailable");
        error.cacheUnavailable = true;
        return callback(error, false);
    }

    this._locks[key] = null;
    return callback(null, true);
}

/**
 * Acquire a distributed lock
 * @param key
 * @param options
 * @param callback
 * @returns {*}
 */
InMemoryTest.prototype.lock = function (key, options, callback) {

    if(this.operationsFail) { // Allow operations to fail for testing
        var error = new Error("Cache Unavailable");
        error.cacheUnavailable = true;
        return callback(error, false);
    }

    options = options || {};
    var acquiredLock = false;
    if(!this._locks[key]) {
        this._locks[key] = options.lockID || this.lockID; // Allow a different lock ID to be passed in. Useful for testing
        acquiredLock = true;
    }
    return callback(null, acquiredLock);
}

/**
 * Store a result in the backend. Optionally unlock the distributed lock on the key.
 * @param key
 * @param value
 * @param options
 * @param callback
 * @returns {*}
 */
InMemoryTest.prototype.store = function (key, value, extra, error, cachePolicyResult, options, callback) {
    options = options || {};


    if(this.operationsFail) { // Allow operations to fail for testing
        var error = new Error("Cache Unavailable");
        error.cacheUnavailable = true;
        return callback(error, false);
    }

    this.storage[key] = {data: value, extra: extra};

    if(error) {
        this.storage[key]["error"] = error.message ? error.message : error.toString();
    }

    if(cachePolicyResult && cachePolicyResult.expiryTimeAbs) {
        var expiryTime = cachePolicyResult.expiryTimeAbs;
        var staleTime = cachePolicyResult.staleTimeAbs;

        if(!staleTime) {
            staleTime = expiryTime;
        }
        this.timings[key] = {stale: staleTime, expiry: expiryTime};
    } else {
        throw new Error("No cachePolicyResult provided");
    }

    if(options.unlock) {
        return this.unlock(key, options, callback);
    } else {
        callback(null, true);
    }
};

module.exports = InMemoryTest;