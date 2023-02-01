import { charL, Lexer } from "./lexer"
import { cutoffAfterIndentation, cutoutTextLines, skipLineEnds, TextLines, TextLinesWindow } from "./textlines"
import { assertNever } from "../things/utils"
import { debug, debugging, debugId } from "../things/debug"
import { nat } from "../things/primitives"

export const enum ResultKind {
    TOKEN,
    TREE
}

export type Result<S, T> = Tree<S, T> | Token<T>

export type Token<T> = {
    kind : ResultKind.TOKEN,
    type : T,
    line : number,
    startOffsetInclusive : number,
    endOffsetInclusive : number,
}

export type Tree<S, T> = {
    kind : ResultKind.TREE,
    type : S | null | undefined,  // undefined means: throw away result
    startLine : number,
    startOffsetInclusive : number,
    endLine : number,
    endOffsetExclusive : number,
    children : Result<S, T>[]
}

export function isUndefinedTree<S, T>(result : Result<S, T>) : boolean {
    const kind = result.kind;
    switch (kind) {
        case ResultKind.TREE: return result.type === undefined;
        case ResultKind.TOKEN: return false;
        default: assertNever(kind);
    }
}

export function endOffsetExclusiveOf<S, T>(result : Result<S, T>) : number {
    const kind = result.kind;
    switch (kind) {
        case ResultKind.TREE: return result.endOffsetExclusive;
        case ResultKind.TOKEN: return result.endOffsetInclusive + 1;
        default: assertNever(kind);
    }
}

export function endLineOf<S, T>(result : Result<S, T>) : number {
    const kind = result.kind;
    switch (kind) {
        case ResultKind.TREE: return result.endLine;
        case ResultKind.TOKEN: return result.line;
        default: assertNever(kind);
    }
}

export function endOf<S, T>(result : Result<S, T>) : [number, number] {
    const kind = result.kind;
    switch (kind) {
        case ResultKind.TREE: return [result.endLine, result.endOffsetExclusive];
        case ResultKind.TOKEN: return [result.line, result.endOffsetInclusive + 1];
        default: assertNever(kind);
    }
}

export function textOfToken<T>(lines : TextLines, token : Token<T>) : string {
    const text = lines.lineAt(token.line); 
    return text.slice(token.startOffsetInclusive, token.endOffsetInclusive+1);
}

function digits(x : number, len : number) : string {
    let s = `${x}`;
    while (s.length < len) {
        s = "0" + s;
    }
    return s;
}

export function printRange<S, T>(result : Result<S, T>) : string {
    function d2(x : number) : string {
        return digits(x, 2);
    }
    const kind = result.kind;
    switch (kind) {
        case ResultKind.TOKEN: {
            const from = `${d2(result.line)}:${d2(result.startOffsetInclusive)}`;
            const to = `${d2(result.line)}:${d2(result.endOffsetInclusive+1)}`
            return `[${from} to ${to}[`;
        }
        case ResultKind.TREE: {
            const from = `${d2(result.startLine)}:${d2(result.startOffsetInclusive)}`;
            const to = `${d2(result.endLine)}:${d2(result.endOffsetExclusive)}`
            return `[${from} to ${to}[`;
        }
        default: assertNever(kind);        
    }
}

export function printResult<S, T>(
    print : (result : string) => void, 
    nameOfS : (type : S) => string,
    nameOfT : (type : T) => string,
    lines : TextLines,
    result : Result<S, T>)
{
    function process(prefix : string, result : Result<S, T>) {
        const kind = result.kind;
        switch (kind) {
            case ResultKind.TOKEN: {
                const text = textOfToken(lines, result);
                print(`${printRange(result)}${prefix}   ${nameOfT(result.type)} = "${text}"`);
                return;
            }
            case ResultKind.TREE: {
                if (result.type === undefined) return;
                if (result.type === null) {
                    for (const c of result.children) {
                        process(prefix, c);
                    }
                    return;
                }
                print(`${printRange(result)}${prefix}   ${nameOfS(result.type)}`);
                prefix += "    ";
                for (const c of result.children) {
                    process(prefix, c);
                }
                return;
            }
            default: assertNever(kind);
        }
    }
    process("", result);
}

