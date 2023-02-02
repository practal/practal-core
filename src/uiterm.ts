import { SectionData, SectionDataTerm, SectionName, TokenType } from "./practalium_parser"
import { iterateContentSections, iterateContentTokens, iterateTokensDeep, Result, ResultKind, textOfToken, Token, Tree } from "./pyramids/deterministic_parser"
import { Span, spanOfResult } from "./pyramids/span"
import { TextLines } from "./pyramids/textlines"
import { Handle, Theory } from "./theory"
import { debug } from "./things/debug"
import { nat } from "./things/primitives"
import { assertNever, force, internalError, Printer } from "./things/utils"

/** Terms designed to work well together with the user interface. */
export type UITerm = UITermVarApp | UITermAbstrApp

export type VarName = string

export enum UITermKind {
    VarApp,
    AbstrApp
}

export type UITermVarApp = {
    kind : UITermKind.VarApp,
    var : UIVar,
    params : UITerm[],
    syntax? : Tree<SectionData, TokenType>
}

export type UIVar = {
    free : boolean,
    name : VarName,
    syntax? : Token<TokenType>
}

export type UITermAbstrApp = {
    kind : UITermKind.AbstrApp,
    abstr : Handle,
    bounds : UIVar[],
    params : UITerm[],
    syntax? : Tree<SectionData, TokenType>
}

export function mkUITermValue(abstr : Handle, syntax? : Tree<SectionData, TokenType>) : UITermAbstrApp {
    return {
        kind : UITermKind.AbstrApp,
        abstr : abstr,
        bounds : [],
        params : [],
        syntax : syntax
    };
}

export function mkUIVar(lines : TextLines, token : Token<TokenType>) : UIVar {
    let name = textOfToken(lines, token);
    let free = false;
    if (name.startsWith("?")) {
        name = name.slice(1);
        free = true;
    }
    return {
        free : free,
        name : name,
        syntax : token
    };
}

export function mkUITermAbstrApp(abstr : Handle, bounds : UIVar[], params : UITerm[], result : Tree<SectionData, TokenType>) : UITermAbstrApp {
    return {
        kind : UITermKind.AbstrApp,
        abstr : abstr,
        bounds : bounds, 
        params : params,
        syntax : result
    };
}

export function mkUITermVarApp(v : UIVar, params : UITerm[], result : Tree<SectionData, TokenType>) : UITermVarApp {
    return {
        kind : UITermKind.VarApp,
        var : v,
        params : params,
        syntax : result
    };
}

export function printUITerm(theory : Theory, uiterm : UITerm, print : Printer = debug) {
    let emitted = "";
    function emit(s : string) {
        emitted += s;
    }
    function isAtomic(uiterm : UITerm) : boolean {
        const kind = uiterm.kind;
        switch (kind) {
            case UITermKind.VarApp: return true;
            case UITermKind.AbstrApp: return uiterm.params.length === 0;
            default: assertNever(kind); 
        }        
    }
    function pr(uiterm : UITerm) {
        const kind = uiterm.kind;
        switch (kind) {
            case UITermKind.VarApp:
                if (uiterm.var.free) emit("?" + uiterm.var.name);
                else emit(uiterm.var.name);
                if (uiterm.params.length > 0) {
                    emit("[");
                    for (let i = 0; i < uiterm.params.length; i++) {
                        if (i > 0) emit(", ");
                        pr(uiterm.params[i]);
                    }
                    emit("]");
                }
                break;
            case UITermKind.AbstrApp: {
                const info = theory.info(uiterm.abstr);
                if (info !== undefined) 
                    emit("\\" + info.nameDecl.short);
                else 
                    emit("\\??");
                if (uiterm.params.length > 0) {
                    if (uiterm.bounds.length > 0) {
                        for (const bound of uiterm.bounds) {
                            emit(" ");
                            emit(bound.name);
                        }
                        emit(".");
                    }
                    for (const param of uiterm.params) {
                        emit(" ");
                        const atomic = isAtomic(param);
                        if (!atomic) emit("(");
                        pr(param);
                        if (!atomic) emit(")");
                    }
                }
                break;
            }
            default: assertNever(kind);
        }
    }
    pr(uiterm);
    print(emitted);
}

