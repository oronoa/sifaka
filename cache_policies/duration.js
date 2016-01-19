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
function StaticCachePolicy(options) {
    this.options = options || {};

    this.maxStaleTime = this.options.maxStaleTime; // The absolute longest between refreshing data
    this.minStaleTime = this.options.minStaleTime || 0; // The absolute shortest time between refreshes
    this.staleFactor = this.options.staleFactor; // Ideally wait this many multiples of the duration between refreshes

    this.expiryFactor = this.options.expiryFactor; // Ideally, wait this many multiples of duration before expiring
    this.maxExpiryTime = this.options.maxExpiryTime || 86400 ; // Absolute max time an item will sit in the cache (unrefreshed before it is removed)
    this.minExpiryTime = this.options.minExpiryTime || 0; // Absolute minimum amount of time in seconds the item will remain in the cache


    if(this.expiryFactor < 2){
        throw new Error("You must set the expiry factor higher than the stale factor +1");
    }

    if(!this.staleFactor) {
        throw new Error("You must provide an options.staleFactor value.");
    }

    if(this.staleTime > this.expiryTime) {
        throw new Error("The staleTime should be <= the expiryTime");
    }
}

StaticCachePolicy.prototype.calculate = function (key, durationMS, data, callback) {

    var durationSeconds = durationMS / 1000;
    var staleTime, expiryTime;

    staleTime = durationSeconds * this.staleFactor; // Baseline
    if(staleTime < this.minStaleTime){
        staleTime = this.minStaleTime;
    }

    if(staleTime > this.maxStaleTime) {
        staleTime = this.maxStaleTime;
    }

    // Wait the maximum of the minExpiry time, the stale time + a fixed multiple of the duration, or the duration x the expiry factor
    expiryTime = Math.max(this.minExpiryTime, staleTime + (5 * durationSeconds), durationSeconds * this.expiryFactor);

    if(expiryTime > this.maxExpiryTime){
        expiryTime = this.maxExpiryTime;
    }

    return callback(null, {expiryTime: expiryTime, staleTime: staleTime});
};

module.exports = StaticCachePolicy;


