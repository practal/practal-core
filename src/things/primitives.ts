import { Thing, Equality, Relation, mkOrderAndHash, mkEquality, Hash, Order } from "./things";
import { freeze } from "./utils";

function compareInt(x : int, y : int) : Relation {
    if (x === y) return Relation.EQUAL;
    else if (x < y) return Relation.LESS;
    else return Relation.GREATER;
}

/** The type of integers. */
export type int = number 
export const int : Hash<int> & Order<int> = mkOrderAndHash("integer", 
    x => Number.isSafeInteger(x), compareInt, x => x);

/** The type of natural numbers starting from 0. */
export type nat = number
export const nat : Hash<nat> & Order<nat> = mkOrderAndHash("natural number", 
    x => Number.isSafeInteger(x) && x >= 0, compareInt, x => x);

export const sameValueZero : Equality<any> = mkEquality("any", 
    x => true, (x, y) => x === y || (Number.isNaN(x) && Number.isNaN(y)));

/** Combines a sequence of hashes into a single hash. */ 
export function combineHashes(hashes : Iterable<int>) : int {
    let sum = 1;
    for (const h of hashes) {
        sum = 31 * sum + h;
        sum = sum & sum;
    }
    return sum;
}
freeze(combineHashes);

/** 
 * Combines a sequence of hashes into a single hash. 
 * Looks what we really want here is the MurmurHash3 (https://github.com/scala/scala/blob/2.11.x/src/library/scala/util/hashing/MurmurHash3.scala).
 * But for now we just use addition like Java does.
 **/ 
export function combineHashesOrderInvariant(hashes : Iterable<int>) : int {
    let sum = 1;
    for (const h of hashes) {
        sum += (h | 0);
        sum = sum & sum;
    }
    return sum;
}
freeze(combineHashesOrderInvariant);

/** Returns a sequence of the [codepoints](https://unicode.org/glossary/#code_point) of a string. */
export function* iterateCodepoints(s : string): Generator<nat, void, unknown> {
    for (const v of s) {
        yield v.codePointAt(0)!;
    }
}
freeze(iterateCodepoints);

function compareString(x : string, y : string) : Relation {
    if (x === y) return Relation.EQUAL;
    else if (x < y) return Relation.LESS;
    else return Relation.GREATER;
}

function hashString(x : string) : int {
    return combineHashes(iterateCodepoints(x));
}

export const string = mkOrderAndHash("string", 
    x => typeof x === "string", compareString, hashString);

const hashTrue = string.hash("true");
const hashFalse = string.hash("false");
export const boolean : Hash<boolean> & Order<boolean> = mkOrderAndHash("boolean",
    x => x === true || x === false, 
    (x, y) => compareInt(x ? 1 : 0, y ? 1 : 0), 
    x => x ? hashTrue : hashFalse);