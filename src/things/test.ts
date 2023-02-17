import { debug } from "./debug";
import { nat, sameValueZero } from "./primitives";
import { freeze } from "./utils";

/**
 * `up` is how far up we look the stack trace; 0 is sourcePosition itself.
 */
export function sourcePosition(up : nat = 1) : string | undefined {
    try {
        throw new Error()
    } catch (err) {
        const s = String((err as Error).stack);
        let p = s.indexOf("\n");
        for (let i = 0; i < up; i++) {
            if (p < 0) return undefined;
            p = s.indexOf("\n", p + 1);
        }
        if (p < 0) return undefined;
        p = s.indexOf("at ", p + 1);
        if (p < 0) return undefined;
        let q = s.indexOf("\n", p);
        if (q < 0) q = s.length;
        return s.slice(p + 3, q);
    }
}
freeze(sourcePosition);

export type Test = () => void

class AssertionFailed {

    message : string | undefined;

    constructor(message? : string) {
        this.message = message;
        freeze(this);
    }

    toString() : string {
        if (this.message) {
            return "Assertion failed: " + this.message + ".";
        } else {
            return "Assertion failed."
        }
    }

}
freeze(AssertionFailed);

let tests : [string | undefined, string | undefined, Test][] = [];
let missed = 0;

let tests_are_enabled = false;

export function enableTests() {
    tests_are_enabled = true;
}
freeze(enableTests);

export function disableTests() {
    tests_are_enabled = false;
}
freeze(disableTests);

export function Test(test : Test, descr? : string) {
    if (tests_are_enabled) {
        const pos = sourcePosition(2);
        tests.push([pos, descr, test]);
    } else {
        missed += 1;
    }
}
freeze(Test);

export function assertTrue(condition : any) : asserts condition is true {
    if (condition !== true) throw new AssertionFailed();
}

export function assertFalse(condition : boolean) : asserts condition is false  {
    if (condition !== false) throw new AssertionFailed();
}

export function assertNever(value : never) : never {
    throw new AssertionFailed("unexpected value '" + value + "'");
}

export function assertIsDefined<T>(value : T) : asserts value is NonNullable<T> {
    if (value === undefined || value === null) throw new AssertionFailed("undefined value");
}

export function assertIsUndefined(value : any) : asserts value is undefined | null {
    if (value !== undefined && value !== null) throw new AssertionFailed("value is defined as '" + value + "'");
}

export function assertEq<E>(...values : E[]) {
    for (let i = 1; i < values.length; i++) {
        if(!sameValueZero.equal(values[i - 1], values[i])) throw new AssertionFailed(`values '${values[i - 1]}' and '${values[i]}' are not equal`);
    }
} 

export function runTests() {
    debug("There are " + tests.length + " tests to run.");
    debug("------------------------------------------------");
    let succeeded = 0;
    let failed = 0;
    let crashed = 0;
    for (const t of tests) {
        const [pos, descr, test] = t;
        try {
            test();
            succeeded += 1;
        } catch(error) {
            if (error instanceof AssertionFailed) {
                failed += 1;
                const name = descr ? "'" + descr + "' " : "";
                if (error.message)
                    debug("Test "+name+"failed at '" + pos + "': " + error.message + ".");
                else 
                    debug("Test "+name+"failed at '" + pos + "'.");
            } else {                    
                crashed += 1;
                const name = descr ? "'" + descr + "' " : "";
                debug("Test " + name + "crashed at '" + pos + "'.");
            }
        }
    }
    debug("------------------------------------------------");
    if (crashed === 0 && failed === 0 && succeeded === tests.length) {
        debug("All " + succeeded + " tests concluded successfully.");
    } else {
        if (crashed > 0) debug("There were " + crashed + " crashes.");
        if (failed > 0) debug("There were " + failed + " failed tests.");
        if (succeeded > 0) debug("Out of " + tests.length + " tests, " + succeeded + " succeeded.");
    }
    if (missed > 0) debug("!!! Because tests were disabled then, " + missed + " tests have been missed.");
    debug("");
}
freeze(runTests);