export function* iterateTokensDeep<S, T>(result : Result<S, T>) : Generator<Token<T>> {
    const kind = result.kind;
    switch (kind) {
        case ResultKind.TREE: 
            if (result.type !== undefined) {
                for (const child of result.children) {
                    yield* iterateTokensDeep(child);
                }
            }
            return;
        case ResultKind.TOKEN: 
            yield result;
            return;
        default: assertNever(kind);
    }
}

export function* iterateResultsDeep<S, T>(sections : (s : S) => boolean, result : Result<S, T>) : Generator<Result<S, T>> {
    const kind = result.kind;
    switch (kind) {
        case ResultKind.TREE: 
            if (result.type !== undefined) {
                if (result.type !== null && sections(result.type)) {
                    yield result;
                } else {
                    for (const child of result.children) {
                        yield* iterateResultsDeep(sections, child);
                    }
                }
            }
            return;
        case ResultKind.TOKEN: 
            yield result;
            return;
        default: assertNever(kind);
    }
}

export function* iterateTokensFlat<S, T>(result : Result<S, T>) : Generator<Token<T>> {
    const kind = result.kind;
    switch (kind) {
        case ResultKind.TREE: 
            if (result.type === null) {
                for (const child of result.children) {
                    yield* iterateTokensFlat(child);
                }
            }
            return;
        case ResultKind.TOKEN: 
            yield result;
            return;
        default: assertNever(kind);
    }
}

export function* iterateContentSections<S, T>(result : Result<S, T>, filter? : (s:S) => boolean) : Generator<Tree<S, T>> {
    const kind = result.kind;
    switch (kind) {
        case ResultKind.TREE: 
            for (const child of result.children) {
                if (child.kind === ResultKind.TREE) {
                    if (child.type === null) yield* iterateContentSections(child);
                    else if (child.type !== undefined && (filter === undefined || filter(child.type))) yield child;
                }
            }
            return;
        case ResultKind.TOKEN: 
            return;
        default: assertNever(kind);
    }
}

export function* iterateContentTokens<S, T>(result : Result<S, T>, filter? : (t:T) => boolean) : Generator<Token<T>> {
    const kind = result.kind;
    switch (kind) {
        case ResultKind.TREE: 
            for (const child of result.children) {
                for (const token of iterateTokensFlat(child)) {
                    if (filter === undefined || filter(token.type)) yield token;
                }
            }
            return;
        case ResultKind.TOKEN: 
            if (filter === undefined || filter(result.type)) yield result;
            return;
        default: assertNever(kind);
    }
}

export type DPResult<State, S, T> = { state : State, result : Result<S, T> } | undefined;

/** 
 * Returning undefined means that the parser failed. 
 * The parser can assume that isValidPosition(lines, line, offset), 
 * otherwise they may throw an exception. 
 */
export type DetParser<State, S, T> = 
    (state : State, lines : TextLines, line : number, offset : number) => DPResult<State, S, T>

export function eofDP<State, S, T>() : DetParser<State, S, T> {

    function parse(state : State, lines : TextLines, line : number, offset : number) : DPResult<State, S, T> {
        if (line >= lines.lineCount || (line >= 0 && line === lines.lineCount -1 && offset >= lines.lineAt(line).length)) {
            const tree : Tree<S, T> = {
                kind : ResultKind.TREE,
                type : undefined,
                startLine : line,
                startOffsetInclusive : offset,
                endLine : line,
                endOffsetExclusive : offset,
                children : []
            };
            return { state : state, result : tree};         
        } else return undefined;
    }

    return parse;

}

