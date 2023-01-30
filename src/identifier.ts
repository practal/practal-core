import { charL, firstL, Lexer, literalL, rep1L, repL, seqL } from "./pyramids/lexer";
import { Span } from "./pyramids/span";

export function splitIdDecl(decl : string) : { short : string, long : string } | undefined {
    let short = "";
    let long = "";
    let in_bracket = false;
    for (const c of decl) {
        if (c === "(") {
            if (in_bracket) return undefined;
            in_bracket = true;
        } else if (c === ")") {
            if (!in_bracket) return undefined;
            in_bracket = false;
        } else {
            long += c;
            if (!in_bracket) short += c;
        }
    }
    return { short : short, long : long };
}

function isConstIdLetter(c : string) : boolean {
    return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z');
}

function isVarIdLetter(c : string) : boolean {
    return isConstIdLetter(c);
}

function isDigit(c : string) : boolean {
    return c >= '0' && c <= '9';
}

function idLexer(isLetter : (c : string) => boolean) : { id : Lexer, decl : Lexer } {
    const idLetterL = charL(isLetter);
    const idAlphaL = charL(c => isLetter(c) || isDigit(c));
    const idHyphenL = literalL("-");
    const identifierL : Lexer = seqL(idLetterL, repL(idAlphaL), repL(seqL(idHyphenL, rep1L(idAlphaL))));
    const idDeclFragmentL = seqL(literalL("("), repL(firstL(idAlphaL, idHyphenL)), literalL(")"));
    const idDeclL = seqL(firstL(idLetterL, idDeclFragmentL), repL(firstL(idAlphaL, idHyphenL, idDeclFragmentL)));
    return { id : identifierL, decl : idDeclL };
}

export const { id : constIdL, decl : abstrDeclL } = idLexer(isConstIdLetter);
export const varIdL = idLexer(isVarIdLetter).id;

export function isConstId(id : string) : boolean {
    return constIdL(id, 0) === id.length;
}

export function isVarId(id : string) : boolean {
    return varIdL(id, 0) === id.length;
}

export function normalConstId(id : string) : string {
    let normal = "";
    for (const c of id) {
        if (isConstIdLetter(c) || isDigit(c)) normal += c.toLowerCase();
    }
    return normal;
}
