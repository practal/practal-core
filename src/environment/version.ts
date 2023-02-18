import { DetParser, repDP, seqDP, strictTokenDP, optDP, endOf, iterateContentTokens, textOfToken, orDP, modifyResultDP, DPResult, Result, joinResults, iterateContentSections, parseLine } from "../pyramids/deterministic_parser";
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
    whitespace,
    pre,
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

function SectionRange(range : VersionRange) : SectionRange {
    return { kind : SectionKind.range, range : range };
}

type SectionVersions = {
    kind : SectionKind.versions,
    versions : Versions
}

function SectionVersions(versions : Versions) : SectionVersions {
    return { kind : SectionKind.versions, versions : versions };
} 

type Section = SectionVersion | SectionRange | SectionVersions

type P = DetParser<null, Section, Token>

const digitL = charL(c => c >= "0" && c <= "9");
const positiveDigitL = charL(c => c >= "1" && c <= "9");
const numericIdL = seqL(positiveDigitL, repL(digitL));
const dotL = literalL(".");
const dotP : P = strictTokenDP(dotL, Token.punctuation);
const ows : P = repDP(strictTokenDP(literalL(" "), Token.whitespace));
function dotSeparatedP(p : P) : P {
    return seqDP(p, repDP(seqDP(dotP, p)));
}

