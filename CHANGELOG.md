# Changelog

## [0.0.9] - 2023-02-11

### Added

- Axioms can have universally quantified premisses now; that is, [axioms can be inference rules now](https://practal.com/press/aair/1/).

### Changed

- Syntax colour schemes for both light and dark modes are based on [*Solarized*](https://ethanschoonover.com/solarized/) now.

## [0.0.8] - 2023-02-09

This release addresses various issues about syntactic categories.

- The priority relation between syntactic categories is now always a partial order, in particular ⪪ has been removed.
- ''atomic and ''term are special syntactic categories now that can be accessed explicitly in constraints (but not in syntax specs).
- Syntactic categories can be declared as "loose", which means they are not bounded by ''atomic and ''term a-priori. For non-loose
  syntactic categories S the constraint ''term < S < ''atomic is automatically imposed.
- Abstractions now declare their own syntactic category only if they have a syntax spec that starts with an empty syntactic category specifier.
  If they define their own syntactic category S, then for an abstraction without parameters the constraint ''atomic < S is imposed,
  for abstractions with parameters the constraint ''term < S < ''atomic is added.


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