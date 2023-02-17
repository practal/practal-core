import { HashMap } from "../things/hash_map";
import { HashSet, HashSetHash } from "../things/hash_set";
import { combineHashes, int, nat, string } from "../things/primitives";
import { assertNever } from "../things/test";
import { Hash, mkHash } from "../things/things";
import { force, freeze } from "../things/utils";
import { Grammar, Rule } from "./cfg";

export class Item {
    rule : nat
    dot : nat
    lookahead : int

    constructor(rule : nat, dot : nat, lookahead : int) {
        this.rule = rule;
        this.dot = dot;
        this.lookahead = lookahead;
        freeze(this);
    }

    symbolAfterDot(rhs : int[]) : int {
        if (this.dot >= rhs.length) return 0;
        return rhs[this.dot];
    }

    moveDot() : Item {
        return new Item(this.rule, this.dot + 1, this.lookahead);
    }
}
freeze(Item);

function itemEqual(x : Item, y : Item) : boolean {
    return x.rule === y.rule && x.dot === y.dot && x.lookahead === y.lookahead;
}

function itemHash(x : Item) : int {
    return combineHashes([x.rule, x.dot, x.lookahead]);
}

export const ItemHash : Hash<Item> = mkHash("Item", x => x instanceof Item, itemEqual, itemHash);

export type Items = HashSet<Item>

export function nonterminalsOfGrammar(grammar : Grammar) : Set<int> {
    let symbols : Set<int> = new Set();
    symbols.add(grammar.start);
    for (const rule of grammar.rules) {
        symbols.add(rule.lhs);
        for (const e of rule.rhs) {
            if (e > 0) symbols.add(e);
        }
    }
    return symbols;
}

export function terminalsOfGrammar(grammar : Grammar) : Set<int> {
    let symbols : Set<int> = new Set();
    for (const rule of grammar.rules) {
        for (const e of rule.rhs) {
            if (e < 0) symbols.add(e);
        }
    }
    return symbols;
}

export function groupRules(grammar : Grammar) : Map<int, nat[]> {
    let grouped : Map<int, nat[]> = new Map();
    const rules = grammar.rules;
    const count = rules.length;
    for (let i = 0; i < count; i++) {
        const rule = rules[i];
        const groupedRulesIndices = grouped.get(rule.lhs);
        if (groupedRulesIndices === undefined) {
            grouped.set(rule.lhs, [i]);
        } else {
            groupedRulesIndices.push(i);
        }
    }
    return grouped;
}

export type XGrammar = {
    grammar : Grammar
    terminals : Set<int>,
    nonterminals : Set<int>,
    grouped : Map<int, nat[]>, // the rules per nonterminal, by ruleindex
    first : Map<int, Set<int>>,
    startRule : Rule
}

export function computeFirst(nonterminals : Set<int>, grammar : Grammar) : Map<int, Set<int>> {
    const F : Map<int, Set<int>> = new Map(); // maps nonterminals to FIRST sets
    for (const N of nonterminals) F.set(N, new Set());
    let changed = true;
    const rules = grammar.rules;
    while (changed) {
        changed = false;
        for (const rule of rules) {
            const first = force(F.get(rule.lhs));
            const oldSize = first.size;
            let cancelled = false;
            for (const s of rule.rhs) {
                if (s < 0) {
                    first.add(s);
                    cancelled = true;
                    break;
                } else {
                    const first_of_s = force(F.get(s));
                    for (const t of first_of_s) {
                        if (t !== 0) first.add(t);
                    }
                    if (!first_of_s.has(0)) {
                        cancelled = true;
                        break;
                    }
                }
            }
            if (!cancelled) first.add(0);
            if (first.size > oldSize) changed = true;
        }
    }
    return F;
}

export function extendGrammar(grammar : Grammar) : XGrammar {
    const nonterminals = nonterminalsOfGrammar(grammar);
    const terminals = terminalsOfGrammar(grammar);
    const grouped = groupRules(grammar);
    const first = computeFirst(nonterminals, grammar);
    const startRule = new Rule(0, [grammar.start]);
    return { grammar : grammar, nonterminals : nonterminals, terminals : terminals,
        grouped : grouped, first : first, startRule : startRule };
}

