var NC = require("node-cache");

var cache = new NC({stdTTL: 10, checkPeriod: 2});
var hits = 0;
var misses = 0;
var pending = 0;

module.exports = function (workFunction, callback) {

    cache.get("abc", function (err, value) {

        if(value) {
            console.log("H\tHits:\t" +hits+ "\tMisses:\t" + misses)
            hits += 1;
            return callback(null, value);
        }
        // Call the payload every time
        misses += 1;
        console.log("M\tHits:\t" +hits+ "\tMisses:\t" + misses )
        workFunction(function (err, data) {


            cache.set("abc", data);
            callback(err, data);
        });
    });
};
