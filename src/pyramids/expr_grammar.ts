import { debug } from "../things/debug";
import { int } from "../things/primitives";
import { assertNever, freeze, groupBy, Printer } from "../things/utils";
import { Grammar, removeUnproductiveNonterminals, Rule} from "./cfg";
import { GrammarSymbols, isTerminal, Sym } from "./grammar_symbols";

export const enum ExprKind {
    SEQ,
    OR,
    OPT,
    STAR,
    PLUS
}

export type Expr = Sym | { kind : ExprKind, params : Expr[] }

export type ExprGrammar = { start : Sym, rules : { lhs : Sym, rhs : Expr }[], distinct? : Sym[][], empty? : [Sym, Sym][], final? : Sym[] }

export function cloneExpr(expr : Expr) : Expr {
    if (typeof expr === "string") return expr;
    return { kind : expr.kind, params : expr.params.map(cloneExpr) };
}
freeze(cloneExpr);

export function cloneExprGrammar(grammar : ExprGrammar) : ExprGrammar {
    const rules = grammar.rules.map(r => { return { lhs: r.lhs, rhs: cloneExpr(r.rhs) }; });
    const result : ExprGrammar = { start : grammar.start, rules : rules };
    if (grammar.distinct !== undefined) {
        result.distinct = grammar.distinct.map(syms => [...syms]);
    }
    if (grammar.empty !== undefined) {
        result.empty = grammar.empty.map(syms => [...syms]);
    }
    if (grammar.final !== undefined) {
        result.final = [...grammar.final];
    }
    return result;
}
freeze(cloneExprGrammar);

export function rule(lhs : Sym, ...rhs : Expr[]) : { lhs : Sym, rhs : Expr } {
    return { lhs : lhs, rhs : { kind : ExprKind.SEQ, params : rhs }};
}
freeze(rule);

export function seq(...exprs : Expr[]) : Expr {
    return { kind : ExprKind.SEQ, params : flattenSEQ(exprs) };
}
freeze(seq);

export function or(...exprs : Expr[]) : Expr {
    return { kind : ExprKind.OR, params : flattenOR(exprs) };
}
freeze(or);

export function opt(...exprs : Expr[]) : Expr {
    return { kind : ExprKind.OPT, params : exprs };
}
freeze(opt);

export function star(...exprs : Expr[]) : Expr {
    return { kind : ExprKind.STAR, params : exprs };
}
freeze(star);

export function plus(...exprs : Expr[]) : Expr {
    return { kind : ExprKind.PLUS, params : exprs };
}
freeze(plus);

function flattenSEQ(exprs : Expr[]) : Expr[] {
    let result : Expr[] = [];
    for (const e of exprs) {
        if (typeof e !== "string" && e.kind === ExprKind.SEQ) 
            result.push(...flattenSEQ(e.params));
        else
            result.push(e);
    }
    return result;
}

function flattenOR(exprs : Expr[]) : Expr[] {
    let result : Expr[] = [];
    for (const e of exprs) {
        if (typeof e !== "string" && e.kind === ExprKind.OR) 
            result.push(...flattenOR(e.params));
        else
            result.push(e);
    }
    return result;
}

export function printExpr(expr : Expr) : string {
    if (typeof expr === "string") return expr;
    const kind = expr.kind;
    function seq(exprs : Expr[]) : string {
        if (exprs.length === 0) return "ε";
        return exprs.map(printExpr).join("; ");
    }
    function brackets(s : string) : string {
        if (s.indexOf(" ") >= 0) 
            return "(" + s + ")";
        else 
            return s;
    }
    switch (kind) {
        case ExprKind.SEQ: return seq(expr.params);
        case ExprKind.OPT: return brackets(seq(expr.params)) + "?";
        case ExprKind.STAR: return brackets(seq(expr.params)) + "*";
        case ExprKind.PLUS: return brackets(seq(expr.params)) + "+";
        case ExprKind.OR: 
            if (expr.params.length === 0) return "∅";
            else return expr.params.map(printExpr).join(" | ");
        default: assertNever(kind);
    }
}


