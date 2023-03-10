import { TextDecoder } from "util";
import { Lexer, spacesL } from "./lexer";
import { Span, SpanStr } from "./span";

export interface TextLines {
    lineCount : number
    lineAt(line : number) : string
    absolute(line: number, offset : number) : [number, number]
}

export function absoluteSpan(lines : TextLines, span : Span) : Span {
    const [l1, o1] = lines.absolute(span.startLine, span.startOffsetInclusive);
    const [l2, o2] = lines.absolute(span.endLine, span.endOffsetExclusive);
    return new Span(l1, o1, l2, o2);
}

export function absoluteSpanStr(lines : TextLines, spanstr : SpanStr) : SpanStr {
    const span = absoluteSpan(lines, spanstr.span);
    return new SpanStr(span, spanstr.str);
}

export function isValidPosition(lines : TextLines, line : number, offset : number) : boolean {
    if (!Number.isSafeInteger(line) || !Number.isSafeInteger(offset)) return false;
    return line >= 0 && line < lines.lineCount && offset >= 0 && offset <= lines.lineAt(line).length;
}

export function assertValidPosition(lines : TextLines, line : number, offset : number) {
    if (!isValidPosition(lines, line, offset)) throw new Error(`Invalid position: line ${line}, offset ${offset}`);
}

export function skipLineEnds(lines : TextLines, line : number, offset : number) : [number, number] {
    const COUNT = lines.lineCount;
    while (line < COUNT) {
        const text = lines.lineAt(line);
        const len = text.length;
        if (offset == len) {
            line += 1;
            offset = 0;
        } else break;
    }
    return [line, offset];
}

function visibleSpaces(text : string) : string {
    let result = "";
    for (const c of text) {
        if (c === " ") result += "⋅"; else result += c;
    }
    return result;
}

export function printTextLines(lines : TextLines, println : (text : string) => void = console.log) {
    for (let i = 0; i < lines.lineCount; i++) {
        let n = "" + i;
        while (n.length < 2) n = " " + n;
        console.log(n + "  " + visibleSpaces(lines.lineAt(i)));
    }
}

class TextLinesImpl implements TextLines {

    lines : string[]
    lineCount : number

    constructor(lines : string[]) {
        this.lines = lines;
        this.lineCount = lines.length;
    }

    lineAt(line : number) : string {
        return this.lines[line];
    }

    absolute(line : number, offset : number) : [number, number] {
        return [line, offset];
    }

}

export function createTextLines(lines : string[]) : TextLines {
    return new TextLinesImpl(lines);
}

export function createTextLinesFromBytes(buffer : Uint8Array) : TextLines {
    const s = new TextDecoder().decode(buffer);
    const lines = s.split(/\n\r|\r\n|\r|\n/);
    return createTextLines(lines);
}

/** Represents a (possibly modified) window into an existing TextLines. */
export class TextLinesWindow implements TextLines {

    source : TextLines

    /** The first line in the window corresponds to the startLine in the source. */
    startLine : number  

    /** The text lines of the window. */
    lines : string[] 

    /** The offsets at which window text lines start in the source window. */
    offsets : number[]

    /** Same as lines.length */
    lineCount : number

    constructor(source : TextLines, startLine : number, lines : string[], offsets : number[]) {
        if (lines.length != offsets.length) throw new Error("TextLinesWindow: number of lines and offsets do not match");
        this.source = source;
        this.startLine = startLine;
        this.lines = lines;
        this.offsets = offsets;
        this.lineCount = lines.length;
    }

    log(print : (text : string) => void = console.log) {
        print(`[TextWindow] start at line ${this.startLine}, number of lines ${this.lines.length}`);
        for (let i = 0; i < this.lines.length; i ++) {
            print(`  ${i}) '${this.lines[i]}', offset ${this.offsets[i]}`);
        }
    }

    lineAt(line: number): string {
        return this.lines[line];
    }   
    
    absolute(line: number, offset: number): [number, number] {
        const delta = (line >= 0 && line < this.offsets.length) ? this.offsets[line] : 0;
        return this.source.absolute(line + this.startLine, offset + delta);
    }

}

