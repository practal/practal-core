import { int } from "./primitives";
import { assertNever } from "./test";
import { freeze } from "./utils";

export const enum Relation {
    UNRELATED,
    LESS,
    EQUAL,
    GREATER
}

export function invertRelation(relation : Relation) : Relation {
    switch (relation) {
        case Relation.LESS: return Relation.GREATER;
        case Relation.GREATER: return Relation.LESS;
        case Relation.EQUAL: return Relation.EQUAL;
        case Relation.UNRELATED: return Relation.UNRELATED;
        default: assertNever(relation);
    }
}
freeze(invertRelation);

export interface Thing<T> {

    name : string

    is(value : any) : value is T

    assert(value : any) : asserts value is T

}

export interface Equality<T> extends Thing<T> {

    /** Here we can assume that `is(x)` and `is(y)` both hold.  */
    equal(x : T, y : T) : boolean

}

export interface Order<T> extends Equality<T> {

    /** 
     * Here we can assume that `is(x)` and `is(y)` both hold. 
     * Must be compatible with {@link Equality.equals}: 
     * `equal(x, y) === (compare(x, y) === Relation.EQUAL)`
     **/
    compare(x : T, y : T) : Relation

}

export interface Hash<T> extends Equality<T> {

    /** 
     * Here we can assume that `is(x)` holds. 
     * Must be compatible with {@link Equality.equals}: 
     * `equal(x, y)` implies `hash(x) === hash(y)` 
     */
    hash(x : T) : int

}

const defaultThingName = "thing";

export function mkThing<T>(
    name : string | undefined, 
    check : (value : any) => boolean) : Thing<T> 
{
    name = name ?? defaultThingName;
    const thing : Thing<T> = {
        name: name,
        is: function (value: any): value is T {
            return check(value);
        },
        assert: function (value: any): asserts value is T {
            if (!check(value)) throw new Error("not a " + name + ": " + value);
        }
    };
    return freeze(thing);
}
freeze(mkThing);

export function assertThings<T>(thing : Thing<T>, ...values : T[]) {
    for (const v of values) thing.assert(v);
}

export function mkEquality<T>(
    name : string | undefined, 
    check : (x : T) => boolean, 
    equal : (x : T, y : T) => boolean) 
{
    name = name ?? defaultThingName;
    const eq : Equality<T> = {
        name: name,
        is: function (value: any): value is T {
            return check(value);
        },
        assert: function (value: any): asserts value is T {
            if (!check(value)) throw new Error("not a " + name + ": " + value);
        },
        equal: function (x: T, y: T): boolean {
            return equal(x, y);
        }
    };
    return freeze(eq);
}
freeze(mkEquality);

export function mkOrder<T>(
    name : string | undefined, 
    check : (x : T) => boolean, 
    compare : (x : T, y : T) => Relation) 
{
    name = name ?? defaultThingName;
    const order : Order<T> = {
        name: name,
        is: function (value: any): value is T {
            return check(value);
        },
        assert: function (value: any): asserts value is T {
            if (!check(value)) throw new Error("not a " + name + ": " + value);
        },
        equal: function (x: T, y: T): boolean {
            return compare(x, y) === Relation.EQUAL;
        },
        compare: function (x: T, y: T): Relation {
            return compare(x, y);
        }
    };
    return order;
}
freeze(mkOrder);

export function mkHash<T>(
    name : string | undefined, 
    check : (x : T) => boolean, 
    equal : (x : T, y : T) => boolean,
    hashing : (x : T) => int) : Hash<T>
{
    name = name ?? defaultThingName;
    const hash : Hash<T> = {
        name: name,
        is: function (value: any): value is T {
            return check(value);
        },
        assert: function (value: any): asserts value is T {
            if (!check(value)) throw new Error("not a " + name + ": " + value);
        },
        equal: function (x: T, y: T): boolean {
            return equal(x, y);
        },
        hash: function(x: T): int {
            return hashing(x);
        }
    };
    return hash;
}
freeze(mkHash);

export function mkOrderAndHash<T>(
    name : string | undefined, 
    check : (x : T) => boolean, 
    compare : (x : T, y : T) => Relation,
    hash : (x : T) => int) : Order<T> & Hash<T>
{
    name = name ?? defaultThingName;
    const order : Order<T> & Hash<T> = {
        name: name,
        is: function (value: any): value is T {
            return check(value);
        },
        assert: function (value: any): asserts value is T {
            if (!check(value)) throw new Error("not a " + name + ": " + value);
        },
        equal: function (x: T, y: T): boolean {
            return compare(x, y) === Relation.EQUAL;
        },
        compare: function (x: T, y: T): Relation {
            return compare(x, y);
        },
        hash: function(x: T): int {
            return hash(x);
        }
    };
    return order;
}
freeze(mkOrderAndHash);


