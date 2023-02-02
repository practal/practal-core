import { int, nat } from "../things/primitives";
import { assertNever, force, internalError, notImplemented } from "../things/utils";
import { DetParser, DPResult, endLineOf, endOf, eofDP, Result, ResultKind, startLineOf, Tree } from "./deterministic_parser";
import { TextLines } from "./textlines";
import { ActionPlan, ActionPlanKind, planActions, planContainsError, printActionPlan, printActions } from "./actionplan";
import { convertExprGrammar, ExprGrammar } from "./expr_grammar";
import { Sym } from "./grammar_symbols";
import { Action, ActionKind, computeActionsOfState, computeLR1Graph, extendGrammar, nextTerminalsOf } from "./lr";
import { SectionDataNone, SectionName } from "../practalium_parser";
import { debug } from "../things/debug";

export type TerminalParsers<State, S, T> = 
    (terminals : Set<Sym | null>) => 
    (state : State, lines : TextLines, line : number, offset : number) => 
    { sym : Sym | null, state : State, result : Result<S, T> }[];

export function mkTerminalParsers<State, S, T>(parsers : [Sym, DetParser<State, S, T>][]) : TerminalParsers<State, S, T> {
    const parserOfSym : Map<Sym, DetParser<State, S, T>> = new Map();
    for (const [sym, p] of parsers) parserOfSym.set(sym, p);
    if (parserOfSym.size !== parsers.length) throw new Error("Multiple parsers for same symbol found.");

    const eof : DetParser<State, S, T> = eofDP();

    return (terminals : Set<Sym | null>) => {
        const filtered_parsers : [string | null, DetParser<State, S, T>][]= parsers.filter(p => terminals.has(p[0]));
        if (terminals.has(null)) filtered_parsers.push([null, eof]);
        function parse(state : State, lines : TextLines, line : number, offset : number) : { sym : Sym | null, state : State, result : Result<S, T> }[] {
            for (const [t, parser] of filtered_parsers) {
                const r = parser(state, lines, line, offset);
                if (r === undefined) continue;
                return [{sym : t, state : r.state, result : r.result}];
            }
            return [];
        }
        return parse;
    }
} 

export function orTerminalParsers<State, S, T>(parsers : TerminalParsers<State, S, T>[]) : TerminalParsers<State, S, T> {

    return (terminals : Set<Sym | null>) => {
        const specific_parsers = parsers.map(p => p(terminals));
        function parse(state : State, lines : TextLines, line : number, offset : number) : { sym : Sym | null, state : State, result : Result<S, T> }[] {
            let results : { sym : Sym | null, state : State, result : Result<S, T> }[] = [];
            for (const parser of specific_parsers) {
                results.push(...parser(state, lines, line, offset));
            }
            return results;
        }
        return parse;
    }

}

export function orGreedyTerminalParsers<State, S, T>(parsers : TerminalParsers<State, S, T>[]) : TerminalParsers<State, S, T> {

    return (terminals : Set<Sym | null>) => {
        const specific_parsers = parsers.map(p => p(terminals));
        function parse(state : State, lines : TextLines, line : number, offset : number) : { sym : Sym | null, state : State, result : Result<S, T> }[] {
            for (const parser of specific_parsers) {
                const results = parser(state, lines, line, offset);
                if (results.length > 0) return results;
            }
            return [];
        }
        return parse;
    }

}