export function lexerDP<State, S, T>(lexer : Lexer, tokentype : T, treetype : S | null = null, strict : boolean = false) : DetParser<State, S, T> {

    function parse(state : State, lines : TextLines, line : number, offset : number) : DPResult<State, S, T> 
    {
        [line, offset] = strict ? [line, offset] : skipLineEnds(lines, line, offset);
        if (line >= lines.lineCount) return undefined;
        let text = lines.lineAt(line);
        if (offset > text.length) return undefined;
        const len = lexer(text, offset);
        if (len < 0) return undefined;
        else if (len === 0) {
            const tree : Tree<S, T> = {
                kind : ResultKind.TREE,
                type : treetype,
                startLine : line,
                startOffsetInclusive : offset,
                endLine : line,
                endOffsetExclusive : offset,
                children : []
            }
            return { state : state, result : tree };
        } else {
            const token : Token<T> = {
                kind : ResultKind.TOKEN, 
                type : tokentype,
                line : line, 
                startOffsetInclusive : offset,
                endOffsetInclusive : offset + len - 1,
            };
            return { state : state, result : token };
        }
    }
    return parse;
}

export function tokenDP<State, S, T>(lexer : Lexer, tokentype : T, strict : boolean = false) : DetParser<State, S, T> {

    function parse(state : State, lines : TextLines, line : number, offset : number) : DPResult<State, S, T>
    {
        [line, offset] = strict ? [line, offset] : skipLineEnds(lines, line, offset);
        if (line >= lines.lineCount) return undefined;
        let text = lines.lineAt(line);
        if (offset > text.length) return undefined;
        const len = lexer(text, offset);
        if (len <= 0) return undefined;
        else {
            const token : Token<T> = {
                kind : ResultKind.TOKEN, 
                type : tokentype,
                line : line, 
                startOffsetInclusive : offset,
                endOffsetInclusive : offset + len - 1,
            };
            return { state : state, result : token };
        }
    }

    return parse;
}

export function strictTokenDP<State, S, T>(lexer : Lexer, tokentype : T, strict : boolean = false) : DetParser<State, S, T> {
    return tokenDP(lexer, tokentype, true);
}



export function failDP<State, S, T>() : DetParser<State, S, T> {

    function parse(state : State, lines : TextLines, line : number, offset : number) : DPResult<State, S, T> {
        return undefined;
    }

    return parse;

}

export function emptyDP<State, S, T>(treetype : S | null | undefined = undefined) : DetParser<State, S, T> {
    
    function parse(state : State, lines : TextLines, line : number, offset : number) : DPResult<State, S, T> {
        if (line === lines.lineCount && offset == 0) {
            const tree : Tree<S, T> = {
                kind : ResultKind.TREE,
                type : treetype,
                startLine : line,
                startOffsetInclusive : offset,
                endLine : line,
                endOffsetExclusive : offset,
                children : []
            }
            return { state : state, result : tree };
        }
        if (line >= lines.lineCount) return undefined;
        let text = lines.lineAt(line);
        if (offset > text.length) return undefined;
        const tree : Tree<S, T> = {
            kind : ResultKind.TREE,
            type : treetype,
            startLine : line,
            startOffsetInclusive : offset,
            endLine : line,
            endOffsetExclusive : offset,
            children : []
        }
        return { state : state, result : tree };
    }

    return parse;
}

export function seqDP<State, S, T>(...parsers : DetParser<State, S, T>[]) : DetParser<State, S, T> {

    if (parsers.length === 0) return emptyDP();
    if (parsers.length === 1) return parsers[0];

    function parse(state : State, lines : TextLines, line : number, offset : number) : DPResult<State, S, T> {
        let children : Result<S, T>[] = [];
        const startLine = line;
        const startOffset = offset;
        for (const parser of parsers) {
            const parsed = parser(state, lines, line, offset);
            if (parsed === undefined) {
                return undefined;
            }
            const result = parsed.result;
            if (!isUndefinedTree(result)) {
                children.push(result);
            }
            state = parsed.state;
            [line, offset] = endOf(result);
        }
        const tree : Tree<S, T> = {
            kind : ResultKind.TREE,
            type : null,
            startLine : startLine,
            startOffsetInclusive : startOffset,
            endLine : line,
            endOffsetExclusive : offset,
            children : children
        }       
        return { state : state, result : tree };
    }

    return parse;
}

