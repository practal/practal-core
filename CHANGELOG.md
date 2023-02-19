# Changelog

## [0.0.12] - 2023-02-19

Point out to users in README that syntax has changed.

## [0.0.11] - 2023-02-15

Added surface syntax for proofs and theorem expressions. These are not checked in any way yet.

### Proof
A proof consists of a list of proof steps, where a proof step is either

* "`sorry`" : This says that the proof attempt is cancelled at this point for the time being.
* "`qed`" : This says that the proof is concluded now, and that the proven theorem can be deduced automatically from what came before.
* "`qed` *theorem-expression*" : This says that the proof is concluded now, and the given theorem expression proves the theorem. 
* "`note` *label* `:` *theorem-expression*" : This saves the theorem denoted by the theorem expression under the given label for later use in the proof.
* "`lemma` ..." : A lemma, which can be used later in the proof.

### Theorem Expression
A theorem expression is either

* "*theorem-reference*" : A reference to an existing theorem.
* "*theorem-expression*[..., P := x. x = t, ...]" : A substitution of free variables in the theorem denoted by *theorem-expression*.
* "*theorem-expression*[..., 0 : *th-expr-0*, ..., *label* : x y. *th-expr-1* , ...]" : Instantiating the premisses  of a theorem denoted by *theorem-expression*.
* "*theorem-expression*`.`*label*" or "*theorem-expression*`.`0": This throws away all conclusions of a theorem except the one selected via the given label or index. 



## [0.0.10] - 2023-02-12

### Added
- Long form syntax specs. These are started by two back ticks instead of a single one, and mark a syntax spec as long form. 
  In later versions, tools like the pretty printer may choose automatically between long form and short form syntax based on the context.

### Changed

- Renamed predefined syntactic categories ''atomic and ''term to Atomic and Term, respectively.
- Syntactic categories are prefixed with a back tick instead of an apostrophe.


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