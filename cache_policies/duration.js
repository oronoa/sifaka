"use strict";

/**
 * Duration Based Cache Policy - the values used for each particular workload are calculated based on the time taken to
 * complete the workload and user-provided bounds.
 * @param options - Object containing:
 * staleFactor: multiples of the duration that we should aim to set the stale time at.
 * minStaleTime: minimum time in seconds between refreshes.
 * maxStaleTime: maximum time in seconds between refreshes.

 * maxExpiryTime: maximum time in seconds until the item should be removed from the cache backend.
 * expiryFactor: Multiple of the duration before expiry happens. Should be >= staleFactor +1
 * @constructor
 */
function DurationCachePolicy(options) {
    this.options = options || {};
    
    // Set this to true to disable returning stale data. May be useful if you need to have a series of related requests return the same data
    // e.g. to avoid first request (stale), [does work], second request (stale), [work returns], third request (fresh), fourth (fresh)
    // This will mean that the first and second requests get held until the work returns, but this might be desirable.
    this.noStale = this.options.noStale || false;

    this.maxStaleTime = this.options.maxStaleTime; // The absolute longest between refreshing data
    this.minStaleTime = this.options.minStaleTime || 0; // The absolute shortest time between refreshes
    this.staleFactor = this.options.staleFactor; // Ideally wait this many multiples of the duration between refreshes

    this.expiryFactor = this.options.expiryFactor; // Ideally, wait this many multiples of duration before expiring
    this.maxExpiryTime = this.options.maxExpiryTime || 86400; // Absolute max time an item will sit in the cache (unrefreshed before it is removed)
    this.minExpiryTime = this.options.minExpiryTime || 0; // Absolute minimum amount of time in seconds the item will remain in the cache

    if(!this.noStale) {
        if(this.expiryFactor < 2) {
            throw new Error("You must set the expiry factor higher than the stale factor +1");
        }
    
        if(!this.staleFactor) {
            throw new Error("You must provide an options.staleFactor value.");
        }
    
        if(this.staleTime > this.expiryTime) {
            throw new Error("The staleTime should be <= the expiryTime");
        }
    }
}

DurationCachePolicy.prototype.calculate = function (key, durationMS, data, extra, state, callback) {
    var durationSeconds = durationMS / 1000;

    var minStaleTime = this.minStaleTime || 0;
    var minExpiryTime = this.minExpiryTime;
    var staleFactor = this.staleFactor;
    var maxStaleTime = this.maxStaleTime || 0;
    var expiryFactor = this.expiryFactor;
    var maxExpiryTime = this.maxExpiryTime;
    var noStale = this.noStale;

    var stale, expiry;

    // When overriding, you may wish to alter some of the above factors and min/maximums based on the values of data and extra

    stale = durationSeconds * staleFactor || 0; // Baseline

    if(stale < minStaleTime) {
        stale = minStaleTime;
    }
    if(stale > maxStaleTime) {
        stale = maxStaleTime;
    }

    // Wait the maximum of the minExpiry time, the stale time + a fixed multiple of the duration, or the duration x the expiry factor
    expiry = Math.max(minExpiryTime, stale + (5 * durationSeconds), durationSeconds * expiryFactor);
    if(expiry > maxExpiryTime) {
        expiry = maxExpiryTime;
    }

    var now = new Date() * 1;
    var expiryAbs = now + (expiry * 1000);
    var staleAbs = now + (stale * 1000);
    
    if(noStale){
        staleAbs = 0
    }
    return callback(null, {expiryTimeAbs: expiryAbs, staleTimeAbs: staleAbs});
};

module.exports = DurationCachePolicy;


