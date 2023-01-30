import { AssocArray, assocArrayGet, assocArrayHas, assocArrayPut, assocArrayPutIfNew, assocArrayRemove, assocArraySingleton } from "./assoc_array";
import { combineHashes, combineHashesOrderInvariant, int, nat, string } from "./primitives";
import { Hash } from "./things";
import { freeze } from "./utils";



export class HashMap<K, V> {

    #hash : Hash<K>
    #map : Map<int, AssocArray<K, V>>
    #size : nat

    constructor(hash : Hash<K>) {
        this.#hash = hash;
        this.#map = new Map();
        this.#size = 0;
        freeze(this);
    }

    put(key : K, value : V) : V | undefined {
        const h = this.#hash.hash(key);
        const keyValues : AssocArray<K, V> | undefined = this.#map.get(h);
        if (keyValues === undefined) {
            this.#map.set(h, assocArraySingleton(key, value));
            this.#size++;
            return undefined;
        } else {
            const oldSize = keyValues.length;
            const result = assocArrayPut(this.#hash, keyValues, key, value);
            this.#size += (keyValues.length - oldSize);
            return result;
        }
    }

    putIfNew(key : K, value : () => V) : V {
        const h = this.#hash.hash(key);
        const keyValues : AssocArray<K, V> | undefined = this.#map.get(h);
        if (keyValues === undefined) {
            const v = value();
            this.#map.set(h, assocArraySingleton(key, v));
            this.#size++;
            return v;
        } else {
            const oldSize = keyValues.length;
            const result = assocArrayPutIfNew(this.#hash, keyValues, key, value);
            this.#size += (keyValues.length - oldSize);
            return result;
        }
    }

    get(key : K) : V | undefined {
        const h = this.#hash.hash(key);
        const keyValues : AssocArray<K, V> | undefined = this.#map.get(h);
        if (keyValues === undefined) return undefined;
        else return assocArrayGet(this.#hash, keyValues, key);
    }

    has(key : K) : boolean {
        const h = this.#hash.hash(key);
        const keyValues : AssocArray<K, V> | undefined = this.#map.get(h);
        if (keyValues === undefined) return false;
        else return assocArrayHas(this.#hash, keyValues, key);        
    }

    remove(key : K) : V | undefined {
        const h = this.#hash.hash(key);
        const keyValues : AssocArray<K, V> | undefined = this.#map.get(h);
        if (keyValues === undefined) return undefined;
        else {
            const oldSize = keyValues.length;
            const old = assocArrayRemove(this.#hash, keyValues, key);
            if (keyValues.length === 0) {
                this.#map.delete(h);
            }
            this.#size += (keyValues.length - oldSize);
            return old;
        }
    }

    get size() : nat {
        return this.#size;
    }

    keys() : K[] {
        let ks : K[] = [];
        for (const [_, arr] of this.#map) {
            for (const [k, _] of arr) {
                ks.push(k);
            }
        }
        return ks;
    }

}
freeze(HashMap);