const releaseIdP : P = strictTokenDP(identifierL, Token.id);
const releaseNumP : P = strictTokenDP(numericIdL, Token.num);
const releaseP : P = dotSeparatedP(orDP(releaseIdP, releaseNumP));
const preP : P = strictTokenDP(literalL("@"), Token.pre)

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
        if (b === "") return a;
        return a + "@" + b;
    }

    static #construct(lines : TextLines, result : Result<Section, Token>) : Version | undefined {
        //const [endLine, endOffset] = endOf(result);
        //if (endLine < 1 && endOffset < version.length) return undefined;
        const components = [...iterateContentTokens(result, t => t === Token.num || t === Token.id || t === Token.pre)];
            //map(t => textOfToken(lines, t));
        const release : (Identifier | nat)[] = [];
        const prerelease : (Identifier | nat)[] = [];
        let fill_release = true;
        for (const c of components) {
            if (c.type === Token.pre) {
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
        if (release.length === 0) return undefined;
        Version.#internal = true;
        const made = new Version(release, prerelease); 
        Version.#internal = false;
        return made;
    }

    static parse(version : string) : Version | undefined {
        const s = parseLine(Version.parser, null, version)?.result;
        return s ? (s as SectionVersion).version : undefined;
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

    static parser : P = modifyResultDP(seqDP(releaseP, optDP(preP, releaseP)), 
        (lines, result) => {
            if (result === undefined) return undefined;
            const version = Version.#construct(lines, result.result);
            if (version === undefined) return undefined;
            result.result.type = SectionVersion(version);
            return result;
        });

}
freeze(Version);

const greaterEqP : P = strictTokenDP(firstL(literalL(">="), literalL("≥")), Token.greaterEq);
const lessEqP : P = strictTokenDP(firstL(literalL("<="), literalL("≤")), Token.lessEq);
const greaterP : P = strictTokenDP(literalL(">"), Token.greater);
const lessP : P = strictTokenDP(literalL("<"), Token.less);

function extractVersions(result : DPResult<null, Section, Token>) : Version[] | undefined {
    if (result === undefined) return undefined;
    const versions = [...iterateContentSections(result.result, s => s.kind === SectionKind.version)].
        map(s => (s.type as SectionVersion).version);
    return versions;
}

function genericRangeP(left : P, right : P, 
    lower : 0 | 1, upper : 0 | 1,
    lower_inclusive : boolean, upper_inclusive : boolean) : P 
{
    if (lower === upper) internalError();
    return modifyResultDP(seqDP(left, ows, Version.parser, ows, right, ows, Version.parser), (lines, result) => {
        const versions = extractVersions(result);
        if (versions === undefined || versions.length !== 2) return undefined;
        const range = VersionRange.make(versions[lower], lower_inclusive, versions[upper], upper_inclusive);
        if (range === undefined) return undefined;
        result!.result.type = SectionRange(range);
        return result;
    });
}

function genericHalfOpenP(op : P, lower : boolean, inclusive : boolean) : P
{
    return modifyResultDP(seqDP(op, ows, Version.parser), (lines, result) => {
        const versions = extractVersions(result);
        if (versions === undefined || versions.length !== 1) return undefined;
        const version = versions[0];
        let range : VersionRange | undefined
        if (lower) 
            range = VersionRange.make(version, inclusive, undefined, false);
        else
            range = VersionRange.make(undefined, false, version, inclusive);
        if (range === undefined) return undefined;
        result!.result.type = SectionRange(range);
        return result;
    });
}

function genericRangeSwitchedP(left : P, right : P, 
    lower : 0 | 1, upper : 0 | 1,
    lower_inclusive : boolean, upper_inclusive : boolean) : P 
{
    return genericRangeP(right, left, upper, lower, lower_inclusive, upper_inclusive);
}

const rangeP : P = orDP(
    genericRangeP(greaterP, lessP, 0, 1, false, false),
    genericRangeP(greaterP, lessEqP, 0, 1, false, true),
    genericRangeP(greaterEqP, lessP, 0, 1, true, false),
    genericRangeP(greaterEqP, lessEqP, 0, 1, true, true),
    genericRangeSwitchedP(greaterP, lessP, 0, 1, false, false),
    genericRangeSwitchedP(greaterP, lessEqP, 0, 1, false, true),
    genericRangeSwitchedP(greaterEqP, lessP, 0, 1, true, false),
    genericRangeSwitchedP(greaterEqP, lessEqP, 0, 1, true, true),
    genericHalfOpenP(greaterP, true, false),
    genericHalfOpenP(greaterEqP, true, true),
    genericHalfOpenP(lessP, false, false),
    genericHalfOpenP(lessEqP, false, true)
);

export class VersionRange {
    static #internal = false;

    lower : Version | undefined
    inclusive_lower : boolean
    upper : Version | undefined
    inclusive_upper : boolean
    
    private constructor(lower : Version | undefined, inclusive_lower : boolean, upper : Version | undefined, inclusive_upper : boolean) {
        if (!VersionRange.#internal) privateConstructor("VersionRange");
        this.lower = lower;
        this.inclusive_lower = inclusive_lower;
        this.upper = upper;
        this.inclusive_upper = inclusive_upper;
        freeze(this);
    }

    toString() : string {
        let s = "";
        if (this.lower) {
            s += (this.inclusive_lower ? "≥" : ">") + this.lower;
        }
        if (this.upper) {
            if (s !== "") s += " ";
            s += (this.inclusive_upper ? "≤" : "<") + this.upper;
        }
        return s;
    }

    static parse(range : string) : VersionRange | undefined {
        const s = parseLine(VersionRange.parser, null, range)?.result;
        return s ? (s as SectionRange).range : undefined;        
    }

    static make(lower : Version | undefined, inclusive_lower : boolean, upper : Version | undefined, inclusive_upper : boolean) : VersionRange | undefined {
        if (!((lower === undefined || Version.thing.is(lower)) && (upper === undefined || Version.thing.is(upper)))) return undefined;
        if (!(boolean.is(inclusive_lower) && boolean.is(inclusive_upper))) return undefined;
        VersionRange.#internal = true;
        const made = new VersionRange(lower, inclusive_lower, upper, inclusive_upper);
        VersionRange.#internal = false;
        return made;
    }

    static parser : P = rangeP;
}
freeze(VersionRange);

const orP : P = strictTokenDP(literalL("|"), Token.or);
const vP : P = orDP(VersionRange.parser, Version.parser);
const versionsP : P = modifyResultDP(seqDP(vP, repDP(ows, orP, ows, vP)), 
    (lines, result) => {
        if (result === undefined) return undefined;
        const sections = [...iterateContentSections(result.result, s => s.kind === SectionKind.version || s.kind === SectionKind.range)];
        const vs : (VersionRange | Version)[] = [];
        for (const section of sections) {
            if (section.type?.kind === SectionKind.version) {
                vs.push(section.type.version);
            } else if (section.type?.kind === SectionKind.range) {
                vs.push(section.type.range);
            } else internalError();
        }
        const versions = Versions.make(vs);
        if (versions === undefined) return undefined;
        result.result.type = SectionVersions(versions);
        return result;
    });

export class Versions {
    static #internal = false;
    versions : (Version | VersionRange)[];

    constructor(versions : (Version | VersionRange)[]) {
        if (!Versions.#internal) privateConstructor("Versions");
        this.versions = versions;
        freeze(this);
    }

    toString() : string {
        return this.versions.map(v => v.toString()).join(" | ");
    }

    static parse(range : string) : Versions | undefined {
        const s = parseLine(Versions.parser, null, range)?.result;
        return s ? (s as SectionVersions).versions : undefined;        
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
        if (verified.length === 0) return undefined;
        Versions.#internal = true;
        const made = new Versions(verified);
        Versions.#internal = false;
        return made;
    }

    static parser : P = versionsP;

}
freeze(Versions);