export function constructUITermFromResult(theory : Theory, lines : TextLines, result : Result<SectionData, TokenType>) : UITerm | undefined {
    function constructMultiple(results : Result<SectionData, TokenType>[]) : UITerm[] {
        const terms : UITerm[] = [];
        for (const result of results) {
            terms.push(...construct(result));
        }
        return terms;
    }
    function abstrOf(token : Token<TokenType>) : Handle | undefined {
        let text = textOfToken(lines, token);
        if (text.startsWith("\\")) text = text.slice(1);
        const abstr = theory.lookupAbstraction(text);
        if (abstr === undefined) {
            theory.error(spanOfResult(token), "Unknown abstraction.");
            return undefined;
        }
        return abstr;
    }
    function constructUIVar(result : Result<SectionData, TokenType>) : UIVar | undefined {
        for (const t of iterateContentTokens(result)) {
            if (t.type === TokenType.free_variable || t.type === TokenType.variable || t.type === TokenType.bound_variable) {
                return mkUIVar(lines, t);
            }
        }
        return undefined;
    }
    function construct(result : Result<SectionData, TokenType>) : UITerm[] {
        const kind = result.kind;
        switch (kind) {
            case ResultKind.TOKEN: return [];
            case ResultKind.TREE: {
                const type = result.type;
                if (type === undefined) return [];
                if (type === null) return constructMultiple(result.children);
                const sectionname = type.type;
                switch (sectionname) {
                    case SectionName.custom: {
                        const binder_tokens = [...iterateContentTokens(result, t => t === TokenType.bound_variable)];
                        const binders : UIVar[] = [];
                        for (let i = 0; i < binder_tokens.length; i++) {
                            let j = force(type.bounds.get(i));
                            binders.push(mkUIVar(lines, binder_tokens[j]));
                        }
                        const term_sections = [...iterateContentSections(result, s => s.type === SectionName.custom)];
                        const terms : UITerm[] = [];
                        for (let i = 0; i < term_sections.length; i++) {
                            let j = force(type.frees.get(i));
                            terms.push(...construct(term_sections[j]));
                        }
                        return [mkUITermAbstrApp(type.abstr, binders, terms, result)];
                    }
                    case SectionName.term: return constructMultiple(result.children);
                    case SectionName.params: return constructMultiple(result.children);
                    case SectionName.brackets: return constructMultiple(result.children);
                    case SectionName.invalid: return constructMultiple(result.children);
                    case SectionName.value:
                        for (const token of iterateTokensDeep(result)) {
                            if (token.type === TokenType.value_id || token.type === TokenType.unknown_id) {
                                const abstr = abstrOf(token);
                                if (abstr === undefined) return [];
                                return [mkUITermValue(abstr, result as Tree<SectionDataTerm, TokenType>)];
                            } 
                        }
                        return [];
                    case SectionName.operation_app:
                    case SectionName.operator_app: {
                        const token = result.children[0] as Token<TokenType>;
                        const abstr = abstrOf(token);
                        if (abstr === undefined) return [];
                        const boundVarTokens = [...iterateContentTokens(result, t => t === TokenType.bound_variable)];
                        const bounds = boundVarTokens.map(t => mkUIVar(lines, t));
                        const sections = [...iterateContentSections(result, s => s.type === SectionName.params)];
                        const params = constructMultiple(sections);
                        return [mkUITermAbstrApp(abstr, bounds, params, result)];
                    }
                    case SectionName.var: {
                        const v = constructUIVar(result);
                        if (v === undefined) return [];
                        return [mkUITermVarApp(v, [], result)];
                    }
                    case SectionName.var_app: {
                        const v = constructUIVar(result.children[0]);
                        if (v === undefined) return [];
                        const sections = [...iterateContentSections(result, s => s.type === SectionName.term)];
                        const params = constructMultiple(sections);
                        return [mkUITermVarApp(v, params, result)];
                    }
                    default: return [];
                }
            }
        }
    }
    const terms = construct(result);
    if (terms.length === 1) return terms[0]; else return undefined;
}

