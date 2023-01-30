import { Equality } from "./things";

export type AssocArray<K, V> = [K, V][]

export function assocArraySingleton<K, V>(key : K, value : V) : AssocArray<K, V> {
    return [[key, value]];
}

export function assocArrayEmpty<K, V>() : AssocArray<K, V> {
    return [];
}

export function assocArrayPut<K, V>(eq : Equality<K>, arr : AssocArray<K, V>, key : K, value : V) : V | undefined {
    const len = arr.length;
    for (let i = 0; i < len; i++) {
        if (eq.equal(key, arr[i][0])) {
            const old = arr[i][1];
            arr[i][1] = value;
            return old;
        } 
    }
    arr.push([key, value]);
    return undefined;
}

export function assocArrayPutIfNew<K, V>(eq : Equality<K>, arr : AssocArray<K, V>, key : K, value : () => V) : V {
    const len = arr.length;
    for (let i = 0; i < len; i++) {
        if (eq.equal(key, arr[i][0])) {
            return arr[i][1];
        } 
    }
    const v = value();
    arr.push([key, v]);
    return v;
}

export function assocArrayGet<K, V>(eq : Equality<K>, arr : AssocArray<K, V>, key : K) : V | undefined {
    const len = arr.length;
    for (let i = 0; i < len; i++) {
        if (eq.equal(key, arr[i][0])) {
            return arr[i][1];
        } 
    }
    return undefined;
}

export function assocArrayHas<K, V>(eq : Equality<K>, arr : AssocArray<K, V>, key : K) : boolean {
    const len = arr.length;
    for (let i = 0; i < len; i++) {
        if (eq.equal(key, arr[i][0])) {
            return true;
        } 
    }
    return false;
}

export function assocArrayRemove<K, V>(eq : Equality<K>, arr : AssocArray<K, V>, key : K) : V | undefined {
    const len = arr.length;
    for (let i = 0; i < len; i++) {
        if (eq.equal(key, arr[i][0])) {
            const old = arr[i][1];
            arr.splice(i, 1);
            return old;
        } 
    }
    return undefined;
}
