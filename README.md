# Sifaka
Sifaka is a pluggable caching library with an emphasis on protecting the backend from being overloaded. Approaches taken:
* [Cache Stampede](http://en.wikipedia.org/wiki/Cache_stampede) / [dog piling](https://www.leaseweb.com/labs/2013/03/avoiding-the-memcache-dog-pile-effect/) protection by maintaining a distributed lock between cache clients, so the work function is executed at most once at any time for a given key.
* Allowing stale data to be served for a configurable period of time. During this time, one request will be triggered to update the cache for the key.
* Configurable cache policies, allowing stale and expiry times to be calculated based upon the duration of the operation (e.g. if an operation takes 30s to complete, you may wish to recalculate it less frequently than an operation that takes 30ms to complete).

## Backends
There are currently two backends available - an in-memory cache for testing purposes, and a Redis backend.
You will need the `redis` module installed to use the redis backend.

## Cache Policies
There are currently two cache policies available:
* Static - you can pass values in seconds for expiryTime and staleTime in the options, and these fixed values will be used for all keys.
* Duration - you can set minimum and maximum values for staleTime and expiryTime and values will be chosen based on the duration of the work function.

## Methods

#### `sifaka.get(key,workFunction,[options], callback)`
Try to retrieve an item from the cache. If it is not there, either wait for another cache client to do the work (if it is already underway) or do the work locally. The value will then be returned via callback.


## Testing

* mocha tests can be run using `npm test` `mocha` or `make test`!
* there is a loadtest harness in /loadtest. Run `node index.js --handler [handler]` in one console, then hit localhost on port 8002 (e.g. with the node package loadtest: `node loadtest.js -n 5000 -c 20 http://127.0.0.1:8002 --rps 50`). There are some example results with various handlers: no caching (work function gets called for every request), using the node-cache module - which will hit the work with a stampede, and two sifaka handlers.

## Sifaka?

Why not. Also, [they're awesome](https://en.wikipedia.org/wiki/Verreaux%27s_sifaka). 

