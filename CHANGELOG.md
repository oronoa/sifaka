# Change Log
All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]

### Added

### Changed

## [0.7.1] - 2016-01-01

### Changed
- Prefer using pexpireat to avoid unnecessary calculations. Use toFixed() to avoid casting inaccuracies.

## [0.7.0] - 2016-01-29

### Changed
- Redis expire times need to be integers

## [0.6.0] - 2016-01-28

### Changed
- Continue to function in a degraded state if the cache backend becomes unavailable (e.g. redis disconnects)

## [0.5.0] - 2016-01-28

### Changed
- Save and propagate the "extra" data returned from the workFunction. Changed signatures on: workFunctions, serializers, .get callback, backends

## [0.4.0] - 2016-01-27

### Added
- Added extra parameter to the work function callback, so you can pass back extra information. This is then passed to the policy calculation, so for example, you can alter the cache time, or not cache.

### Changed
- Allow name to be passed in to constructor - will add it to debug messages.
- Expose staleTime and expiryTime in the state parameter if available
- Removed responsiblity for calculating expirytimes from the backends. Altered signature.
- Pass the cache state to the cache calculations, so a decision can be adjusted based on the current state of the cache. Signature change to calculate().

## [0.3.0] - 2016-01-25
### Added
- Added meta to result callback
- Added ability to request meta only in the response. Behaviour:

| options.metaOnly value | cache (hit\|miss) | data returned | work function called |
|:---:|:---:|:---:|:---:|
| not set / null | hit | y | n |
| not set / null | miss | y | if required |
| "hit" | hit | n | n |
| "hit" | miss | y | if required |
| "miss" | hit | y | n |
| "miss" | miss | n | n |

This means you can short circuit the work function on a miss and fetching data from the backend on a hit. This may be useful to:

Return data on a hit, but not recalculate the data on a miss
Recalculate on a miss, but only report the existence on a hit.

If you wish to combine both, the exists method should fit the bill (below)

- Added exists method to check whether an item is currently cached, and provide meta on expiry, stale etc

### Changed


## [0.2.0] - 2016-01-20
### Added
- Travis CI
- Added a NoCache policy so to allow individual requests to not be stored. Any policy can implement this by setting noCache to true.
- Added optional serializers and deserializers. JSON implementation included as an example.

### Changed
- Reorganised root structure so it is easier to require() policies etc

## [0.1.0] - 2016-01-19
### Added
- Initial Release
