import { SectionData, SectionDataTerm, SectionName, TokenType } from "./practalium_parser"
import { iterateContentSections, iterateContentTokens, iterateTokensDeep, Result, ResultKind, textOfToken, Token, Tree } from "./pyramids/deterministic_parser"
import { spanOfResult } from "./pyramids/span"
import { TextLines } from "./pyramids/textlines"
import { Handle, Theory } from "./theory"
import { debug } from "./things/debug"
import { assertNever, internalError, Printer } from "./things/utils"

export type UITerm = UITermVarApp | UITermAbstrApp

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
    name : string,
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
                emit("\\" + info.nameDecl.short);
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
                    case SectionName.custom: return [];
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