export function lrDP<State, S, T>(exprGrammar : ExprGrammar, nonterminal_labels : [Sym, S][], terminal_parsers : TerminalParsers<State, S, T>, invalid? : S | null) : 
    { parser : DetParser<State, S, T>, conflicts : Set<Sym | null> } 
{
    const G = convertExprGrammar(exprGrammar);
    const X = extendGrammar(G.grammar);
    const lr1 = computeLR1Graph(X);
    /*for (let i = 0; i < G.grammar.rules.length; i++) {
        const rule = G.grammar.rules[i];
        console.log("Rule " + i + ") " + rule.asString(G.symbols));
    }*/
    //console.log("Number of states is " + lr1.states.length + ".");
    //let withConflicts = 0
    const nextTerminals : Set<int>[] = [];
    for (let i = 0; i < lr1.states.length; i++) {
        const actions = computeActionsOfState(X, lr1, i);
        const terminals = nextTerminalsOf(actions);
        nextTerminals.push(terminals);
    }
    const plans : ActionPlan[] = [];
    const symbolsWithConflicts : Set<Sym | null> = new Set();
    for (let i = 0; i < lr1.states.length; i++) {
        const actions = computeActionsOfState(X, lr1, i);
        const plan = planActions(G.symbols, nextTerminals, actions);
        if (planContainsError(plan)) {
            //withConflicts += 1;
            //symbolsWithConflicts.add(lr1.symbols[i]);
            const sym = G.symbols.symOf(lr1.symbols[i]);
            symbolsWithConflicts.add(sym ?? null);
            /*console.log("Found conflicts in state " + i + ", belonging to " + sym);
            console.log("Actions = ");
            printActions(G.symbols, nextTerminals, actions, s => console.log("    " + s));
            console.log("Plan = ");
            printActionPlan(G.symbols, plan, s => console.log("    " + s));*/
        }
        plans.push(plan);
    }  




    //if (withConflicts > 0) throw new Error("Found " + withConflicts + " states with errors out of " + lr1.states.length + " states.");

    const rules = G.grammar.rules;

    function goto(lr_state : nat, nonterminal : int) : nat | undefined {
        const edges = lr1.graph.get(lr_state);
        if (edges === undefined) return undefined;
        return edges.get(nonterminal);
    }

    function executePlan(state : State, lines : TextLines, line : number, offset : number, plan : ActionPlan) : [Result<S, T>[], State, Action] | undefined {
        let tokens : Result<S, T>[] = [];
        let states : State[] = [state];
        let munch = 0;
        function execute(plan : ActionPlan) : Action | undefined {
            const kind = plan.kind;
            switch (kind) {
                case ActionPlanKind.ERROR: return undefined;
                case ActionPlanKind.ACCEPT: return { kind: ActionKind.ACCEPT };
                case ActionPlanKind.REDUCE: return { kind: ActionKind.REDUCE, rule: plan.rule };
                case ActionPlanKind.SHIFT: {
                    munch = plan.munch;
                    return { kind : ActionKind.SHIFT, state : plan.state };
                }
                case ActionPlanKind.READ: {
                    const terminal_symbols : Set<Sym | null> = new Set();
                    for (const option of plan.options) {
                        for (const terminal of option[0]) {
                            if (terminal === 0) terminal_symbols.add(null);
                            else {
                                const syms = G.symbols.symsOf(terminal);
                                if (syms === undefined || syms.length !== 1) throw new Error("Invalid terminal handle " + terminal + ".");
                                terminal_symbols.add(syms[0]);
                            }
                        }
                    }
                    const results = terminal_parsers(terminal_symbols)(state, lines, line, offset);
                    if (results.length !== 1) {
                        //const lo = "line " + line + ", offset " + offset;
                        //console.log("Could not READ (" + lo + "): " + [...terminal_symbols].join(" | "));
                        return undefined;
                    } 
                    const {sym, state: new_state, result} = results[0];
                    //console.log("READ " + sym);
                    [line, offset] = endOf(result);
                    const sym_handle = force(sym === null ? 0 : G.symbols.handleOf([sym]));
                    for (const option of plan.options) {
                        if (option[0].has(sym_handle)) {
                            state = new_state;
                            states.push(new_state);
                            tokens.push(result);
                            return execute(option[1]);
                        }
                    }
                    internalError();
                }
                default: assertNever(kind);
            }
        }
        const action = execute(plan);
        if (action === undefined) return undefined;
        tokens = tokens.slice(0, munch);
        return [tokens, states[munch], action];
    }

    const nonterminals : Map<Sym, S> = new Map();
    for (const [sym, n] of nonterminal_labels) {
        nonterminals.set(sym, n);
    }

    function parse(state : State, lines : TextLines, line : number, offset : number) : DPResult<State, S, T> {
        const startLine = line;
        const startOffset = offset;
        const lr_states : int[] = [0];
        const results : Result<S, T>[] = [];
        function failed() : DPResult<State, S, T> {
            if (invalid === undefined) return undefined;
            const tree : Tree<S, T> = {
                kind: ResultKind.TREE,
                type: invalid,
                startLine: startLine,
                startOffsetInclusive: startOffset,
                endLine: line,
                endOffsetExclusive: offset,
                children: results
            };            
            return { state : state, result : tree };
        }
        while (true) {
            const lr_state = lr_states[lr_states.length - 1];
            const plan = plans[lr_state];
            const executionResult = executePlan(state, lines, line, offset, plan);
            if (executionResult === undefined) {
                /*debug("executionResult is undefined");
                debug("----------------------------");
                printActionPlan(G.symbols, plan);*/
                return failed();
            }
            const [tokens, new_state, action] = executionResult;
            state = new_state;
            const kind = action.kind;
            switch (kind) {
                case ActionKind.ACCEPT:
                    //console.log("ACCEPT");
                    if (results.length === 1) {
                        return { state : state, result : results[0] };
                    } else {
                        internalError("Unexpected result stack containing " + results.length + " results.");
                    }
                case ActionKind.REDUCE: {
                    //console.log("REDUCE " + action.rule);
                    const rule = rules[action.rule];
                    const L = rule.rhs.length;
                    if (lr_states.length > L) {
                        const top = lr_states[lr_states.length - L - 1];
                        const goto_lr_state = goto(top, rule.lhs);
                        if (goto_lr_state === undefined) return failed();
                        const rhs = results.splice(results.length - L, L);
                        const nonterminal = G.symbols.symsOf(rule.lhs);
                        if (nonterminal === undefined || nonterminal.length !== 1) {
                            internalError("Could not resolve handle to nonterminal.");
                        }
                        const s = nonterminals.get(nonterminal[0]) ?? null;
                        let startLine = line;
                        let startOffsetInclusive = offset;
                        let endLine = line;
                        let endOffsetExclusive = offset;
                        if (rhs.length > 0) {
                            startLine = startLineOf(rhs[0]);
                            startOffsetInclusive = rhs[0].startOffsetInclusive;
                            [endLine, endOffsetExclusive] = endOf(rhs[rhs.length - 1]);
                        }
                        //if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(endOffsetExclusive)) throw new Error("!!");
                        const tree : Tree<S, T> = {
                            kind: ResultKind.TREE,
                            type: s,
                            startLine: startLine,
                            startOffsetInclusive: startOffsetInclusive,
                            endLine: endLine,
                            endOffsetExclusive: endOffsetExclusive,
                            children: rhs
                        };
                        results.push(tree);
                        lr_states.splice(lr_states.length - L, L, goto_lr_state);
                        //console.log("GOTO " + goto_lr_state);
                    } else {
                        internalError("Stack is not large enough for reduction.");
                    }
                    break;
                }
                case ActionKind.SHIFT: {
                    //console.log("SHIFT " + action.state);
                    lr_states.push(action.state);
                    if (tokens.length === 1) {
                        results.push(tokens[0]);
                        [line, offset] = endOf(tokens[0]);
                    } else {
                        let endLine = line;
                        let endOffsetExclusive = offset;
                        if (tokens.length > 0) {
                            [endLine, endOffsetExclusive] = endOf(tokens[tokens.length - 1]);
                        }
                        //if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(endOffsetExclusive)) throw new Error("!!");
                        const tree : Tree<S, T> = {
                            kind: ResultKind.TREE,
                            type: null,
                            startLine: line,
                            startOffsetInclusive: offset,
                            endLine: endLine,
                            endOffsetExclusive: endOffsetExclusive,
                            children: tokens
                        };   
                        results.push(tree);     
                        line = endLine;
                        offset = endOffsetExclusive;                
                    }
                    break;
                }
                default: assertNever(kind);
            }
        }
    }

    return { parser : parse, conflicts : symbolsWithConflicts };
}