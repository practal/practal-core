import { debug } from "../things/debug";
import { Digraph, weaklyConnectedComponents } from "../things/digraph";
import { int, nat } from "../things/primitives";
import { assertNever } from "../things/test";
import { force, freeze } from "../things/utils";
import { GrammarSymbols } from "./grammar_symbols";
import { Action, ActionKind, Actions } from "./lr";

/*function lookaheads(symbols : GrammarSymbols, nextTerminalsOfState : Set<int>[], lookahead : int[], action : Action) : int[][] {
    if (action.kind === ActionKind.REDUCE || action.kind === ActionKind.ACCEPT) return [lookahead];
    if (action.kind !== ActionKind.SHIFT) internalError();
    const nexts = nextTerminalsOfState[action.state];
    const result : int[][] = [];
    for (const next of nexts) {
        const r = [...lookahead, ...force(symbols.handlesOf(next))];
        result.push(r);
    }
    return result;
}*/

export enum ActionPlanKind {
    SHIFT,
    REDUCE,
    ACCEPT,
    READ,
    ERROR
}
freeze(ActionPlanKind);

export type ActionPlanShift = {
    kind : ActionPlanKind.SHIFT,

    /** The state to shift onto the stack. */
    state : nat, 

    /** How many of the tokens read to get into this state are actually munched? */
    munch : nat
}

export type ActionPlanReduce = {
    kind : ActionPlanKind.REDUCE,

    /** The rule to reduce with. */
    rule : nat
}

export type ActionPlanAccept = {
    kind : ActionPlanKind.ACCEPT
}

export type ActionPlanRead = {
    kind : ActionPlanKind.READ,

    /** Which action plan to execute next depending on which terminal is read. */
    options : [Set<int>, ActionPlan][]

}

export type ActionPlanError = {
    kind : ActionPlanKind.ERROR
}

export type ActionPlan = ActionPlanShift | ActionPlanReduce | ActionPlanAccept | ActionPlanRead | ActionPlanError

function strOfAction(symbols : GrammarSymbols, nextTerminals : Set<int>[], action : Action) : string {
    const kind = action.kind;
    switch (kind) {
        case ActionKind.ACCEPT: return "ACCEPT";
        case ActionKind.REDUCE: return "REDUCE " + action.rule;
        case ActionKind.SHIFT: 
            const s = "{ SHIFT " + action.state + ": ";
            return s + [... nextTerminals[action.state]].map(t => t === 0 ? "$" : symbols.symOf(t)).join(" | ") + "}";
        default: assertNever(kind);
    }
}

