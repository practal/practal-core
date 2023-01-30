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

function cool() {
    const s = sourcePosition();
    console.log("source position: " + s);
}

cool();

console.log("compare = " + (Number.NaN === Number.NaN));