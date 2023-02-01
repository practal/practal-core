import { SectionData, SectionDataTerm, SectionName, TokenType } from "./practalium_parser"
import { iterateTokensDeep, Result, ResultKind, textOfToken, Token, Tree } from "./pyramids/deterministic_parser"
import { spanOfResult } from "./pyramids/span"
import { TextLines } from "./pyramids/textlines"
import { Handle, Theory } from "./theory"
import { debug } from "./things/debug"
import { assertNever, Printer } from "./things/utils"

export type UITerm = UITermVarApp | UITermAbstrApp

export enum UITermKind {
    VarApp,
    AbstrApp
}

export type UITermVarApp = {
    kind : UITermKind.VarApp,
    free : boolean | undefined,
    var : UIVar,
    params : UITerm[],
    syntax? : Tree<SectionDataTerm, TokenType>
}

export type UIVar = {
    name : string,
    syntax? : Token<TokenType.bound_variable | TokenType.free_variable | TokenType.variable>
}

export type UITermAbstrApp = {
    kind : UITermKind.AbstrApp,
    abstr : Handle,
    bounds : UIVar[],
    params : UITerm[],
    syntax? : Tree<SectionDataTerm, TokenType>
}

export function mkUITermValue(abstr : Handle, syntax? : Tree<SectionDataTerm, TokenType>) : UITermAbstrApp {
    return {
        kind : UITermKind.AbstrApp,
        abstr : abstr,
        bounds : [],
        params : [],
        syntax : syntax
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
                if (uiterm.free) emit("?" + uiterm.var.name);
                else emit(uiterm.var.name);
                emit("[");
                for (let i = 0; i < uiterm.params.length; i++) {
                    if (i > 0) emit(", ");
                    pr(uiterm.params[i]);
                }
                emit("]");
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
            const term = construct(result);
            if (term !== undefined) terms.push(term);
        }
        return terms;
    }
    function constructFromMultiple(results : Result<SectionData, TokenType>[]) : UITerm | undefined {
        const terms = constructMultiple(results);
        if (terms.length === 1) return terms[0]; else return undefined;
    }
    function construct(result : Result<SectionData, TokenType>) : UITerm | undefined {
        const kind = result.kind;
        switch (kind) {
            case ResultKind.TOKEN: return undefined;
            case ResultKind.TREE: {
                const type = result.type;
                if (type === undefined) return undefined;
                if (type === null) return constructFromMultiple(result.children);
                const sectionname = type.type;
                switch (sectionname) {
                    case SectionName.custom: return undefined;
                    case SectionName.term: return constructFromMultiple(result.children);
                    case SectionName.brackets: return constructFromMultiple(result.children);
                    case SectionName.invalid: return constructFromMultiple(result.children);
                    case SectionName.value:
                        for (const token of iterateTokensDeep(result)) {
                            if (token.type === TokenType.value_id || token.type === TokenType.unknown_id) {
                                let text = textOfToken(lines, token);
                                if (text.startsWith("\\")) text = text.slice(1);
                                const abstr = theory.lookupAbstraction(text);
                                if (abstr === undefined) {
                                    theory.error(spanOfResult(token), "Unknown abstraction.");
                                    return undefined;
                                }
                                return mkUITermValue(abstr, result as Tree<SectionDataTerm, TokenType>);
                            } 
                        }
                        return undefined;
                    default: return undefined;
                }
            }
        }
    }
    return construct(result);
}
