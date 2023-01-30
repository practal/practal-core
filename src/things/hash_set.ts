import { combineHashes, combineHashesOrderInvariant, int, nat, string } from "./primitives";
import { Hash, mkHash } from "./things";
import { freeze } from "./utils";

const HashSetSeed = string.hash("HashSetHash");

export class HashSet<E> implements Iterable<E> {

    #hash : Hash<E>
    #map : Map<int, E[]>
    #size : nat

    constructor(hash : Hash<E>) {
        this.#hash = hash;
        this.#map = new Map();
        this.#size = 0;
        freeze(this);
    }

    [Symbol.iterator](): Iterator<E, any, undefined> {
        const map = this.#map;
        return (function *it() {
            for (const [m, es] of map) {
                yield* es;
            }
        }) ();
    }

    insert(elem : E) : E | undefined {
        const h = this.#hash.hash(elem);
        const elems : E[] | undefined = this.#map.get(h);
        if (elems === undefined) {
            this.#map.set(h, [elem]);
            this.#size++;
            return undefined;
        } else {
            for (const e of elems) {
                if (this.#hash.equal(elem, e)) return e;
            }
            elems.push(elem);
            this.#size++;
            return undefined;
        }
    }

    insertMultiple(elems : Iterable<E>) : boolean {
        const oldsize = this.size;
        for (const e of elems) this.insert(e);
        return oldsize !== this.size;
    }

    contains(elem : E) : boolean {
        const h = this.#hash.hash(elem);
        const elems : E[] | undefined = this.#map.get(h);
        if (elems === undefined) return false;
        for (const e of elems) {
            if (this.#hash.equal(elem, e)) return true;
        }
        return false;
    }

    remove(elem : E) : E | undefined {
        const h = this.#hash.hash(elem);
        const elems : E[] | undefined = this.#map.get(h);
        if (elems === undefined) return undefined;
        const len = elems.length;
        for (let i = 0; i < len; i++) {
            const e = elems[i];
            if (this.#hash.equal(elem, e)) {
                elems.splice(i, 1);
                this.#size--;
                if (len === 1) {
                    this.#map.delete(h);
                }
                return e;
            }
        }
        return undefined;
    }

    get size() : nat {
        return this.#size;
    }

    elems() : E[] {
        let ks : E[] = [];
        for (const [_, arr] of this.#map) {
            ks.push(...arr);
        }
        return ks;
    }

    hashCode() : int {
        const hash = this.#hash;
        const hs = this.elems().map (e => hash.hash(e));   
        return combineHashes([HashSetSeed, combineHashesOrderInvariant(hs)]);    
    }

    isEqualTo(other : HashSet<E>) : boolean {
        if (this.size !== other.size) return false;
        const mapsize = this.#map.size;
        if (mapsize !== other.#map.size) return false;
        for (const [h, arr] of this.#map) {
            const arr2 = other.#map.get(h);
            if (arr2 === undefined) return false;
            if (arr.length !== arr2.length) return false;
            next: 
            for (const e of arr) {
                for (const f of arr2) {
                    if (this.#hash.equal(e, f)) continue next;
                } 
                return false;
            }
        }
        return true;
    }

    get isEmpty() : boolean { return this.size === 0; }

    pick() : E | undefined {
        for (const elem of this) {
            return elem;
        }
        return undefined;
    }

    static make<E>(hash : Hash<E>, ...elems : E[]) : HashSet<E> {
        let set = new HashSet(hash);
        set.insertMultiple(elems);
        return set;
    }

}
freeze(HashSet);

const HashSetHashSeed = string.hash("HashSetHash");

export const HashSetHash : Hash<HashSet<any>> = mkHash("hash set", x => x instanceof HashSet, (x, y) => x.isEqualTo(y), x => x.hashCode());
freeze(HashSetHash);


