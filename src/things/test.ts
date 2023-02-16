import { debug } from "./debug";
import { nat } from "./primitives";
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

export type Test = () => boolean

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

export function assert(test : Test, descr? : string) {
    if (tests_are_enabled) {
        const pos = sourcePosition(2);
        tests.push([pos, descr, test]);
    } else {
        missed += 1;
    }
}
freeze(assert);

export function runTests() {
    debug("There are " + tests.length + " tests to run.");
    debug("------------------------------------------------");
    let succeeded = 0;
    let failed = 0;
    let crashed = 0;
    for (const t of tests) {
        const [pos, descr, test] = t;
        try {
            if (test()) {
                succeeded += 1;
            } else {
                failed += 1;
                const name = descr ? "'" + descr + "' " : "";
                debug("Assertion "+name+"failed at '" + pos + "'.");
            }
        } catch {
            crashed += 1;
            const name = descr ? "'" + descr + "' " : "";
            debug("Assertion " + name + "crashed at '" + pos + "'.");
        }
    }
    debug("------------------------------------------------");
    if (crashed === 0 && failed === 0 && succeeded === tests.length) {
        debug("All " + succeeded + " tests concluded successfully.");
    } else {
        if (crashed > 0) debug("There were " + crashed + " crashes.");
        if (failed > 0) debug("There were " + failed + " failed assertions.");
        if (succeeded > 0) debug("Out of " + tests.length + " tests, " + succeeded + " succeeded.");
    }
    if (missed > 0) debug("!!! Because tests were disabled, " + missed + " assertions have been missed.");
    debug("");
}
freeze(runTests);
