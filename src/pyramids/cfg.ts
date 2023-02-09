import { debug } from "../things/debug";
import { int, nat  } from "../things/primitives";
import { freeze } from "../things/utils";
import { GrammarSymbols } from "./grammar_symbols";

// Nonterminals are > 0, Terminals are < 0, end of input is 0.
export class Rule {
    lhs : nat
    rhs : int[]
    constructor (lhs : nat, rhs : int[]) {
        this.lhs = lhs;
        this.rhs = rhs;
        freeze(this.rhs);
        freeze(this);
    }
    asString(symbols : GrammarSymbols) : string {
        let s = "" + symbols.symsOf(this.lhs)?.join(",");
        s += " =>";
        for (const r of this.rhs) {
            s += " " + symbols.symsOf(r)?.join(",");
        }
        return s;
    }
} 
freeze(Rule);

/** Nonterminals are > 0, terminals are < 0, 0 is the end of the input. */
export class Grammar {
    start : nat
    rules : Rule[] 
    
    constructor (start : nat, rules : Rule[]) {
        this.start = start;
        this.rules = rules;
        freeze(this);
    }

}
freeze(Grammar);

export function computeProductiveNonterminals(rules : (Rule | null)[]) : Set<nat> {
    let result : Set<nat> = new Set();
    for (const rule of rules) {
        if (rule !== null) result.add(rule.lhs);
    }
    return result;
}

export function removeUnproductiveNonterminals(rules : Rule[]) : Rule[] {
    let productiveRules : (Rule | null)[] = [...rules];
    const N = productiveRules.length;
    
    function remove() : boolean {
        let removed = false;
        const productiveNonterminals = computeProductiveNonterminals(productiveRules);
        for (let i = 0; i < N; i++) {
            const rule = productiveRules[i];
            if (rule === null) continue;
            for (const s of rule.rhs) {
                if (s > 0 && !productiveNonterminals.has(s)) {
                    removed = true;
                    productiveRules[i] = null;
                    break;
                }
            }
        }
        return removed;
    }

    while (remove());

    const result = productiveRules.filter(r => r !== null) as Rule[];

    if (rules.length !== result.length) {
        debug("Removed " + (rules.length - result.length) + " rules!");
    }

    return result;
}

