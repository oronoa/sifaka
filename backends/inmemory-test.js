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
    this.locks = {};
    this.lockID = (Math.random() * 1E12).toString(36);
    this.timings = {};
}
InMemoryTest.prototype.clear = function (callback) {
    this.locks = {};
    this.timings = {};
    this.storage = {};

}
InMemoryTest.prototype._getState = function (key, callback) {
    var expiryState = {expired: false, stale: false};
    var timings = this.timings[key] || {};
    var now = new Date();

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
    this._getState(key, function (err, expiryState) {

        // Figure out lock state
        if(self.locks[key]) {
            state.ownLock = (self.locks[key] === self.lockID); // Someone else got to the lock if they don't match. Contrived for testing
            state.locked = true;
        }

        if(typeof self.storage[key] !== "undefined" && !expiryState.expired) {
            state.hit = true;
            state.stale = expiryState.stale;
        } else {
            state.hit = false;

        }

        var data = self.storage[key];
        var err = null;
        if(data) {
            err = data.error || null;
        }

        var value = null;
        if(data){
            value = data.data;
        }

        return callback(err, value, state);
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
    this.locks[key] = null;
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
    options = options || {};
    var acquiredLock = false;
    if(!this.locks[key]) {
        this.locks[key] = options.lockID || this.lockID; // Allow a different lock ID to be passed in. Useful for testing
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
InMemoryTest.prototype.store = function (key, value, error, options, callback) {
    options = options || {};

    options.cachePolicy = options.cachePolicy || {};

    this.storage[key] = {data: value};

    if(error) {
        this.storage[key]["error"] = error.message ? error.message : error.toString();
    }

    if(options.cachePolicy) {
        var expiryTime = options.cachePolicy.expiryTime;
        var staleTime = options.cachePolicy.staleTime;

        if(!staleTime) {
            staleTime = expiryTime;
        }
        var now = new Date() * 1;
        this.timings[key] = {stale: now + (staleTime * 1000), expiry: now + (expiryTime * 1000)};
    }

    if(options.unlock) {
        return this.unlock(key, options, callback);
    } else {
        callback(null, true);
    }
};

module.exports = InMemoryTest;