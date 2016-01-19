"use strict";

/**
 * Static Cache Policy - the values are set in the constructor, and are not recalculated for each request
 * @param options - Object containing:
 * expiryTime: time in seconds until the item should be removed from the cache backend.
 * staleTime - time in seconds after which a recalculation of the underlying work function will be triggered to refresh the data
 * @constructor
 */
function StaticCachePolicy(options) {
    this.options = options || {};
    this.expiryTime = this.options.expiryTime || 5400;
    this.staleTime = this.options.staleTime || 3600;

    if(this.staleTime > this.expiryTime){
        throw new Error("The staleTime should be <= the expiryTime");
    }
}

StaticCachePolicy.prototype.calculate = function (key, duration, data, callback) {
    return callback(null, {expiryTime: this.expiryTime, staleTime: this.staleTime});
}

module.exports = StaticCachePolicy;


