import { Lexer, spacesL } from "./lexer";

export interface TextLines {
    lineCount : number
    lineAt(line : number) : string
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

}

export function createTextLines(lines : string[]) : TextLines {
    return new TextLinesImpl(lines);
}

/** Represents a (possibly modified) window into an existing TextLines. */
export class TextLinesWindow implements TextLines {

    /** The first line in the window corresponds to the startLine in the source. */
    startLine : number  

    /** The text lines of the window. */
    lines : string[] 

    /** The offsets at which window text lines start in the source window. */
    offsets : number[]

    /** Same as lines.length */
    lineCount : number

    constructor(startLine : number, lines : string[], offsets : number[]) {
        if (lines.length != offsets.length) throw new Error("TextLinesWindow: number of lines and offsets do not match");
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
    return new TextLinesWindow(startLine, lines, offsets);
}

export function cutoutRangeOfTextLines(source : TextLines, startLineInclusive : number, endLineExclusive : number) : TextLines {
    const lines : TextLines = {
        lineCount: endLineExclusive - startLineInclusive,
        lineAt: function (line: number): string {
            line += startLineInclusive;
            return source.lineAt(line);
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
