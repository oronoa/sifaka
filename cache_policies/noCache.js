"use strict";
/**
 * NoCache Policy - can be passed to a get request when you do not want the result to be cached
 * @param options - Object containing:
 * @constructor
 */
function NoCacheCachePolicy(options) {
    this.options = options || {};
}

NoCacheCachePolicy.prototype.calculate = function (key, durationMS, data, extra, state, callback) {
    return callback(null, {expiryTime: 0, staleTime: 0, noCache: true});
};

module.exports = NoCacheCachePolicy;


