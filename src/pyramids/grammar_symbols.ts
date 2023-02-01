import { ArrayHash } from "../things/array";
import { HashMap } from "../things/hash_map";
import { int, nat, string } from "../things/primitives";
import { force, freeze } from "../things/utils";

/** Nonterminals start with an uppercase letter, everything else is a terminal. */
export type Sym = string

export function isNonterminal(sym : Sym) : boolean {
    if (sym.length === 0) return false;
    const c = sym.charAt(0);
    return c >= "A" && c <= "Z"; 
}

export function isTerminal(sym : Sym) : boolean {
    return !isNonterminal(sym) && !(sym.indexOf(",") >= 0);
}

export class GrammarSymbols {
    #terminals : Sym[][]
    #handles : HashMap<Sym[], int>
    #nonterminals : Sym[]
    #distinct : Set<int>[]
    #empty : Map<int, int>
    #final : Set<int>
    constructor() {
        this.#terminals = [];
        this.#nonterminals = [];
        this.#handles = new HashMap(ArrayHash(string));
        this.#distinct = [];
        this.#empty = new Map();
        this.#final = new Set();
    }
    handleOf(syms : Sym[]) : int | undefined {
        return this.#handles.get(syms);
    }
    symsOf(handle : int) : Sym[] | undefined {
        if (handle > 0 && handle - 1 < this.#nonterminals.length) 
            return [this.#nonterminals[handle - 1]];
        if (handle < 0 && -handle - 1 < this.#terminals.length) 
            return this.#terminals[-handle - 1];
        return undefined;
    }  
    handlesOf(handle : int) : int[] | undefined {
        if (handle === 0) return [0];
        const syms = this.symsOf(handle);
        if (syms === undefined) return undefined;
        return syms.map(s => force(this.handleOf([s])));
    }
    symOf(handle : int) : string | undefined {
        return this.symsOf(handle)?.join(",");
    }
    ensure(syms : Sym[]) : int {
        const handle = this.handleOf(syms)
        if (handle !== undefined) return handle;
        if (syms.length === 1 && isNonterminal(syms[0])) {
            const handle = this.#nonterminals.length + 1;
            return this.#handles.putIfNew(syms, () => {
                const handle = this.#nonterminals.length + 1;
                this.#nonterminals.push(syms[0]);
                return handle;
            });    
        } else {
            for (const sym of syms) {
                if (!isTerminal(sym)) throw new Error("Terminals expected, found: " + sym);
            }
            if (syms.length > 1) {
                for (const sym of syms) {
                    this.#handles.putIfNew([sym], () => {
                        const handle = -(this.#terminals.length + 1);
                        this.#terminals.push([sym]);
                        return handle;
                    });
                }
            }
            return this.#handles.putIfNew(syms, () => {
                const handle = -(this.#terminals.length + 1);
                this.#terminals.push(syms);
                return handle;
            });
        }
    }
    // All distinct handles are assumed to be non-empty!
    declare_distinct(distinct_handles : Iterable<int>) {
        const D : Set<int> = new Set();
        D.add(0);
        for (const handle of distinct_handles) {
            if (handle > 0 || (handle < 0 && this.symsOf(handle) === undefined)) throw new Error("Not a terminal handle: " + handle);
            D.add(handle);
        }
        this.#distinct.push(D);
    }
    // All distinct handles are assumed to be non-empty!
    declare_distinct_symbols(symbols : Iterable<Sym>) {
        const self = this
        function* handles() : Generator<int> {
            for (const sym of symbols) {
                const handle = self.handleOf([sym]);
                if (handle === undefined || handle > 0) throw new Error("Not a terminal symbol: " + sym);
                yield handle;
            }
        }
        this.declare_distinct(handles());
    }
    declare_empty(possibly_empty : Sym, nonempty_version : Sym) {
        const empty = force(this.handleOf([possibly_empty]));
        const nonempty = force(this.handleOf([nonempty_version]));
        if (this.#empty.has(empty)) throw new Error("Terminal '"+possibly_empty+"'is already declared as possibly empty.");
        this.#empty.set(empty, nonempty);
    }
    declare_final(f : Sym) {
        const h = force(this.handleOf([f]));
        this.#final.add(h);
    }
    nonemptyVersionOf(possibly_empty : int) : int | undefined {
        return this.#empty.get(possibly_empty);
    }
    // Means that these two terminals cannot be parsed at the same position, ever
    distinct(terminal1 : int, terminal2 : int) : boolean {
        if (terminal1 === terminal2) return false;
        for (const D of this.#distinct) {
            if (D.has(terminal1) && D.has(terminal2)) {
                return true;
            }
        }
        return false;
    }
    is_final(h : int) : boolean {
        return h === 0 || this.#final.has(h);
    }
}
freeze(GrammarSymbols);