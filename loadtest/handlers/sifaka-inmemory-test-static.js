var Sifaka = require("../../index");

var Backend = require("../../backends/inmemory-test");
var CachePolicy = require("../../cache_policies/static");
var policy = new CachePolicy({expiryTime: 60, staleTime: 10}); // remove items after 60s, but recalculate every 10s
var options = {debug: false, cachePolicy: policy};
var backend = new Backend();
var cache = new Sifaka(backend, options)

module.exports = function (workFunction, callback) {

    cache.get("abc", workFunction, {}, function (err, value) {
        if(value) {
            return callback(null, value);
        }
    });
};
