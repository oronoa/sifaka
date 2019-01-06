var redis = require('redis')
var util = require('util')
var json_ser = require('../serializers/json')

var client = redis.createClient('redis://:skypath@redis-10818.c9.us-east-1-2.ec2.cloud.redislabs.com:10818')

var Sifaka = require("../index").Sifaka;

// Import a backend
var Backend = require("../backends/redis"); // For demo purposes
var backend = new Backend({ client : client }); // No options


// Tell the cache how we want to deal with expiry, and the serving of stale data
var Policy = require("../cache_policies/static");
var policy = new Policy({expiryTime: 60, staleTime: 30}); // Do work every 30s, keep data in cache for 60s

var cache = new Sifaka(backend, {policy: policy});

// Now define a costly function, which takes a callback(err,data).
var workFunction = function(params, callback){
    // Do some Stuff
    setTimeout(function(){
        // Some time later, call the callback, with any errors and result data
        // An object of extra data can be stored alongside the main payload. Useful if e.g. the main payload needs serializing in a particular way (or is binary)
        callback(null, JSON.stringify({name: 'bob', value: 12345}), {myExtraData: 42});
    }, 2000);
};


cache.get("myCacheKey", workFunction, { params : { sample : "test"}}, function(err, data, meta, extra){
    // The first response will take ~ 10s
    console.log('data 1 : ', data, 'extra  1: ', extra)
    cache.get("myCacheKey", workFunction, {params : { sample : "test"}}, function(err, data, meta, extra){
        // This response should be instantaneous
        console.log('data 2 : ', data, 'extra 2: ', extra)
    });
});






