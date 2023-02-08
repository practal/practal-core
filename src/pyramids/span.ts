import { nat } from "../things/primitives";
import { assertThings } from "../things/things";
import { assertNever, freeze } from "../things/utils";
import { Result, ResultKind, textOfToken, Token } from "./deterministic_parser";
import { TextLines } from "./textlines";

export class Span {

    static none = new Span(0, 0, 0, 0);

    startLine : nat
    startOffsetInclusive : nat
    endLine : nat
    endOffsetExclusive : nat

    constructor(
        startLine : nat,
        startOffsetInclusive : nat,
        endLine : nat,
        endOffsetExclusive : nat)
    {
        assertThings(nat, startLine, startOffsetInclusive, endLine, endOffsetExclusive);
        if (startLine > endLine) throw new Error("invalid span");
        if (startLine === endLine && startOffsetInclusive > endOffsetExclusive) throw new Error("invalid span");    
        this.startLine = startLine;
        this.startOffsetInclusive = startOffsetInclusive;
        this.endLine = endLine;
        this.endOffsetExclusive = endOffsetExclusive
        freeze(this);
    }
}
freeze(Span);

export function spanOfResult<S, T>(result : Result<S, T>) : Span {
    const kind = result.kind;
    switch (kind) {
        case ResultKind.TOKEN: 
            return new Span(result.line, result.startOffsetInclusive, result.line, result.endOffsetInclusive+1);
        case ResultKind.TREE: 
            return new Span(result.startLine, result.startOffsetInclusive, result.endLine, result.endOffsetExclusive);
        default: assertNever(kind);        
    }
}

export class SpanStr {
    span : Span
    str : string

    constructor(span : Span, str : string) {
        this.span = span;
        this.str = str;
        freeze(this);
    }

    toString() : string {
        return this.str;
    }

    static fromToken<T>(lines : TextLines, token : Token<T>) : SpanStr {
        const span = spanOfResult(token);
        const text = textOfToken(lines, token);
        return new SpanStr(span, text);
    }

}
freeze(SpanStr);

