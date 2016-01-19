module.exports = function(workFunction, callback){
    // Call the payload every time
    workFunction(function(err, data){
        callback(err, data);
    });
};