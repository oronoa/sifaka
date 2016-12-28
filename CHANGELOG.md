# Change Log
All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]

### Added

### Changed


## [0.8.10] - 2016-12-28

### Changed
- Don't throw when a remote lock has been removed.

## [0.8.9] - 2016-11-25

### Changed
- Ensure we don't have a local lock before setting checks on a remote lock.

## [0.8.5] - 2016-11-24

### Changed
- Fix flow control when a remote lock has expired.


## [0.8.4] - 2016-11-21

### Added
- Added the ability to supply a backoff power to allow non-linear polling of remote locks


## [0.8.3] - 2016-11-21

### Added
- Added test for remote lock timeouts

### Changed
- Handle errors in the serializers 

## [0.8.2] - 2016-11-16

### Changed
 - Fix to clear the pending timeout when a list of pending callbacks is resolved

## [0.8.1] - 2016-07-25

### Changed
- Fix to ensure local locks are cleared when a cache lookup returns an error.

## [0.8.0] - 2016-04-11

### Changed
- Redis stability improvements (check driver is ready before committing to use it)
- Improved the workflow for checking backend-held locks and local locks. Added timeouts to local locks.
- Refactored, minor renames on options.

## [0.7.2] - 2016-02-01

### Changed
- Removed debug code

## [0.7.1] - 2016-02-01

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
