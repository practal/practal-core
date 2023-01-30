import { performance } from "perf_hooks";
import { debug } from "./debug";

export function freeze<V>(x : V) : V {
    if (typeof x === "function") {
        Object.freeze(x.prototype);
        Object.freeze(x);    
    } else {
        Object.freeze(x);
    }
    return x;
}
freeze(freeze);

export function assertNever(x : never) : never {
    throw new Error("unexpected value: " + x);
}
freeze(assertNever);

export function assertTrue(x : boolean) : asserts x is true {
    if (!x) throw new Error("Assertion failed.");
}

export function notImplemented() : never {
    throw new Error("not implemented yet");
}

export function privateConstructor(name : string) : never {
    throw new Error("Private constructor of " + name + " cannot be called directly.");
}

export function internalError(msg? : string) : never {
    if (msg) throw new Error("Internal error: " + msg);
    else throw new Error("Internal error.");
}

export function force<V>(value : V | undefined | null) : V {
    if (value === null || value === undefined) {
        if (value === null) throw new Error("value is null");
        else throw new Error("value is undefined");
    }
    return value;
}
freeze(force);

export function isUnicodeLetter(c : string) : boolean {
    return RegExp(/^\p{L}/,'u').test(c);
}

export function isUnicodeDigit(c : string) : boolean {
    return RegExp(/^\p{N}/,'u').test(c);
}

export function groupBy<E, G>(groupOf : (elem : E) => G, elems : Iterable<E>) : [G, E[]][] {
    let groups : [G, E[]][] = [];
    let group : [G, E[]] | undefined = undefined;
    for (const e of elems) {
        const g = groupOf(e);
        if (group === undefined) {
            group = [g, [e]];
        } else {
            if (group[0] === g) {
                group[1].push(e);
            } else {
                groups.push(group);
                group = [g, [e]];
            }
        }
    }
    if (group !== undefined) groups.push(group);
    return groups;
}

export type Printer = (line : string) => void

export function timeIt<R>(label : string, op : () => R, print : Printer = debug) : R {
    const start_time = performance.now();
    const result = op();
    const end_time = performance.now();
    const duration = Math.round((end_time - start_time) * 10000) / 10000;
    print("Performed '" + label + "' in " + duration + " milliseconds.");
    return result;
}