export function firstFrom(xgrammar : XGrammar, rhs : int[], lookahead : int, dot : nat) : Set<int> {
    const FIRST = xgrammar.first;
    const F : Set<int> = new Set();
    const count = rhs.length;
    for (let i = dot; i < count; i++) {
        const symbol = rhs[i];
        if (symbol < 0) {
            F.add(symbol);
            return F;
        }
        let empty = false;
        for (const t of force(FIRST.get(symbol))) {
            if (t === 0) empty = true;
            else F.add(t);
        }
        if (!empty) return F;
    }
    F.add(lookahead);
    return F;
}

export function computeClosure(xgrammar : XGrammar, items : Items) {
    let changed = true;
    const rules = xgrammar.grammar.rules;
    const grouped = xgrammar.grouped;
    while (changed) {
        changed = false;
        const oldSize = items.size;
        for (const item of items) {
            const rule = item.rule >= 0 ? rules[item.rule] : xgrammar.startRule;
            const symbol = item.symbolAfterDot(rule.rhs);
            if (symbol > 0) {
                const lookaheads = firstFrom(xgrammar, rule.rhs, item.lookahead, item.dot + 1);
                for (const r of grouped.get(symbol) ?? []) {
                    for (const lookahead of lookaheads) {
                        const item = new Item(r, 0, lookahead);
                        items.insert(item);
                    }
                }
            }
        }
        if (items.size > oldSize) changed = true;
    }
}

export function computeGoto(xgrammar : XGrammar, items : Items, symbol : int) : Items {
    const result : Items = new HashSet(ItemHash);
    const rules = xgrammar.grammar.rules;
    for (const item of items) {
        const rule = item.rule >= 0 ? rules[item.rule] : xgrammar.startRule;
        if (item.symbolAfterDot(rule.rhs) === symbol) {
            result.insert(item.moveDot());
        }
    }
    computeClosure(xgrammar, result);
    return result;
}

function gotoSymbols(xgrammar : XGrammar, items : Items) : Set<int> {
    const symbols : Set<int> = new Set();
    const rules = xgrammar.grammar.rules;
    for (const item of items) {
        const rule = item.rule >= 0 ? rules[item.rule] : xgrammar.startRule;
        const symbol = item.symbolAfterDot(rule.rhs);
        if (symbol !== 0) symbols.add(symbol);
    }
    return symbols;
}

export type LR1Graph = { states : Items[], symbols : int[], graph : Map<nat, Map<int, nat>> }

export function computeLR1Graph(xgrammar : XGrammar) : LR1Graph
{
    const initialItem = new Item(-1, 0, 0);
    const initialState : Items = HashSet.make(ItemHash, initialItem);
    computeClosure(xgrammar, initialState);
    const statesIndex : HashMap<Items, nat> = new HashMap(HashSetHash);
    statesIndex.put(initialState, 0);
    const states : Items[] = [initialState];
    const graph : Map<nat, Map<int, nat>> = new Map();
    const symbolOfTarget : Map<nat, int> = new Map();
    symbolOfTarget.set(0, 0);
    function connect(source : nat, symbol : int, target : nat) {
        let targets = graph.get(source);
        if (targets === undefined) {
            targets = new Map();
            targets.set(symbol, target);
            symbolOfTarget.set(target, symbol);
            graph.set(source, targets);
        } else {
            targets.set(symbol, target);
            symbolOfTarget.set(target, symbol); // todo
        }
    }
    const queue : nat[] = [0];
    while (queue.length > 0) {
        const stateIndex = force(queue.pop());
        const state = states[stateIndex];
        const symbols = gotoSymbols(xgrammar, state);
        for (const symbol of symbols) {
            const targetState = computeGoto(xgrammar, state, symbol);
            const targetIndex = statesIndex.putIfNew(targetState, () => states.length);
            if (targetIndex >= states.length) {
                states.push(targetState);
                queue.push(targetIndex);
            }
            connect(stateIndex, symbol, targetIndex);
        }
    }  
    const symbols : int[] = [];
    for (let s = 0; s < symbolOfTarget.size; s++) {
        symbols.push(force(symbolOfTarget.get(s)));
    }
    return { states : states, symbols : symbols, graph : graph };
}