export function convertExprGrammar(
    exprGrammar : ExprGrammar, 
    prefix_nonterminals : string = "N@-") : { symbols : GrammarSymbols, grammar : Grammar } 
{
    let symbols : GrammarSymbols = new GrammarSymbols();
    let nonterminal_index = 0;
    let rules : Rule[] = [];

    function freshNonterminal() : Sym {
        const N = prefix_nonterminals + (nonterminal_index++);
        if (symbols.handleOf([N]) !== undefined) throw new Error("Nonterminal is not fresh, change prefix.");
        return N;
    }

    function addRule(lhs : Sym, ...rhs : Sym[]) {
        const lhs_handle = symbols.ensure([lhs]);
        const groupedSymbols = groupBy(sym => isTerminal(sym), rhs)
        let handles : int[] = [];
        for (const [is_terminal, syms] of groupedSymbols) {
            if (is_terminal) handles.push(symbols.ensure(syms));
            else {
                for (const sym of syms) {
                    handles.push(symbols.ensure([sym]));
                }
            }
        }
        rules.push(new Rule(lhs_handle, handles));
    }

    function mkSym(expr : Expr) : Sym {
        if (typeof expr === "string") return expr;
        if (expr.kind === ExprKind.SEQ || expr.kind === ExprKind.OR) {
            if (expr.params.length === 1) return mkSym(expr.params[0]);
        }
        const N = freshNonterminal();
        mkRules(N, expr);
        return N;
    }

    function mkRules(lhs : Sym, expr : Expr) {
        if (typeof expr === "string") {
            //debug("!!! " + lhs + " => " + printExpr(expr));
            addRule(lhs, expr);
            return;
        }
        const kind = expr.kind;
        const params = expr.params;
        switch (kind) {
            case ExprKind.SEQ: mkSeq(lhs, params); break;
            case ExprKind.OPT: mkOpt(lhs, params); break;
            case ExprKind.OR: mkOr(lhs, params); break;
            case ExprKind.STAR: mkStar(lhs, params); break;
            case ExprKind.PLUS: mkPlus(lhs, params); break;
            default: assertNever(kind);
        }
    }

    function mkOpt(lhs : Sym, exprs : Expr[]) {
        const expr = seq(...exprs);
        const sym = mkSym(expr);
        addRule(lhs, sym);
        addRule(lhs);
    }

    function mkOr(lhs : Sym, exprs : Expr[]) {
        for (const e of exprs) {
            //debug("mkOr for " + lhs + " => " + printExpr(e));
            mkRules(lhs, e);
        }
    }

    function mkStar(lhs : Sym, exprs : Expr[]) {
        const expr = seq(...exprs);
        const sym = mkSym(expr);
        const N = freshNonterminal();
        addRule(N);
        addRule(N, sym, N);
        addRule(lhs, N);
    }

    function mkPlus(lhs : Sym, exprs : Expr[]) {
        const expr = seq(...exprs);
        const sym = mkSym(expr);
        const N = freshNonterminal();
        addRule(N, sym);
        addRule(N, sym, N);
        addRule(lhs, N);
    }

    function mkSeq(lhs : Sym, exprs : Expr[]) {
        if (exprs.length === 0) {
            addRule(lhs);
            return;
        }
        if (exprs.length === 1) {
            mkRules(lhs, exprs[0]);
            return;
        }
        let rhs : Sym[] = [];
        for (const e of exprs) {
            rhs.push(mkSym(e));
        }
        addRule(lhs, ...rhs);
    }

    for (const rule of exprGrammar.rules) {
        mkRules(rule.lhs, rule.rhs);
    }
    const start = symbols.ensure([exprGrammar.start]);

    for (const D of exprGrammar.distinct ?? []) 
        symbols.declare_distinct_symbols(D);

    for (const [e, n] of exprGrammar.empty ?? []) {
        symbols.declare_empty(e, n);
    }

    for (const f of exprGrammar.final ?? []) {
        symbols.declare_final(f);
    }
    //const processed_rules = removeUnproductiveNonterminals(rules);
    const processed_rules = rules;
    return { symbols : symbols, grammar : new Grammar(start, processed_rules) };
}
freeze(convertExprGrammar);

