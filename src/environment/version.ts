import { DetParser, repDP, seqDP, strictTokenDP, optDP, endOf, iterateContentTokens, textOfToken, orDP, modifyResultDP, DPResult, Result, joinResults } from "../pyramids/deterministic_parser";
import { charL, firstL, Lexer, literalL, rep1L, repL, seqL } from "../pyramids/lexer";
import { createTextLines, TextLines } from "../pyramids/textlines";
import { identifierL } from "../term_parser";
import { arrayCompare, arrayCompareLexicographically, arrayCompareLexicographicallyZ, arrayHash, ArrayOrder } from "../things/array";
import { debug } from "../things/debug";
import { boolean, combineHashes, nat } from "../things/primitives";
import { assertEq, assertIsDefined, assertIsUndefined, assertTrue, Test } from "../things/test";
import { Hash, mkOrderAndHash, Order, Relation } from "../things/things";
import { freeze, internalError, notImplemented, privateConstructor } from "../things/utils";
import { Identifier } from "./identifier";

enum Token {
    core,
    prerelease_id,
    prerelease_num,
    build,
    punctuation,
    greater,
    less,
    greaterEq,
    lessEq
}

enum SectionKind {
    version,
    range,
    versions
}

type SectionVersion = {
    kind : SectionKind.version,
    version : Version
}
function SectionVersion(version : Version) : SectionVersion {
    return { kind : SectionKind.version, version : version };
}

type SectionRange = {
    kind : SectionKind.range,
    range : VersionRange
}

type SectionVersions = {
    kind : SectionKind.versions,
    union : Versions
}

type Section = SectionVersion | SectionRange | SectionVersions

type P = DetParser<null, Section, Token>

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
const buildP : P = strictTokenDP(rep1L(firstL(letterL, digitL, dotL, minusL, plusL)), Token.build);
const versionP = modifyResultDP(seqDP(versionCoreP, optDP(minusP, prereleaseP), optDP(plusP, buildP)), 
    (lines, result) => {
        if (result === undefined) return undefined;
        const version = Version.construct(lines, result.result);
        if (version === undefined) return undefined;
        result.result.type = SectionVersion(version);
        return result;
    });
const greaterEqP : P = strictTokenDP(firstL(literalL(">="), literalL("≥")), Token.greaterEq);
const lessEqP : P = strictTokenDP(firstL(literalL("<="), literalL("≤")), Token.lessEq);
const greaterP : P = strictTokenDP(literalL(">"), Token.greater);
const lessP : P = strictTokenDP(literalL("<"), Token.less);
//const orP : P = strictTokenDP(literalL("||"), Token


//const versionRange1P

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

    private constructor(core : nat[], prerelease : (Identifier | nat)[], build : string) {
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

    static construct(lines : TextLines, result : Result<Section, Token>) : Version | undefined {
        const [endLine, endOffset] = endOf(result);
        //if (endLine < 1 && endOffset < version.length) return undefined;
        const core = [...iterateContentTokens(result, t => t === Token.core)].
            map(t => Number.parseInt(textOfToken(lines, t)));
        const ids = [...iterateContentTokens(result, t => t === Token.prerelease_id || t === Token.prerelease_num)].
            map(t => t.type === Token.prerelease_id ? Identifier.make(textOfToken(lines, t)) : Number.parseInt(textOfToken(lines, t)));
        const build = [...iterateContentTokens(result, t => t === Token.build)].
            map(t => textOfToken(lines, t));
        for (const id of ids) {
            if (id === undefined) return undefined;
        }
        const prerelease = ids as (Identifier | nat)[];
        freeze(core);
        freeze(prerelease);
        Version.#internal = true;
        const made = new Version(core, prerelease, build.length > 0 ? build[0] : ""); 
        Version.#internal = false;
        return made;
    }

    static parse(version : string) : Version | undefined {
        const lines = createTextLines([version]);
        const parsed = versionP(null, lines, 0, 0);
        if (parsed === undefined) return undefined;
        const [endLine, endOffset] = endOf(parsed.result);
        if (endLine < 1 && endOffset < version.length) return undefined;
        return Version.construct(lines, parsed.result);
    }

    static thing : Order<Version> & Hash<Version> = mkOrderAndHash<Version>("Version",
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

Test(() => {
    const v1 = Version.parse("1.2-pre-alpha");
    const v2 = Version.parse("1.2-pre-alpha.10");
    const v3 = Version.parse("1.2-pre-alpha.01");
    assertIsDefined(v1);
    assertIsDefined(v2);
    assertIsUndefined(v3);
    assertEq(Version.thing.compare(v1, v2), Relation.LESS);
    assertEq(Version.thing.compare(v2, v1), Relation.GREATER);
}, "prerelease");

Test(() => {
    const v1 = Version.parse("1.2-pre-alpha");
    const v2 = Version.parse("1.2.0-pre-alpha+42");
    assertIsDefined(v1);
    assertIsDefined(v2);
    assertEq(Version.thing.compare(v1, v2), Relation.EQUAL);
    assertEq(Version.thing.compare(v2, v1), Relation.EQUAL);
    assertTrue(v1.core.length === 2 && v1.core[0] === 1 && v1.core[1] === 2);
    assertTrue(v2.core.length === 3 && v2.core[0] === 1 && v2.core[1] === 2 && v2.core[2] === 0);
    assertEq(v1.build, "");
    assertEq(v2.build, "42");
}, "build");

export class VersionRange {
    static #internal = false;

    lower : Version | undefined
    inclusive_lower : boolean
    upper : Version | undefined
    inclusive_upper : boolean
    
    private constructor(lower : Version | undefined, inclusive_lower : boolean, upper : Version, inclusive_upper : boolean) {
        if (!VersionRange.#internal) privateConstructor("VersionRange");
        this.lower = lower;
        this.inclusive_lower = inclusive_lower;
        this.upper = upper;
        this.inclusive_upper = inclusive_upper;
        freeze(this);
    }

    static make(lower : Version | undefined, inclusive_lower : boolean, upper : Version, inclusive_upper : boolean) : VersionRange | undefined {
        if (!(Version.thing.is(lower) && Version.thing.is(upper))) return undefined;
        if (!(boolean.is(inclusive_lower) && boolean.is(inclusive_upper))) return undefined;
        VersionRange.#internal = true;
        const made = new VersionRange(lower, inclusive_lower, upper, inclusive_upper);
        VersionRange.#internal = false;
        return made;
    }
}
freeze(VersionRange);

export class Versions {
    static #internal = false;
    ranges : (Version | VersionRange)[];

    constructor(ranges : (Version | VersionRange)[]) {
        if (!Versions.#internal) privateConstructor("Versions");
        this.ranges = ranges;
        freeze(this);
    }

    static make(ranges : (Version | VersionRange)[]) : Versions | undefined {
        const verified : (Version | VersionRange)[] = [];
        for (const v of ranges) {
            if (Version.thing.is(v) || v instanceof VersionRange) {
                verified.push(v);
            } else {
                return undefined;
            }
        }
        freeze(verified);
        Versions.#internal = true;
        const made = new Versions(verified);
        Versions.#internal = false;
        return made;
    }

}
freeze(Versions);