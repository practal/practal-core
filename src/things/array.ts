import { combineHashes, int, nat, string } from "./primitives";
import { Equality, Hash, mkEquality, mkHash, mkOrder, mkOrderAndHash, Order, Relation, Thing } from "./things";
import { freeze } from "./utils";

export function arrayIs<E>(thing : Thing<E>, A : E[]) : boolean {
    if (!(A instanceof Array)) return false;
    for (const elem of A) {
        if (!thing.is(elem)) return false;
    }
    return true;    
}
freeze(arrayIs);

export function arrayEqual<E>(eq : Equality<E>, A : E[], B : E[]) : boolean {
    const len = A.length;
    if (len !== B.length) return false;
    for (let i = 0; i < len; i++) {
        if (!eq.equal(A[i], B[i])) return false;
    }
    return true;    
}
freeze(arrayEqual);

const ArrayHashSeed = string.hash("Array");
export function arrayHash<E>(hash : Hash<E>, A : E[]) : int {
    const hashes = [ArrayHashSeed, ...A.map(x => hash.hash(x))];
    return combineHashes(hashes);
}
freeze(arrayHash);

export function arrayCompare<E>(order : Order<E>, A : E[], B : E[]) : Relation {
    const len = A.length;
    let r = nat.compare(len, B.length);
    if (r !== Relation.EQUAL) return r;
    for (let i = 0; i < len; i++) {
        r = order.compare(A[i], B[i]);
        if (r !== Relation.EQUAL) return r;
    }
    return Relation.EQUAL;    
}
freeze(arrayCompare);

export function arrayCompareLexicographicallyZ<E>(order : Order<E>, zero : E, X : E[], Y : E[]) : Relation {
    for (let i = 0; i < Math.max(X.length, Y.length); i++) {
        const x = i < X.length ? X[i] : zero;
        const y = i < Y.length ? Y[i] : zero;
        const c = order.compare(x, y);
        if (c !== Relation.EQUAL) return c;
    }
    return Relation.EQUAL;
}
freeze(arrayCompareLexicographicallyZ);

export function arrayCompareLexicographically<E>(order : Order<E>, X : E[], Y : E[]) : Relation {
    for (let i = 0; i < Math.min(X.length, Y.length); i++) {
        const c = order.compare(X[i], Y[i]);
        if (c !== Relation.EQUAL) return c;
    }
    return nat.compare(X.length, Y.length);
}
freeze(arrayCompareLexicographically);

export function ArrayEquality<E>(thing : Equality<E>) : Equality<E[]> {
    return mkEquality("Array", 
        A => arrayIs(thing, A),
        (A, B) => arrayEqual(thing, A, B));
}
freeze(ArrayEquality);


export function ArrayHash<E>(thing : Hash<E>) : Hash<E[]> {
    return mkHash("Array", 
        A => arrayIs(thing, A),
        (A, B) => arrayEqual(thing, A, B),
        A => arrayHash(thing, A));
}
freeze(ArrayHash);

export function ArrayOrder<E>(thing : Order<E>) : Order<E[]> {
    return mkOrder("Array", 
        A => arrayIs(thing, A),
        (A, B) => arrayCompare(thing, A, B));
}
freeze(ArrayOrder);

export function ArrayOrderAndHash<E>(thing : Order<E> & Hash<E>) : Order<E[]> & Hash<E[]>{
    return mkOrderAndHash("Array", 
        A => arrayIs(thing, A),
        (A, B) => arrayCompare(thing, A, B),
        A => arrayHash(thing, A));
}
freeze(ArrayOrderAndHash);
