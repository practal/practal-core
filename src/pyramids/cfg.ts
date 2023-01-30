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

