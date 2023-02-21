/*import { iterateTokensDeep, printResult, Result, ResultKind } from "./pyramids/deterministic_parser";
import { practaliumDP, TokenType, SectionName, ParseState, SectionData, nameOfTokenType } from "./practalium_parser";
import { createTextLines, printTextLines, TextLines } from "./pyramids/textlines";
import { UITheory } from "./uitheory";
import { configureDebugging } from "./things/debug";
import { readFileSync } from "fs";
import { generateCustomGrammar } from "./term_parser";
import { runTests } from "./things/test";

function printResultOfParsing(lines : TextLines, result : Result<SectionData, TokenType>) {
    function log(s : string) { console.log(s); }
    function nameOfS(type : SectionData) : string { return SectionName[type.type]; }
    printResult(console.log, nameOfS, nameOfTokenType, lines, result);
}

function loadExample(name : string) : TextLines {
    const filename = process.env.PWD + "/src/examples/" + name;
    const source = readFileSync(filename, 'utf8');
    return createTextLines(source.split("\n"));    
}

console.log("Testing Practalium tokenizer ...");
configureDebugging(console.log);
const example = loadExample("Foundation0.practal"); //createTextLines(source.split("\n"));
console.log("-------------");
printTextLines(example);
console.log("-------------");
console.log("Tokenizing ...");
const state1 : ParseState = { theory : UITheory.mk(example), varParser : undefined, maximum_valid : undefined, maximum_invalid : undefined };
const parsed1 = practaliumDP(state1, example, 0, 0);
if (parsed1 === undefined) {
    console.log("Parsing failed.");
    process.exit(1);
} 
const theory = UITheory.mk(example);
const lr = generateCustomGrammar(state1.theory);
const state : ParseState = { theory : theory, varParser : undefined, maximum_valid : lr.maximum_valid, maximum_invalid : lr.maximum_invalid };
const parsed = practaliumDP(state, example, 0, 0);
if (parsed === undefined) {
    console.log("Parsing failed.");
} else {
    const tokens = [...iterateTokensDeep(parsed.result)];
    console.log("Found " + tokens.length + " tokens.");
    for (const token of tokens) {
        console.log(`${token.line} (${token.startOffsetInclusive}-${token.endOffsetInclusive}): '${nameOfTokenType(token.type)}'`);
    }
    console.log("----------------");
    printResultOfParsing(example, parsed.result);
}

const exampleTerms : string[] = [
    `\\implies 
(\\implies A (\\implies B C)) 
(\\implies (\\implies A B) C)`,
    "\\true",
    "\\implies",
    "\\implies A (\\implies B A)",
    "\\implies A \\implies B \\true",
    "\\implies A (\\eq A \\true)",
    "\\implies (\\all x. A[x]) A[x]",
    "A[x]",
    "\\equals x x",
    "\\implies A[x, y] \\true",
    "A [x]",
    "A[x, y",
    "\\all x. (\\all x. \\eq x x)",
    "\\all x. \\all x. \\eq x x",    
    "\\all x. \\eq x x",
    "∀x. x = x",
    "(∀ x. A => B[x]) ⇒ A => (∀ x. B[x])",
    "A => B => C",
    "(∀ x. A => B[x]) => A => ∀ x. B[x]"
];

const { grammar : grammar, parser : customLRParser } = generateCustomGrammar(theory);

function tryExampleTerm(example : string) : boolean {
    console.log("---------------------");
    console.log("Parsing: '" + example + "'");
    const termExampleLines = createTextLines(example.split("\n"));
    const exampleResult = customLRParser(state, termExampleLines, 0, 0)
    if (exampleResult === undefined) {
        console.log("Could not parse.");
        return false;
    } else {
        printResultOfParsing(termExampleLines, exampleResult.result);
        return !(exampleResult.result.kind === ResultKind.TREE && exampleResult.result.type?.type === SectionName.invalid);
    }
}

let failures = 0;
for (const example of exampleTerms) {
    if (!tryExampleTerm(example)) failures += 1;
}

console.log("====================");
if (failures > 0) {
    console.log("There were " + failures + " parsing failures out of " + exampleTerms.length + " examples.");
} else {
    console.log("All " + exampleTerms.length + " examples parsed successfully.");
}*/

import { enableTests, runTests } from "./things/test";
enableTests();

import { configureDebugging, debug } from "./things/debug";
configureDebugging(console.log);

import "./environment/test";
runTests();

