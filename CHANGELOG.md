# Change Log
All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]
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
