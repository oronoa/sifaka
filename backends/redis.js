"use strict";

var LOCK_EXPIRY_TIME = 120; // 2 mins

var unlock_script = 'if redis.call("get",KEYS[1]) == ARGV[1] then\n' + //'redis.call("ECHO", "DELETING " .. KEYS[1] .. " value: " .. ARGV[1] )\n' +
    'local result = redis.call("del",KEYS[1])\n' + //'redis.call("ECHO", "DELETED " .. KEYS[1] .. " value: " .. ARGV[1] .. " Result: " .. result )\n' +
    'return result\n' + 'end\n' + //'redis.call("ECHO", "COULD NOT UNLOCK - did not match" .. KEYS[1] .. " value: " .. ARGV[1] )\n' +
    'return 0';

/**
 * Redis Storage. Uses a single-host lock - which may or may not be suitable for your requirements.
 * If better degrees of safety are required, consider using a Redlock. See http://redis.io/topics/distlock
 * @param options
 * @constructor
 */
function Redis(options) {
    this.options = options || {};
    this.lockExpiryTime = options.lockExpiryTime || LOCK_EXPIRY_TIME;
    this.client = options.client;
    this.namespace = (options.namespace ? options.namespace + ':' : '');
    this.lockID = Math.floor((Math.random() * 1E12)).toString(36);
    this.binary = options.binary || null;
    this.name = "redis";
}

Redis.prototype._decodeData = function (binary, data, options) {
    var result = {};

    result.lock = data[0] ? data[0].toString() : null; // Buffer to String

    switch(data.length) {
        case 5:
            result.expiry = data[1] ? data[1].toString() : null; // Buffer to String
            result.stale = data[2] ? data[2].toString() : null; // Buffer to String
            result.error = data[3] ? new Error(data[3].toString()) : void(0); // String or undefined
            result.extra = data[4] ? data[4].toString() : void(0);
            result.data = void 0;

            if(result.extra && result.extra[0] === "{") {
                try {
                    result.extra = JSON.parse(result.extra);
                } catch(e) {
                }
            }

            break;
        case 2:
            var hash = data[1] || {};
            result.expiry = hash.expiry ? hash.expiry.toString() : null; // Buffer to String
            result.stale = hash.stale ? hash.stale.toString() : null; // Buffer to String
            if(binary) {
                result.data = hash.data; // Buffer
            } else {
                result.data = hash.data ? hash.data.toString() : void(0); // String or undefined
            }

            result.extra = hash.extra ? hash.extra.toString() : void(0);

            if(result.extra && result.extra[0] === "{") {
                try {
                    result.extra = JSON.parse(result.extra);
                } catch(e) {
                }
            }

            if(hash.error) {
                result.error = hash.error ? new Error(hash.error.toString()) : void(0); // String or undefined
            }
            break;
        default:
            throw new Error("Unexpected data length received");
    }

    result.hit = result.stale && result.expiry;

    // Cast back to int
    if(result.stale) {
        result.stale = result.stale * 1;
    }

    if(result.expiry) {
        result.expiry = result.expiry * 1;
    }

    return result;
};

Redis.prototype._getState = function (data, options, callback) {

    var state = {ownLock: false, locked: false, stale: false, expired: false, hit: false};
    var now = new Date() * 1;

    if(data.expiry && data.expiry < now) {
        state.expired = true;
    }else if(data.stale && data.stale < now) {
        state.stale = true;
    }
        
    state.expiryTime = data.expiry;
    state.staleTime = data.stale;

    if(data.lock) {
        state.locked = true;
    }

    if(state.locked && data.lock === this.lockID) {
        state.ownLock = true;
    }

    if(data.hit || (data.stale && !state.expired)) {
        state.hit = true;
    }

    return state;
};

Redis.prototype._getPipeline = function (key, metaOnly) {
    var self = this;

    var multi = self.client.multi();

    // Lock first
    multi.get(self.namespace + "lock:" + key);

    // If we want the data back, we can do a hgetall
    if(!metaOnly || metaOnly == "miss") {
        multi.hgetall(self.namespace + "data:" + key);
    } else {
        // Otherwise load the other fields individually
        multi.hget(self.namespace + "data:" + key, "expiry");
        multi.hget(self.namespace + "data:" + key, "stale");
        multi.hget(self.namespace + "data:" + key, "error");
        multi.hget(self.namespace + "data:" + key, "extra");
    }

    return multi;
};

Redis.prototype.get = function (key, options, callback) {
    var self = this;
    var state;
    var binary = self.binary;
    if(typeof options.binary !== 'undefined') {
        binary = options.binary;
    }
    var metaOnly = options.metaOnly || null;

    if(self.client_available()) {

        var multi = self._getPipeline(key, metaOnly)

        multi.exec(function (err, data) {
            if(err) {
                err.cached = false;
                err.cacheUnavailable = true;
                state = {ownLock: false, locked: false, stale: false, expired: false, hit: false};
                return callback(err, null, state);
            }
            data = self._decodeData(binary, data, options);
            state = self._getState(data, options);

            return callback(data.error, data.data, state, data.extra);
        });
    } else {
        var err = new Error("Redis unavailable")
        err.cached = false;
        err.cacheUnavailable = true;
        state = {ownLock: false, locked: false, stale: false, expired: false, hit: false};
        return callback(err, null, state);
    }
};