export function orDP<State, S, T>(...parsers : DetParser<State, S, T>[]) : DetParser<State, S, T> {

    function parse(state : State, lines : TextLines, line : number, offset : number) : DPResult<State, S, T> {
        for (const parser of parsers) {
            const result = parser(state, lines, line, offset);
            if (result !== undefined) return result;
        }
        return undefined;
    }

    return parse;
}

export function optDP<State, S, T>(...parsers : DetParser<State, S, T>[]) : DetParser<State, S, T> {
    return orDP(seqDP(...parsers), emptyDP());
}

export function repDP<State, S, T>(...parsers : DetParser<State, S, T>[]) : DetParser<State, S, T> {
    const parser = seqDP(...parsers);

    function parse(state : State, lines : TextLines, line : number, offset : number) : DPResult<State, S, T> {
        let children : Result<S, T>[] = [];
        const startLine = line;
        const startOffset = offset;
        while (true) {
            const parsed = parser(state, lines, line, offset);
            if (parsed === undefined) {
                const tree : Tree<S, T> = {
                    kind : ResultKind.TREE,
                    type : null,
                    startLine : startLine,
                    startOffsetInclusive : startOffset,
                    endLine : line,
                    endOffsetExclusive : offset,
                    children : children
                };
                return { state : state, result : tree };
            }
            state = parsed.state;
            const result = parsed.result;           
            if (!isUndefinedTree(result)) children.push(result);            
            [line, offset] = endOf(result);
        }
    }

    return parse;
}

export function rep1DP<State, S, T>(...parsers : DetParser<State, S, T>[]) : DetParser<State, S, T> {
    const parser = seqDP(...parsers);
    return seqDP(parser, repDP(parser));
}

export type Section<State, S, T> = { 
    bullet : DetParser<State, S, T>, 
    body : DetParser<State, S, T> 
    type : S | null | undefined,
    process? : (lines : TextLines, result : DPResult<State, S, T>) => DPResult<State, S, T>
};

export function shiftResult<S, T>(window : TextLinesWindow, result : Result<S, T>) {
    const kind = result.kind;
    const startLine = window.startLine;
    const offsets = window.offsets;
    switch (kind) {
        case ResultKind.TOKEN: {
            const offset = result.line < offsets.length ? offsets[result.line] : 0;
            result.startOffsetInclusive += offset;
            result.endOffsetInclusive += offset;
            result.line += startLine;
            return;
        }
        case ResultKind.TREE: {
            const line = result.startLine;
            const offset = line < offsets.length ? offsets[line] : 0;
            result.startOffsetInclusive += offset;
            result.endOffsetExclusive += offset;
            result.startLine += startLine;
            result.endLine += startLine;
            for (const child of result.children) {
                shiftResult(window, child);
            }
            return;
        }
        default: assertNever(kind);
    }
}

export function debugDP<State, S, T>(name : string, ...parsers : DetParser<State, S, T>[]) : DetParser<State, S, T> {
    const parser = seqDP(...parsers);
    if (!debugging()) return parser;

    function parse(state : State, lines : TextLines, line : number, offset : number) : DPResult<State, S, T> {
        const id = debugId();
        debug(`[start ${id}] parsing '${name}' at ${line}:${offset}`);
        const parsed = parse(state, lines, line, offset);
        if (parsed === undefined) {
            debug(`[failed ${id}] parsing '${name}' at ${line}:${offset}`);
            return undefined;
        } else {
            const result = parsed.result;
            [line, offset] = endOf(result);
            const tokens = [...iterateTokensDeep(result)];
            debug(`[success ${id}] parsed '${name}', ${tokens.length} tokens until ${line}:${offset}`);
        }
        return parsed;
    }

    return parse;
}