export function planActions(symbols : GrammarSymbols, nextTerminalsOfState : Set<int>[], actions : Actions) : ActionPlan {

    /** 
     * The lookaheads expected before the action should be executed, 
     * how many of them to munch in case the action is executed,
     * and how many lookaheads have already been munched before to get here.
     */
    type action = { lookahead : int[], munched : nat, munch : nat, action : Action }

    function equal_action(action1 : action, action2 : action) : boolean {
        if (!Action.equal(action1.action, action2.action)) return false;
        if (action1.munch != action2.munch || action1.munched != action2.munched) return false;
        for (let i = 0; i < action1.munch; i ++) {
            if (action1.lookahead[i] !== action2.lookahead[i]) return false;
        }
        return true;
    }

    function equal_actions(actions : action[]) : boolean {
        for (let i = 1; i < actions.length; i++) {
            if (!equal_action(actions[0], actions[i])) return false;
        }
        return true;
    }

    function planOfAction(action : action) : ActionPlan {
        if (action.munch > 0) {
            const plan = planOfAction({ 
                lookahead: action.lookahead.slice(1), 
                munched : action.munched + 1, munch : action.munch - 1, 
                action : action.action});
            const terminals = new Set([action.lookahead[0]]);
            return { kind : ActionPlanKind.READ, options : [[terminals, plan]] };
        }
        const kind = action.action.kind;
        switch (kind) {
            case ActionKind.ACCEPT: return { kind : ActionPlanKind.ACCEPT };
            case ActionKind.REDUCE: return { kind : ActionPlanKind.REDUCE, rule : action.action.rule };
            case ActionKind.SHIFT: return { kind : ActionPlanKind.SHIFT, state : action.action.state, munch : action.munched };
            default: assertNever(kind);
        }
    }

    function hasLeadingEmpty(actions : action[]) : boolean {
        for (const action of actions) {
            if (action.lookahead.length > 0 && symbols.nonemptyVersionOf(action.lookahead[0]) !== undefined)
                return true;
        }
        return false;
    }

    function readLookahead(lookahead : int[]) : int[] {
        return lookahead.slice(1);
        //return lookahead[0] === 0 ? [0] : lookahead.slice(1);
    }

    function removeLeadingEmpty(actions : action[]) : action[] {
        let nonempty_leading : action[] = [];
        let i = 0; 
        let count = actions.length;
        while (i < count) {
            const action = actions[i];
            if (action.lookahead.length > 0 && symbols.nonemptyVersionOf(action.lookahead[0]) !== undefined) {
                const nonempty = force(symbols.nonemptyVersionOf(action.lookahead[0]));
                const lookahead = readLookahead(action.lookahead);
                const action_nonempty : action = { 
                    lookahead : [nonempty, ...lookahead], 
                    munched : action.munched, munch : action.munch, action : action.action };
                const action_empty : action = {
                    lookahead : lookahead, 
                    munched : action.munched, munch : Math.max(0, action.munch - 1), action : action.action };
                nonempty_leading.push(action_nonempty);
                actions[i] = action_empty;
            } else {
                nonempty_leading.push(action);
                i += 1;
            }
        }
        return nonempty_leading;
    }

    function read(action : action) : action {
        const lookahead = readLookahead(action.lookahead);
        if (action.munch === 0) {
            return {
                lookahead: lookahead,
                munched: action.munched,
                munch: 0,
                action: action.action
            };
        } else {
            return {
                lookahead: lookahead,
                munched: action.munched + 1,
                munch: action.munch - 1,
                action: action.action
            };        
        }
    }

    function print_action(action : action) {
        const terminals = action.lookahead.map(t => t === 0 ? "EOF" : symbols.symOf(t)).join(", ");
        console.log("action: { lookahead: " + terminals + ", munched: " + action.munched + ", munch: " + action.munch + ", action: " + strOfAction(symbols, nextTerminalsOfState, action.action) + "})");
    }

    function formPlan(actions : action[]) : ActionPlan {
        if (equal_actions(actions)) {
            if (actions.length === 0) return { kind : ActionPlanKind.ERROR };
            return planOfAction(actions[0]);
        }
        if (hasLeadingEmpty(actions)) return formPlan(removeLeadingEmpty(actions));
        const leading = new Digraph();
        for (const action of actions) {
            if (action.lookahead.length === 0) {
                return { kind : ActionPlanKind.ERROR };
            }
            leading.insert(action.lookahead[0]);
        }
        const terminals = [...leading.vertices];
        for (let i = 0; i < terminals.length; i++) {
            const u = terminals[i];
            for (let j = i + 1; j < terminals.length; j++) {
                const v = terminals[j];
                if (!symbols.distinct(u, v)) leading.connect(u, v);
            }
        }
        const components = weaklyConnectedComponents(leading);
        const options : [Set<int>, action[]][] = components.map(c => [c, []]);
        for (const action of actions) {
            for (const option of options) {
                if (option[0].has(action.lookahead[0])) {
                    option[1].push(read(action));
                    break;
                }
            }
        }
        const options_with_plan : [Set<int>, ActionPlan][] = options.map(option => [option[0], formPlan(option[1])]);
        return { kind : ActionPlanKind.READ, options : options_with_plan };
    }    

    const all_actions : action[] = [];
    for (const [symbol, actionsOfSymbol] of actions) {
        const handles = force(symbols.handlesOf(symbol));
        for (const action of actionsOfSymbol) {
            const kind = action.kind;
            switch (kind) {
                case ActionKind.SHIFT:
                    const next_terminals = nextTerminalsOfState[action.state];
                    for (const next_terminal of next_terminals) {
                        const next_handles = force(symbols.handlesOf(next_terminal));
                        all_actions.push({ lookahead : [...handles, ...next_handles], munched : 0, munch : handles.length, action : action });
                    }
                    break;
                case ActionKind.REDUCE:
                    all_actions.push({ lookahead : handles, munched : 0, munch : 0, action : action });
                    break;
                case ActionKind.ACCEPT:
                    all_actions.push({ lookahead : handles, munched : 0, munch : 1, action : action });
                    break;
                default: assertNever(kind);
            }
        }
    }
    return formPlan(all_actions);
}

