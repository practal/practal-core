import { DetParser, repDP, seqDP, strictTokenDP, optDP, endOf, iterateContentTokens, textOfToken, orDP, modifyResultDP, DPResult, Result, joinResults } from "../pyramids/deterministic_parser";
import { charL, firstL, Lexer, literalL, rep1L, repL, seqL } from "../pyramids/lexer";
import { createTextLines, TextLines } from "../pyramids/textlines";
import { identifierL } from "../term_parser";
import { arrayCompare, arrayCompareLexicographically, arrayCompareLexicographicallyZ, arrayHash, ArrayOrder } from "../things/array";
import { debug } from "../things/debug";
import { boolean, combineHashes, nat, string } from "../things/primitives";
import { assertEQ, assertEq, assertIsDefined, assertIsUndefined, assertLESS, assertTrue, assertUNRELATED, Test } from "../things/test";
import { Hash, mkOrderAndHash, Order, Relation } from "../things/things";
import { freeze, internalError, notImplemented, privateConstructor } from "../things/utils";
import { Identifier } from "./identifier";

enum Token {
    current,
    id,
    num,
    punctuation,
    greater,
    less,
    greaterEq,
    lessEq, 
    or
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

const digitL = charL(c => c >= "0" && c <= "9");
const positiveDigitL = charL(c => c >= "1" && c <= "9");
const numericIdL = seqL(positiveDigitL, repL(digitL));
const dotL = literalL(".");
const dotP : P = strictTokenDP(dotL, Token.punctuation);
function dotSeparatedP(p : P) : P {
    return seqDP(p, repDP(seqDP(dotP, p)));
}

const releaseIdP : P = strictTokenDP(identifierL, Token.id);
const releaseNumP : P = strictTokenDP(numericIdL, Token.num);
const releaseP : P = dotSeparatedP(orDP(releaseIdP, releaseNumP));
const currentP : P = strictTokenDP(literalL("@"), Token.current)
const greaterEqP : P = strictTokenDP(firstL(literalL(">="), literalL("≥")), Token.greaterEq);
const lessEqP : P = strictTokenDP(firstL(literalL("<="), literalL("≤")), Token.lessEq);
const greaterP : P = strictTokenDP(literalL(">"), Token.greater);
const lessP : P = strictTokenDP(literalL("<"), Token.less);
const orP : P = strictTokenDP(literalL(","), Token.or);


//const versionRange1P

const releaseT = mkOrderAndHash<Identifier | nat>("release",
    x => Identifier.thing.is(x) || nat.is(x),
    (x, y) => {
        if (nat.is(x)) {
            return nat.is(y) ? nat.compare(x, y) : Relation.UNRELATED;
        } else {
            return nat.is(y) ? Relation.UNRELATED : 
                (Identifier.thing.compare(x, y) === Relation.EQUAL ? 
                    Relation.EQUAL : Relation.UNRELATED);
        }
    },
    x => nat.is(x) ? nat.hash(x) : Identifier.thing.hash(x));

const versionHash = string.hash("Version");

export class Version {
    static #internal = false

    release : (Identifier | nat)[]
    prerelease : (Identifier | nat)[]
    
    private constructor(release : (Identifier | nat)[], prerelease : (Identifier | nat)[]) {
        if (!Version.#internal) privateConstructor("Version");
        this.release = release;
        this.prerelease = prerelease;
    }

    toString() : string {
        const a = this.release.map(id => id.toString()).join(".");
        const b = this.prerelease.map(id => id.toString()).join(".");
        if (a === "" && b === "") return "@";
        if (b === "") return a;
        return a + "@" + b;
    }

    static #construct(lines : TextLines, result : Result<Section, Token>) : Version | undefined {
        //const [endLine, endOffset] = endOf(result);
        //if (endLine < 1 && endOffset < version.length) return undefined;
        const components = [...iterateContentTokens(result, t => t === Token.num || t === Token.id || t === Token.current)];
            //map(t => textOfToken(lines, t));
        const release : (Identifier | nat)[] = [];
        const prerelease : (Identifier | nat)[] = [];
        let fill_release = true;
        for (const c of components) {
            if (c.type === Token.current) {
                fill_release = false;
            } else if (c.type === Token.id) {
                const text = textOfToken(lines, c);
                const id = Identifier.make(text);
                if (id === undefined) return undefined;
                if (fill_release) release.push(id);
                else prerelease.push(id);
            } else if (c.type === Token.num) {
                const num = Number.parseInt(textOfToken(lines, c));
                if (fill_release) release.push(num);
                else prerelease.push(num);
            }
        }
        freeze(release);
        freeze(prerelease);
        if (release.length === 0 && prerelease.length !== 0) return undefined;
        Version.#internal = true;
        const made = new Version(release, prerelease); 
        Version.#internal = false;
        return made;
    }

    static parse(version : string) : Version | undefined {
        const lines = createTextLines([version]);
        const parsed = Version.parser(null, lines, 0, 0);
        if (parsed === undefined) return undefined;
        const [endLine, endOffset] = endOf(parsed.result);
        if (endLine < 1 && endOffset < version.length) return undefined;
        return (parsed.result.type as SectionVersion).version;
    }

    static thing : Order<Version> & Hash<Version> = mkOrderAndHash<Version>("Version",
        (x : Version) => { return x instanceof Version; },
        (x : Version, y : Version) => {
            if (x.release.length === 0 && y.release.length !== 0) return Relation.GREATER;
            if (x.release.length !== 0 && y.release.length === 0) return Relation.LESS;
            let c = arrayCompareLexicographically(releaseT, x.release, y.release);
            if (c !== Relation.EQUAL) return c;
            if (x.prerelease.length === 0 && y.prerelease.length !== 0) return Relation.GREATER;
            if (x.prerelease.length !== 0 && y.prerelease.length === 0) return Relation.LESS;
            return arrayCompareLexicographically(releaseT, x.prerelease, y.prerelease);
        },
        (x : Version) => combineHashes([versionHash, arrayHash(releaseT, x.release), arrayHash(releaseT, x.prerelease)])
    );

    static parser : P = modifyResultDP(orDP(
        seqDP(releaseP, optDP(currentP, releaseP)),
        currentP), 
        (lines, result) => {
            if (result === undefined) return undefined;
            const version = Version.#construct(lines, result.result);
            if (version === undefined) return undefined;
            result.result.type = SectionVersion(version);
            return result;
        });

}
freeze(Version);

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