export function sectionDP<State, S, T>(section : Section<State, S, T>) : DetParser<State, S, T> {

    function parse(state : State, lines : TextLines, line : number, offset : number) : DPResult<State, S, T> { 
        [line, offset] = skipLineEnds(lines, line, offset);
        if (offset > 0) return undefined;
        if (line >= lines.lineCount) return undefined;
        const bulletLines = cutoffAfterIndentation(lines, line + 1);
        const parsedBullet = section.bullet(state, bulletLines, line, 0);
        if (parsedBullet === undefined) {
            return undefined;
        }
        state = parsedBullet.state;
        let [nextLine, nextOffset] = endOf(parsedBullet.result);
        const window = cutoutTextLines(lines, nextLine, nextOffset);
        if (window === undefined) throw new Error("sectionGP.parse: invalid window");
        const parsedBody = section.body(state, window, 0, 0);
        if (parsedBody === undefined) {
            return undefined;
        }
        shiftResult(window, parsedBody.result);
        state = parsedBody.state;
        let endLine = window.lineCount > 0 ? window.startLine + window.lineCount - 1 : nextLine;   
        let endOffset = endLine < lines.lineCount ? lines.lineAt(endLine).length : 0;
        let children : Result<S, T>[] = [];   
        if (!isUndefinedTree(parsedBullet.result)) children.push(parsedBullet.result);
        if (!isUndefinedTree(parsedBody.result)) children.push(parsedBody.result);
        let tree : Tree<S, T> = {
            kind : ResultKind.TREE,
            type : section.type,
            startLine : line,
            startOffsetInclusive : offset,
            endLine : endLine,
            endOffsetExclusive : endOffset,
            children : children
        }
        const result = { state : state, result : tree };
        if (section.process) {
            return section.process(lines, result);
        } else {
            return result;
        }
    }

    return parse;
};

export function enumDP<State, S, T>(...sections : Section<State, S, T>[]) : DetParser<State, S, T> {
    const parsers = sections.map(sectionDP);
    return repDP(orDP(...parsers));
}

export function lookaheadInLineDP<State, S, T>(lexer : Lexer, positive : boolean = true) : DetParser<State, S, T> {

    function parse(state : State, lines : TextLines, line : number, offset : number) : DPResult<State, S, T> { 
        if (line >= lines.lineCount) return undefined;
        const text = lines.lineAt(line);
        let failed = lexer(text, offset) < 0;
        if (!positive) failed = !failed;
        if (failed) return undefined;
        let tree : Tree<S, T> = {
            kind : ResultKind.TREE,
            type : undefined,
            startLine : line,
            startOffsetInclusive : offset,
            endLine : line,
            endOffsetExclusive : offset,
            children : []
        }
        return { state : state, result : tree };
    }

    return parse;
}

export function modifyDP<State, S, T>(parser : DetParser<State, S, T>, 
    usage : (state : State, lines : TextLines, line : number, offset : number, result : DPResult<State, S, T>) => DPResult<State, S, T> | undefined) : DetParser<State, S, T> {

    function parse(state : State, lines : TextLines, line : number, offset : number) : DPResult<State, S, T> { 
        return usage(state, lines, line, offset, parser(state, lines, line, offset));
    }
    
    return parse;
}

export function modifyResultDP<State, S, T>(parser : DetParser<State, S, T>, 
    usage : (lines : TextLines, result : DPResult<State, S, T>) => DPResult<State, S, T> | undefined) : DetParser<State, S, T> {

    function parse(state : State, lines : TextLines, line : number, offset : number) : DPResult<State, S, T> { 
        return usage(lines, parser(state, lines, line, offset));
    }
    
    return parse;
}

export function useDP<State, S, T>(construct : (lines : TextLines, state : State) => DetParser<State, S, T>) : DetParser<State, S, T> {

    function parse(state : State, lines : TextLines, line : number, offset : number) : DPResult<State, S, T> { 
        const parser = construct(lines, state);
        return parser(state, lines, line, offset);
    }

    return parse;
}

export function newlineDP<State, S, T>(type : S | null | undefined = undefined) : DetParser<State, S, T> {

    function parse(state : State, lines : TextLines, line : number, offset : number) : DPResult<State, S, T> { 
        if (line+1 >= lines.lineCount) return undefined;
        if (offset !== lines.lineAt(line).length) return undefined;
        let tree : Tree<S, T> = {
            kind : ResultKind.TREE,
            type : type,
            startLine : line,
            startOffsetInclusive : offset,
            endLine : line+1,
            endOffsetExclusive : 0,
            children : []
        }
        return { state : state, result : tree };  
    }

    return parse;
}

