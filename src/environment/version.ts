import { DetParser, repDP, seqDP, strictTokenDP, optDP, endOf, iterateContentTokens, textOfToken, orDP } from "../pyramids/deterministic_parser";
import { charL, firstL, Lexer, literalL, rep1L, repL, seqL } from "../pyramids/lexer";
import { createTextLines } from "../pyramids/textlines";
import { identifierL } from "../term_parser";
import { arrayCompare, arrayCompareLexicographically, arrayCompareLexicographicallyZ, arrayHash, ArrayOrder } from "../things/array";
import { combineHashes, nat } from "../things/primitives";
import { assert } from "../things/test";
import { mkOrderAndHash, Relation } from "../things/things";
import { freeze, internalError, notImplemented, privateConstructor } from "../things/utils";
import { Identifier } from "./identifier";

enum Token {
    core,
    prerelease_id,
    prerelease_num,
    build,
    punctuation
}

type P = DetParser<null, null, Token>

const zeroL = literalL("0");
const digitL = charL(c => c >= "0" && c <= "9");
const positiveDigitL = charL(c => c >= "1" && c <= "9");
const numericIdL = firstL(seqL(positiveDigitL, repL(digitL)), zeroL);
const dotL = literalL(".");
const dotP : P = strictTokenDP(dotL, Token.punctuation);
function dotSeparatedP(p : P) : P {
    return seqDP(p, repDP(seqDP(dotP, p)));
}
const versionCoreP : P = dotSeparatedP(strictTokenDP(numericIdL, Token.core));
const prereleaseIdP : P = strictTokenDP(identifierL, Token.prerelease_id);
const prereleaseNumP : P = strictTokenDP(numericIdL, Token.prerelease_num);
const prereleaseP : P = dotSeparatedP(orDP(prereleaseIdP, prereleaseNumP));
const letterL = charL(c => (c >= "A" && c <= "Z") || (c >= "a" && c <= "z"));
const minusL = literalL("-");
const minusP : P = strictTokenDP(minusL, Token.punctuation);
const plusL = literalL("+");
const plusP : P = strictTokenDP(plusL, Token.punctuation);
const buildP : P = strictTokenDP(rep1L(firstL(letterL, digitL, dotL, minusL, plusL)), Token.punctuation);
const versionP = seqDP(versionCoreP, optDP(minusP, prereleaseP), optDP(plusP, buildP));

const prereleaseT = mkOrderAndHash<Identifier | nat>("Prelease component",
    x => Identifier.thing.is(x) || nat.is(x),
    (x, y) => {
        if (nat.is(x)) {
            return nat.is(y) ? nat.compare(x, y) : Relation.LESS;
        } else {
            return nat.is(y) ? Relation.GREATER : Identifier.thing.compare(x, y);
        }
    },
    x => nat.is(x) ? nat.hash(x) : Identifier.thing.hash(x));

export class Version {
    static #internal = false

    core : nat[]
    prerelease : (Identifier | nat)[]
    build : string

    constructor(core : nat[], prerelease : (Identifier | nat)[], build : string) {
        if (!Version.#internal) privateConstructor("Version");
        this.core = core;
        this.prerelease = prerelease;
        this.build = build;
    }

    toString() : string {
        let version = this.core.map(s => String(s)).join(".");
        if (this.prerelease.length > 0) {
            const prerelease = this.prerelease.map(id => id.toString()).join(".");
            version += "-" + prerelease;
        }
        if (this.build.length > 0) {
            version += "+" + this.build;
        }
        return version;
    }

    static make(version : string) : Version | undefined {
        const lines = createTextLines([version]);
        const parsed = versionP(null, lines, 0, 0);
        if (parsed === undefined) return undefined;
        const [endLine, endOffset] = endOf(parsed.result);
        if (endLine < 1 && endOffset < version.length) return undefined;
        const core = [...iterateContentTokens(parsed.result, t => t === Token.core)].
            map(t => Number.parseInt(textOfToken(lines, t)));
        const ids = [...iterateContentTokens(parsed.result, t => t === Token.prerelease_id || t === Token.prerelease_num)].
            map(t => t.type === Token.prerelease_id ? Identifier.make(textOfToken(lines, t)) : Number.parseInt(textOfToken(lines, t)));
        const build = [...iterateContentTokens(parsed.result, t => t === Token.build)].
            map(t => textOfToken(lines, t));
        for (const id of ids) {
            if (id === undefined) return undefined;
        }
        const prerelease = ids as (Identifier | nat)[];
        freeze(core);
        freeze(prerelease);
        this.#internal = true;
        const made = new Version(core, prerelease, build.length > 0 ? build[0] : ""); 
        this.#internal = false;
        return made;
    }

    static thing = mkOrderAndHash<Version>("Version",
        (x : Version) => { return x instanceof Version; },
        (x : Version, y : Version) => {
            let c = arrayCompareLexicographicallyZ(nat, 0, x.core, y.core);
            if (c !== Relation.EQUAL) return c;
            c = arrayCompareLexicographically(prereleaseT, x.prerelease, y.prerelease);
            if (c !== Relation.EQUAL) return c;
            return Relation.EQUAL;
        },
        (x : Version) => combineHashes([arrayHash(nat, x.core), arrayHash(prereleaseT, x.prerelease)])
    );

}

assert(() => {
    const v1 = Version.make("1.2-pre-alpha");
    const v2 = Version.make("1.2-pre-alpha.10");
    const v3 = Version.make("1.2-pre-alpha.01");
    if (v1 === undefined || v2 === undefined || v3 !== undefined) return false;
    if (Version.thing.compare(v1, v2) !== Relation.LESS) return false;
    if (Version.thing.compare(v2, v1) !== Relation.GREATER) return false;
    return true;
});

assert(() => {
    const v1 = Version.make("1.2-pre-alpha");
    const v2 = Version.make("1.2.0-pre-alpha+42");
    if (v1 === undefined || v2 === undefined) return false;
    if (Version.thing.compare(v1, v2) !== Relation.EQUAL) return false;
    if (Version.thing.compare(v2, v1) !== Relation.EQUAL) return false;
    if (v1.core.length !== 2 || v1.core[0] !== 1 || v1.core[1] !== 2) return false;
    if (v2.core.length !== 3 || v2.core[0] !== 1 || v2.core[1] !== 2 || v2.core[2] !== 0) return false;
    return true;
});