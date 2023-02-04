# Changelog

## [0.0.7] - 2023-02-04

### Added

- Newly declared names are underlined.
- Added examples of .practal files.

## [0.0.6] - 2023-02-03

### Changed

- Hyphens in identifiers can be left out independently of each other.
- Special treatment of syntactic categories belonging to value abstractions.
- Disallow empty syntax specifications.

## [0.0.5] - 2023-02-02

### Added

- Parsed terms are constructed as UITerms and validated.
- Free and bound variables are properly recognized now, and visually distinguished.
- Definitions are checked.

## [0.0.4] - 2023-02-01

### Changed

- Improved syntax error reporting.

### Fixed

- Bug leading to NaNs in span offsets.

## [0.0.3] - 2023-01-31

### Added

- CHANGELOG.md

### Changed

- Abstraction names can now be used without a leading backslash.

### Fixed

- Operation parameters and operator parameters are now parsed in the same way.