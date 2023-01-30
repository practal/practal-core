# Practal Core

## Installation

Practal Core is available as a [Visual Studio Code extension](https://marketplace.visualstudio.com/items?itemName=Practal.practal).
Make sure you also have the [STIX fonts](https://www.stixfonts.org) installed on your system.

## Features

Provides syntax highlighting for `.practal` files. Soon, you will actually be able to *do* something with your `.practal` files, but for now, that's it. For more information on *Practal*, please check 
https://practal.com.

Note that the syntax of Practal's terms is user-defined, so you can play around and define your own syntax within your `.practal` file. To make that possible, Practal Core contains under the hood a full parser generator 
for a deterministic LR variant of [*Local Lexing*](https://obua.com/publications/local-lexing/1/).

<img src="Foundation.gif" alt="Foundation.practal" width="488"/>

## Known Issues

This is a very early version, not even alpha. 

* Syntax highlighting of terms cannot yet distinguish between free and bound variables.
* Definitions are not checked.
* No proofs, or really any other functionality.
* Works only on a single file, there is no possibility to import other theories, etc. 