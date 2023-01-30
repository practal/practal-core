import { debug, debugging, debugId } from "../things/debug";

/** Returns the length after a successful parse, and a negative number if unsuccessful. */
export type Lexer = (text : string, offset : number) => number

export function literalL(literal : string) : Lexer {
    const literalLen = literal.length;
    function parse(text : string, offset : number) : number {
        if (offset + literalLen > text.length) {
            return -1;
        }
        return (text.slice(offset).startsWith(literal)) ? literalLen : -1;
    }
    return parse;
}

export function charL(pred : (character : string) => boolean) : Lexer {
    function parse(text : string, offset : number) : number {
        if (offset >= text.length) return -1;
        for (const c of text.slice(offset)) {
            if (pred(c)) {
                return c.length;
            } else {
                return -1;
            }
        }
        return -1;
    }
    return parse;
}

export const anyCharL = charL(c => true);

export const letterL = charL(c => (c >= "A" && c <= "Z") || (c >= "a" && c <= "z"));
export const digitL = charL(c => c >= "0" && c <= "9");
export const alphaNumL = charL(c => (c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || (c >= "0" && c <= "9"))

export function charsL(pred : (character : string) => boolean, minimum : number = 0) : Lexer {
    function parse(text : string, offset : number) : number {
        if (offset > text.length) return -1;
        let n = 0;
        let len = 0;
        for (const c of text.slice(offset)) {
            if (pred(c)) {
                n += 1;
                len += c.length;
            } else {
                break;
            }
        }
        return (n >= minimum) ? len : -1;
    }
    return parse;
}

export const emptyL : Lexer = literalL("");

export function longestL(...lexers : Lexer[]) : Lexer {
    function parse(text : string, offset : number) : number  {
        let parsedLength : number = -1;
        for (const lexer of lexers) {
            parsedLength = Math.max(parsedLength, lexer(text, offset));
        }
        return parsedLength;
    }
    return parse;
}

export function firstL(...lexers : Lexer[]) : Lexer {
    function parse(text : string, offset : number) : number  {
        for (const lexer of lexers) {
            const len = lexer(text, offset);
            if (len >= 0) return len;
        } 
        return -1;
    }
    return parse;
}

export function seqL(...lexers : Lexer[]) : Lexer {
    function parse(text : string, offset : number) : number  {
        const startOffset = offset;
        for (const lexer of lexers) {
            const len = lexer(text, offset);
            if (len < 0) return -1;
            offset += len;
        }
        return offset - startOffset;
    }
    return parse;
}

export function optL(lexer : Lexer) : Lexer {
    return firstL(lexer, emptyL);
}

export function repL(lexer : Lexer) : Lexer {
    function parse(text : string, offset : number) : number  {
        const startOffset = offset;
        while (true) {
            const len = lexer(text, offset);
            if (len < 0) return offset - startOffset;
            if (len === 0) throw new Error("repL infinite loop");
            offset += len;
        }
    }
    return parse;
}

export function rep1L(lexer : Lexer) : Lexer {
    return seqL(lexer, repL(lexer));
}

export function lookaheadL(lexer : Lexer, positive : boolean = true) : Lexer {
    function parse(text : string, offset : number) : number  {
        const len = lexer(text, offset);
        if (positive) {
            return len >= 0 ? 0 : -1;
        } else {
            return len < 0 ? 0 : -1;
        }
    }
    return parse;
}

export const spaceL = charL(c => c === " ");
export const spacesL = charsL(c => c === " ");
export const spaces1L = charsL(c => c === " ", 1);

export const nonspaceL = charL(c => c !== " ");
export const nonspacesL = charsL(c => c !== " ");
export const nonspaces1L = charsL(c => c !== " ", 1);

export const hyphenL = literalL("-");
export const underscoreL = literalL("_");

export function debugL(name : string, lexer : Lexer) : Lexer {
    function parse(text : string, offset : number) : number  {
        if (!debugging()) return lexer(text, offset);
        const id = debugId();
        debug(`[start ${id}] lexing '${name}' at ${offset}`);
        const result = lexer(text, offset);
        if (result < 0) {
            debug(`[failed ${id}] lexing '${name}' at ${offset}`);
        } else {
            debug(`[success ${id}] lexing '${name}', at ${offset} lexed ${result} codepoints`);
        }
        return result;
    }
    return parse;    
}

export function ndebugL(name : string, lexer : Lexer) : Lexer {
    return lexer;
}