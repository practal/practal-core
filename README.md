# Practal for VSCode

Practal has its first monthly sponsor, many thanks to [purebounce](https://github.com/purebounce)! 🎉

## Installation

Practal is available as a [Visual Studio Code extension](https://marketplace.visualstudio.com/items?itemName=Practal.practal).
Make sure you also have the [STIX fonts](https://www.stixfonts.org) installed on your system.

## Features

You can describe an Abstraction Logic theory in a `.practal` file by:

* Declaring abstractions, and optionally defining them.
* Introducing axioms.
* Providing custom syntax for your abstractions. Practal contains under the hood a full engine for deterministic LR parsing. It is actually quite a lot of fun to play around with your own syntax!

See [Practal.com](https://practal.com) and in particular [A First Look at Practal](https://practal.com/press/aflap.1) for more information!

<img src="Foundation.gif" alt="Foundation.practal" width="403" style="border-radius:20px"/>

## Known Issues

This is a pre-α release. 

* No proofs, or really any other features except the ones stated above.
* Works only on a single file, there is no possibility to import or include other theories. 