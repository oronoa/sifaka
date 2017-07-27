/*global suite, test, suiteSetup, suiteTeardown, setup, Object, Array */

var should = require('should');
var StaticCachePolicy = require("../cache_policies/static");
var DurationPolicy = require("../cache_policies/duration");
var DEBUG = false; // Set to true to dump out CSV of values to view in a spreadsheet
//var noop = function () {
//};

suite('Policies ', function () {
    suiteSetup(function (done) {
        done();
    });
    
    suiteTeardown(function (done) {
        done();
    });
    
    setup(function (done) {
        done();
    });
    
    var runTest = function (name, Policy, options) {
        var policy = new Policy(options);
        
        test(name, function (done) {
            "use strict";
            var i = 0;
            var step = 300;
            var max = 500 * 1000;
            
            var durations = [];
            var stale = [];
            var expiry = [];
            var runIteration = function (callback) {
                "use strict";
                if(i > max) {
                    return callback();
                }
                
                policy.calculate("none", i, "data", {}, {}, function (err, data) {
                    should.not.exist(err);
                    should.exist(data);
                    data.should.have.property("staleTimeAbs");
                    data.should.have.property("expiryTimeAbs");
                    
                    durations.push(i / 1000);
                    var staleTime = data.staleTimeAbs;
                    var expiryTime = data.expiryTimeAbs;
                    
                    if(options.noStale){
                        staleTime.should.equal(0); // If stale is turned off, should return 0 - we will always be controlled by the expiry time only
                    }
                    expiryTime.should.be.greaterThan(staleTime);
                    expiryTime.should.be.greaterThan(staleTime + (i / 1000));

                    stale.push(staleTime);
                    expiry.push(expiryTime);
                    i += step;
                    runIteration(callback);
                });
                
            }
            
            runIteration(function () {
                if(DEBUG) {
                    console.log(durations.join(","));
                    console.log(stale.join(","));
                    console.log(expiry.join(","));
                }
                done();
            })
            
        })
    }
    
     var tests = [
    {name: "static", policy: StaticCachePolicy, options: {}},
    {
        name: "duration based policy - refresh between once every 60s and 10 min", policy: DurationPolicy, options: {
            staleFactor: 10,
            expiryFactor: 2,
            minStaleTime: 60,
            maxStaleTime: 600,
            minExpiryTime: 600,
            maxExpiryTime: 3600
        }
    }, {
        name: "shorter duration - between 1 min and 5 min", policy: DurationPolicy, options: {
            staleFactor: 5,
            expiryFactor: 2,
            minStaleTime: 60,
            maxStaleTime: 300,
            minExpiryTime: 240,
            maxExpiryTime: 1200
        }
    },
         {
        name: "shorter duration - between 1 min and 5 min with stale turned off", policy: DurationPolicy, options: {
            expiryFactor: 2,
            minExpiryTime: 240,
            maxExpiryTime: 1200,
            noStale: true
        }
    }
    
    ]
    
    for(var i = 0; i < tests.length; i++) {
        var testdata = tests[i];
        runTest(testdata.name, testdata.policy, testdata.options);
    }
    
});







