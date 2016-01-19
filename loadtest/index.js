var http = require("http");

var fs = require("fs");

var handlerNames = fs.readdirSync("./handlers");

handlerNames = handlerNames.map(function(file){return file.replace(".js", "")});




var argv = require('yargs')
    .usage('Usage: $0 <command> [options]')
    .demand('handler')
    .describe('handler', 'Choose a handler to run tests against. Available handlers:' + handlerNames.join(", "))
    .argv;


var baseTime = 5000; // ms
var additionalTimePerQuery = 200; // ms


var pendingQueries = 0;



var timestamp = function(){
    return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

var workFunction = function(callback){

    var delay = baseTime + (additionalTimePerQuery * pendingQueries);

    pendingQueries += 1;
    console.log(timestamp()  + "\tWork Starting. Pending:\t" + pendingQueries + " Delay: " + delay);
    setTimeout(function(){
        callback(null, "Hello World");
        pendingQueries -= 1;
        console.log(timestamp()  + "\tWork Finished. Pending:\t", pendingQueries);
    }, delay)
}

var handler;
if(handlerNames.indexOf(argv.handler) !== -1){
    handler = require("./handlers/" + argv.handler);
}else{
    throw new Error("Unknown handler '"+argv.handler+"'. Available Handlers: " + handlerNames.join(", "))
}

var logMemory = function(){
    console.log(timestamp() + "\t" + (process.memoryUsage().rss/(1024*1024)).toFixed(2) + " MB");
}

setInterval(logMemory, 5000);


if(typeof handler === "undefined"){
    throw new Error("Unknown handler chosen");
}

function handleRequest(request, response) {
    handler(workFunction, function(err, data){
        response.end(data);
    });
}

var port = 8002;
var server = http.createServer(handleRequest);
server.listen(port, function () {
    console.log("Listening on: http://127.0.01:%s", port);
});