export class UIFreeVars {

    #vars : Map<VarName, Set<nat>>
    
    constructor() {
        this.#vars = new Map();
    }

    add(name : VarName, arity : nat) {
        const arities = this.#vars.get(name);
        if (arities === undefined) {
            this.#vars.set(name, new Set([arity]));
        } else {
            arities.add(arity);
        }
    }

}

function makeFree(v : UIVar) {
    v.free = true;
    if (v.syntax) {
        v.syntax.type = TokenType.free_variable;
    }
}


function makeBound(v : UIVar) {
    v.free = false;
    if (v.syntax) {
        v.syntax.type = TokenType.bound_variable;
    }
}

/** 
 * Validates a term with respect to a theory, writing errors to the theory. 
 * Returns undefined if the term could not be validated, otherwise the set of free variables. 
 * Changes the term by making variables free/bound, as discovered.
 **/
export function validateUITerm(theory : Theory, term : UITerm) : UIFreeVars | undefined {

    const freeVars : UIFreeVars = new UIFreeVars();
    const binders : VarName[] = [];

    function isBound(v : VarName, binders : VarName[]) : boolean {
        return binders.indexOf(v) >= 0;
    }

    function validate(term : UITerm) : boolean {
        const kind = term.kind;
        switch (kind) {
            case UITermKind.VarApp: 
                if (term.params.length === 0 && !term.var.free) {
                    if (isBound(term.var.name, binders)) {
                        makeBound(term.var);
                        return true;
                    } else {
                        freeVars.add(term.var.name, 0);
                        makeFree(term.var);
                        return true;
                    }
                } else {
                    freeVars.add(term.var.name, term.params.length);
                    makeFree(term.var);
                    let ok = true;
                    for (const p of term.params) {
                        if (!validate(p)) ok = false;
                    }
                    return ok;
                }
            case UITermKind.AbstrApp: {
                function error(msg : string, span? : Span) {
                    if (!span && term.syntax) {
                        span = spanOfResult(term.syntax);
                    }
                    theory.error(span, msg);
                    ok = false;
                }
                const info = theory.info(term.abstr);
                if (info === undefined) {
                    error("Unknown abstraction.");
                    return false;
                }
                const name = "\\" + info.nameDecl.long;
                const shape = info.shape;
                let ok = true;
                if (shape.arity !== term.params.length) {
                    error(name + " expects " + shape.arity + " parameters, but " + term.params.length + " were found.");
                }
                if (shape.valence !== term.bounds.length) {
                    error(name + " binds " + shape.valence + " variables, but " + term.bounds.length + " binders were found.");
                }
                const varnames : VarName[] = [];
                for (const b of term.bounds) {
                    if (isBound(b.name, varnames)) {
                        let span : Span | undefined = undefined;
                        if (b.syntax) span = spanOfResult(b.syntax);
                        error("Duplicate binder " + b.name + ".", span);
                    }
                    varnames.push(b.name);
                }
                if (!ok) return false;
                for (const [i, param] of term.params.entries()) {
                    const param_binders = shape.shape[i].map(k => varnames[k]);
                    binders.push(...param_binders); 
                    if (!validate(param)) ok = false;
                    binders.splice(binders.length - param_binders.length, param_binders.length);
                }
                return ok;
            }
            default: assertNever(kind);
        }
    }

    if (!validate(term)) return undefined; else return freeVars;
}
