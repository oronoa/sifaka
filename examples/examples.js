var Sifaka = require("../index");

// Import a backend
var Backend = require("../backends/inmemory-test"); // For demo purposes
var backend = new Backend(); // No options


// Tell the cache how we want to deal with expiry, and the serving of stale data
var Policy = require("../cache_policies/static");
var policy = new Policy({expiryTime: 60, staleTime: 30}); // Do work every 30s, keep data in cache for 60s

var cache = new Sifaka(backend, {policy: policy});

// Now define a costly function, which takes a callback(err,data).
var workFunction = function(callback){
    // Do some Stuff
    setTimeout(function(){
        // Some time later, call the callback, with any errors and result data
        callback(null, {name: "bob", value: 12345});
    }, 10000);
};


cache.get("myCacheKey", workFunction, {}, function(err, data){
    // The first response will take ~ 10s
    cache.get("myCacheKey", workFunction, {}, function(err, data){
        // This response should be instantaneous
    });
});