export function planContainsError(plan : ActionPlan) : boolean {
    const kind = plan.kind;
    switch (kind) {
        case ActionPlanKind.ERROR: return true;
        case ActionPlanKind.ACCEPT: return false;
        case ActionPlanKind.REDUCE: return false;
        case ActionPlanKind.SHIFT: return false;
        case ActionPlanKind.READ: 
            for (const option of plan.options) {
                if (planContainsError(option[1])) return true;
            }
            return false;
        default: assertNever(kind);
    }
}

export function depthOfPlan(plan : ActionPlan) : nat {
    const kind = plan.kind;
    switch (kind) {
        case ActionPlanKind.ERROR: return 0;
        case ActionPlanKind.ACCEPT: return 0;
        case ActionPlanKind.REDUCE: return 0;
        case ActionPlanKind.SHIFT: return 0;
        case ActionPlanKind.READ: {
            let depth = 0;
            for (const option of plan.options) {
                depth = Math.max(depth, 1 + depthOfPlan(option[1]));
            }
            return depth;
        }
        default: assertNever(kind);
    }
}

export function planHasAmbiguousReads(plan : ActionPlan) : boolean {
    const kind = plan.kind;
    switch (kind) {
        case ActionPlanKind.ERROR: return false;
        case ActionPlanKind.ACCEPT: return false;
        case ActionPlanKind.REDUCE: return false;
        case ActionPlanKind.SHIFT: return false;
        case ActionPlanKind.READ: {
            for (const option of plan.options) {
                if (option[0].size > 1) return true;
                if (planHasAmbiguousReads(option[1])) return true;
            }
            return false;
        }
        default: assertNever(kind);
    }
}

export function printActionPlan(symbols : GrammarSymbols, plan : ActionPlan, print :  (s : string) => void = debug) {

    function printPlan(prefix : string, plan : ActionPlan) {
        const kind = plan.kind;
        switch (kind) {
            case ActionPlanKind.ERROR: print(prefix + "ERROR"); break;
            case ActionPlanKind.ACCEPT: print(prefix + "ACCEPT"); break;
            case ActionPlanKind.REDUCE: print(prefix + "REDUCE " + plan.rule); break;
            case ActionPlanKind.SHIFT: print(prefix + "SHIFT " + plan.state + ", munch = " + plan.munch); break;
            case ActionPlanKind.READ: {
                for (const option of plan.options) {
                    const terminals = [...option[0]].map(t => t === 0 ? "EOF" : force(symbols.symOf(t))).join(" | ");
                    print(prefix + "READ " + terminals + " : ");
                    printPlan(prefix + "    ", option[1]);
                }
                break;
            }
            default: assertNever(kind);
        }        
    }

    printPlan("", plan);
} 

export function printActions(symbols : GrammarSymbols, nextTerminals : Set<int>[], actions : Actions, print :  (s : string) => void = debug) {
    for (const [terminal, action] of actions) {
        const name = terminal === 0 ? "$" : symbols.symOf(terminal);
        const which = [...action].map(t => strOfAction(symbols, nextTerminals, t)).join(" || ");
        print(name + ": " + which);
    }
}