export enum ActionKind {
    SHIFT,
    REDUCE,
    ACCEPT
}
freeze(ActionKind);

export type Shift = {
    kind : ActionKind.SHIFT,
    state : nat
}

export type Reduce = {
    kind : ActionKind.REDUCE,
    rule : nat
}

export type Accept = {
    kind : ActionKind.ACCEPT
}

export type Action = Shift | Reduce | Accept

const ActionHashSeed = string.hash("Action");

function isAction(action : any) : boolean {
    const kind = action.kind;
    switch (kind) {
        case ActionKind.SHIFT: return nat.is(action.state);
        case ActionKind.REDUCE: return nat.is(action.rule);
        case ActionKind.ACCEPT: return true;
        default: return false;
    }
}

function hashAction(action : Action) : int {
    const kind = action.kind;
    switch (kind) {
        case ActionKind.SHIFT: 
            return combineHashes([ActionHashSeed, kind, action.state]);
        case ActionKind.REDUCE:
            return combineHashes([ActionHashSeed, kind, action.rule]);
        case ActionKind.ACCEPT:
            return combineHashes([ActionHashSeed, kind]);
        default: assertNever(kind);
    }
}

function equalAction(x : Action, y : Action) : boolean {
    const kind = x.kind;
    if (kind !== y.kind) return false;
    switch (kind) {
        case ActionKind.SHIFT: return x.state === (y as Shift).state;
        case ActionKind.REDUCE: return x.rule === (y as Reduce).rule;
        case ActionKind.ACCEPT: return true;
        default: assertNever(kind);
    }
}

export const Action = mkHash("Action", isAction, equalAction, hashAction);

export type Actions = Map<int, HashSet<Action>>

export function computeActionsOfState(xgrammar : XGrammar, lr1 : LR1Graph, stateIndex : nat) : Actions {
    const actions : Actions = new Map();
    function add(symbol : int, action : Action) {
        const actionsOfSymbol = actions.get(symbol);
        if (actionsOfSymbol === undefined) {
            actions.set(symbol, HashSet.make(Action, action));
        } else {
            actionsOfSymbol.insert(action);
        }
    }
    const goto = lr1.graph.get(stateIndex) ?? new Map<int, nat>();
    const rules = xgrammar.grammar.rules;
    const state = lr1.states[stateIndex];
    for (const item of state) {
        if (item.rule < 0) {
            if (item.dot === 1) add(0, { kind : ActionKind.ACCEPT });
            continue;
        } 
        const rhs = rules[item.rule].rhs;
        const symbol = item.symbolAfterDot(rhs);
        if (symbol === 0) add(item.lookahead, { kind : ActionKind.REDUCE, rule : item.rule });
        else if (symbol < 0) {
            const index = force(goto.get(symbol));
            add(symbol, { kind : ActionKind.SHIFT, state : index });
        }
    }
    return actions;
}

export function filterConflictingActions(actions : Actions) : Actions {
    const conflicts : Actions = new Map();
    for (const [symbol, actionsOfSymbol] of actions) {
        if (actionsOfSymbol.size > 1) conflicts.set(symbol, actionsOfSymbol);
    }
    return conflicts;
}

export function isAccepting(actions : Actions) : boolean {
    for (const [symbol, actionsOfSymbol] of actions) {
        for (const action of actionsOfSymbol) {
            if (action.kind === ActionKind.ACCEPT) return true;
        }
    }
    return false;
}

export function nextTerminalsOf(actions : Actions) : Set<int> {
    const terminals : Set<int> = new Set();
    for (const [symbol, actionsOfSymbol] of actions) {
        for (const action of actionsOfSymbol) {
            terminals.add(symbol);
            break;
        }
    }
    return terminals;
}