/** 
 * Cuts a window out of an existing TextLines.
 * 
 * The window starts at the given line and offset, and ends
 * before the first subsequent line that has no indentation.
 * 
 * If the first line can be completely skipped, it is discarded. Otherwise
 * its remains will start at offset 0 in the new window.
 * 
 * For the remaining lines, those lines which can be completely skipped correspond to empty lines
 * in the window.
 * 
 * For the other remaining lines we determine the offset of the remains (which will be > 0).
 * The remains of the line with minimal offset M starts at offset 0 in the window.
 * For every other remains with offset R >= M, the line in the new window consists of R-M spaces, followed by the remains. 
 */
export function cutoutTextLines(source : TextLines, line : number, offset : number, skipFirst : Lexer = spacesL, skipRemaining : Lexer = spacesL) : TextLinesWindow | undefined {
    if (!isValidPosition(source, line, offset)) return undefined;
    let text = source.lineAt(line);
    let skipped = skipFirst(text, offset);
    if (skipped < 0) return undefined;
    text = text.slice(offset + skipped);
    let startLine = line;
    let lines : string[] = [];
    let offsets : number[] = [];
    if (text.length === 0) {
        startLine = line + 1;
    } else {
        lines.push(text);
        offsets.push(offset + skipped);
    }
    const sourceCount = source.lineCount;
    let minSkipped = Number.MAX_SAFE_INTEGER;
    const I = offsets.length;
    for (let i = line + 1; i < sourceCount; i++) {
        text = source.lineAt(i);
        skipped = skipRemaining(text, 0);
        if (skipped >= text.length) {
            offsets.push(-1);
        } else if (skipped <= 0) {
            break;
        } else {
            offsets.push(skipped);
            if (skipped < minSkipped) minSkipped = skipped;
        }
    }
    if (minSkipped >= Number.MAX_SAFE_INTEGER) minSkipped = 0;
    for (let i = 0; i < offsets.length - I; i++) {
        text = source.lineAt(line + 1 + i);
        skipped = offsets[I + i];
        offsets[I+i] = minSkipped;
        if (skipped < 0) {
            lines.push("");
        } else {
            const spaces = " ".repeat(skipped - minSkipped);
            lines.push(spaces + text.slice(skipped));
        }
    }
    return new TextLinesWindow(source, startLine, lines, offsets);
}

export function cutoutRangeOfTextLines(source : TextLines, startLineInclusive : number, endLineExclusive : number) : TextLines {
    const lines : TextLines = {
        lineCount: endLineExclusive - startLineInclusive,
        lineAt: function (line: number): string {
            line += startLineInclusive;
            return source.lineAt(line);
        },
        absolute: function(line: number, offset: number): [number, number] {
            return source.absolute(line + startLineInclusive, offset);
        }
    };
    return lines;    
}

export function cutoffAfterIndentation(source : TextLines, line : number, skip : Lexer = spacesL) : TextLines  {
    const lineCount = source.lineCount;
    while (line < lineCount) {
        let text = source.lineAt(line);
        let skipped = skip(text, 0);
        if (skipped > 0 || skipped >= text.length) {
            line += 1;
        } else { 
            return cutoutRangeOfTextLines(source, 0, line);
        }
    }   
    return source; 
} 

export class TextLinesUntil implements TextLines {

    source : TextLines

    endLine : number  

    lastLine : string

    /** Same as lines.length */
    lineCount : number

    constructor(source : TextLines, endLine : number, endOffset : number) {
        if (endLine >= source.lineCount || endLine < 0) throw new Error("TextLinesUntil: endLine is out of range");
        this.source = source;
        this.endLine = endLine;
        let lastLine = source.lineAt(endLine);
        if (lastLine.length <= endOffset) {
            this.lastLine = lastLine;
        } else {
            this.lastLine = lastLine.slice(0, endOffset);
        }
        this.lineCount = endLine + 1;
    }

    log(print : (text : string) => void = console.log) {
        print(`[TextWindowUntil] endLine ${this.endLine} out of ${this.source.lineCount} lines:`);
        for (let i = 0; i < this.lineCount; i ++) {
            print(`  ${i}) '${this.lineAt(i)}'`);
        }
    }

    lineAt(line: number): string {
        if (line < this.endLine) return this.source.lineAt(line); 
        else if (line === this.endLine) return this.lastLine;
        else throw new Error("Nnvalid line number " + line + ".");
    }   
    
    absolute(line: number, offset: number): [number, number] {
        return this.source.absolute(line, offset);
    }

}

export function textlinesUntil(lines : TextLines, endLine : number, endOffset : number) : TextLines {
    if (endLine >= lines.lineCount) return lines;
    return new TextLinesUntil(lines, endLine, endOffset);
}