Redis.prototype.exists = function (key, options, callback) {
    var self = this;
    var binary = options.binary || false;

    if(self.client_available()) {
        var multi = self._getPipeline(key, "hit");

        multi.exec(function (err, data) {
            if(err) {
                err.cached = false;
                err.cacheUnavailable = true;
                state = {ownLock: false, locked: false, stale: false, expired: false, hit: false};
                return callback(err, false);
            }

            data = self._decodeData(binary, data, options);
            var state = self._getState(data, options);

            return callback(data.error, state.hit, state);
        });
    } else {
        var err = new Error("Redis unavailable")
        err.cached = false;
        err.cacheUnavailable = true;
        return callback(err, false);

    }
};

/**
 * Acquire a distributed lock
 * @param key
 * @param options
 * @param callback
 * @returns {*}
 */
Redis.prototype.lock = function (key, options, callback) {
    // Simple lock from http://redis.io/topics/distlock
    var self = this;
    options = options || {};
    if(self.client_available()) {

        var lockID = options.lockID || self.lockID;

        this.client.set(this.namespace + "lock:" + key, lockID, "NX", "EX", (this.lockExpiryTime || 60), function (err, data) {

            if(err) {
                err.cached = false;
                err.cacheUnavailable = true;
                return callback(err, false);
            }

            var acquired = (data && data.toString() == "OK") || false;
            return callback(null, acquired);
        });
    } else {
        var err = new Error("Redis unavailable")
        err.cached = false;
        err.cacheUnavailable = true;
        return callback(err, false);
    }
}

/**
 * Acquire a distributed lock
 * @param key
 * @param options
 * @param callback
 * @returns {*}
 */
Redis.prototype.unlock = function (key, options, callback) {
    var self = this;
    if(self.client_available()) {
        this.client.eval(unlock_script, 1, this.namespace + "lock:" + key, self.lockID, function (err, data) {
            if(err) {
                err.cached = false;
                err.cacheUnavailable = true;
                return callback(err, false);
            }

            callback(err, data === 1);
        })
    } else {
        var err = new Error("Redis unavailable")
        err.cached = false;
        err.cacheUnavailable = true;
        return callback(err, false);
    }
}

Redis.prototype.client_available = function () {
    if(this.client && this.client.connected !== false && this.client.ready !== false) {
        return true;
    }
    return false;
}

/**
 * Store a result in the backend. Optionally unlock the distributed lock on the key.
 * @param key
 * @param value
 * @param options
 * @param callback
 * @returns {*}
 */
Redis.prototype.store = function (key, value, extra, error, cachePolicyResult, options, callback) {
    var self = this;
    options = options || {};

    if(!cachePolicyResult && !cachePolicyResult.expiryTimeAbs) {
        throw new Error("No cachePolicyResult provided");
    }

    var expiryAbs = cachePolicyResult.expiryTimeAbs;
    var staleAbs = cachePolicyResult.staleTimeAbs;

    if(!staleAbs) {
        staleAbs = expiryAbs
    }

    if(self.client_available()) {
        var multi = self.client.multi();
        if(value !== null && typeof value !== "undefined") {
            multi.hset(self.namespace + "data:" + key, "data", value);
        }

        if(extra !== null && typeof extra !== "undefined") {

            if(typeof extra == "object") {
                extra = JSON.stringify(extra);
            }

            multi.hset(self.namespace + "data:" + key, "extra", extra);
        } else {
            multi.hset(self.namespace + "data:" + key, "extra", "{}");
        }
        if(error) {
            error = error.message ? error.message : error.toString();
            multi.hset(self.namespace + "data:" + key, "error", error);
        }
        multi.hset(self.namespace + "data:" + key, "stale", staleAbs);
        multi.hset(self.namespace + "data:" + key, "expiry", expiryAbs);
        multi.pexpireat(self.namespace + "data:" + key, expiryAbs.toFixed());

        multi.exec(function (err, replies) {
            if(err) {
                err.cached = false;
                err.cacheUnavailable = true;
                return callback(err, false);
            }
            var succeeded = replies[replies.length - 1] == 1; // Only the result of the pexpireat is significant

            if(options.unlock) {
                self.unlock(key, options, function (unlockErr, unlocked) {
                    callback(err || unlockErr, succeeded && unlocked);
                });
            } else {
                callback(null, succeeded);
            }
        });
    } else {
        var err = new Error("Redis unavailable")
        err.cached = false;
        err.cacheUnavailable = true;
        return callback(err, false);
    }
};

module.exports = Redis;