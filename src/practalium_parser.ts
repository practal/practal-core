import { join } from "path";
import { SemanticTokens } from "vscode";
import { debugDP, DetParser, DPResult, emptyDP, enumDP, iterateTokensDeep, lookaheadInLineDP, optDP, orDP, rep1DP, repDP, Section, sectionDP, seqDP, textOfToken, tokenDP, modifyDP, useDP, newlineDP, modifyResultDP, Token, iterateTokensFlat, printResult, Result, ResultKind, iterateContentSections, iterateResultsDeep, Tree, endOf, dependentSeqDP, iterateContentTokens, chainDP, joinResults } from "./pyramids/deterministic_parser";
import { alphaNumL, anyCharL, charL, charsL, firstL, hyphenL, letterL, Lexer, literalL, lookaheadL, nonspaceL, nonspaces1L, nonspacesL, optL, rep1L, repL, seqL, spaces1L, underscoreL } from "./pyramids/lexer";
import { Span, spanOfResult, SpanStr } from "./pyramids/span";
import { absoluteSpan, TextLines } from "./pyramids/textlines";
import { Handle, Head, SyntaxFragment, SyntaxFragmentKind, SyntaxSpec, UITheory } from "./uitheory";
import { debug } from "./things/debug";
import { int, nat } from "./things/primitives";
import { assertTrue, force, internalError, notImplemented, Printer } from "./things/utils";
import { constructUITermFromResult, mkUIRule, mkUITemplate, mkUIVar, printUITerm, UIRule, UITemplate, UITerm, UITermAbstrApp, UITermVarApp, UIVar, validateUITerm, VarName } from "./uiterm";

export enum TokenType {
    module_name,
    primary_keyword,
    secondary_keyword,
    label,
    label_colon,
    identifier,
    syntactic_category,
    syntactic_category_declaration,
    syntactic_category_keyword,
    syntactic_category_atomic,
    syntactic_category_term,
    loose,
    free_variable,
    bound_variable,
    variable,
    abstraction,
    abstraction_declaration,
    unknown_id,
    value_id,
    operation_id,
    operator_id,
    custom_syntax,
    whitespace,
    comment,
    square_open,
    square_close,
    round_open,
    round_close,
    dot,
    comma,
    syntactic_transitive_less,
    syntactic_transitive_greater,
    syntax_fragment,
    syntax_optional_space,
    syntax_mandatory_space,
    latex_control_sequence,
    latex_syntax,
    latex_space,
    premise,
    infer,
    invalid // must be last for ALL_TOKEN_TYPES to be defined correctly
}

export const ALL_TOKEN_TYPES : TokenType[] = [...Array(TokenType.invalid+1).keys()];

export enum SectionName {
    theory,
    axiom,
    declaration,
    comment,
    error,
    syntax,
    syntactic_category,
    inline_latex,
    display_latex,
    newline,
    definition,
    premise,
    conclusion,

    // Terms
    operation_app,
    operator_app,
    value,
    var_app,
    var,
    brackets,
    term,
    custom,
    params,
    invalid,

    // Templates and Rules
    template,
    rule

}

export type SectionData = SectionDataNone | SectionDataTerm | SectionDataTerms | SectionDataCustom | SectionDataTemplate | SectionDataRule | SectionDataPremise | SectionDataConclusion

export type SectionName_DataNone = 
    SectionName.theory | SectionName.axiom | SectionName.declaration | SectionName.comment | SectionName.error |
    SectionName.syntax | SectionName.syntactic_category | SectionName.inline_latex | SectionName.display_latex |
    SectionName.newline | SectionName.definition 

export type SectionName_Term = 
    SectionName.operation_app | SectionName.operator_app | SectionName.value | 
    SectionName.var_app | SectionName.var |
    SectionName.brackets | SectionName.term | SectionName.invalid 

export type SectionName_Terms = SectionName.params;

export type SectionDataNone = {
    type : SectionName_DataNone
}

export function SectionDataNone(ty : SectionName_DataNone) : SectionDataNone {
    return { type : ty };
}

export type SectionDataTerm = {
    type : SectionName_Term
    term? : UITerm
}

export function SectionDataTerm(ty : SectionName_Term, term? : UITerm) : SectionDataTerm {
    return { type : ty, term : term };
}

export type SectionDataTerms = {
    type : SectionName_Terms
    terms : UITerm[]
}

export function SectionDataTerms(ty : SectionName_Terms, terms? : UITerm[]) : SectionDataTerms {
    return { type : ty, terms : terms ?? []};
}

export type SectionDataCustom = {
    type : SectionName.custom,
    abstr : Handle,
    frees : Map<nat, nat>, // n -> m maps n-th free variable in head to m-th term
    bounds : Map<nat, nat>, // n -> m maps n-th binder in head to m-th bound-var
}

export function SectionDataCustom(abstr : Handle, head : Head, frees : Map<string, nat>, bounds : Map<string, nat>) : SectionDataCustom {
    const frees_converted : Map<nat, nat> = new Map();
    const bounds_converted : Map<nat, nat> = new Map();
    for (const [f, free] of head.frees.entries()) {
        const index = force(frees.get(free[0].str));
        frees_converted.set(f, index);
    }
    for (const [b, bound] of head.bounds.entries()) {
        const index = force(bounds.get(bound.str));
        bounds_converted.set(b, index);
    }
    return {
        type : SectionName.custom,
        abstr : abstr,
        frees : frees_converted,
        bounds : bounds_converted
    };
}

export type SectionDataTemplate = {
    type : SectionName.template,
    template? : UITemplate 
}

export function SectionDataTemplate(template? : UITemplate) : SectionDataTemplate {
    return {
        type : SectionName.template,
        template : template 
    };
}

export type SectionDataPremise = {
    type : SectionName.premise,
    label? : SpanStr,
    premise? : UITemplate
}

export function SectionDataPremise(label? : SpanStr, premise? : UITemplate) : SectionDataPremise {
    return {
        type : SectionName.premise,
        label : label,
        premise : premise
    };
}

export type SectionDataConclusion = {
    type : SectionName.conclusion,
    label? : SpanStr,
    conclusion? : UITerm
}

export function SectionDataConclusion(label? : SpanStr, conclusion? : UITerm) : SectionDataConclusion {
    return {
        type : SectionName.conclusion,
        label : label,
        conclusion : conclusion
    };
}


export type SectionDataRule = {
    type : SectionName.rule,
    rule : UIRule
}

export function SectionDataRule(rule : UIRule) : SectionDataRule {
    return {
        type : SectionName.rule,
        rule : rule
    };
}

export type ParseState = {

    theory : UITheory

    varParser : P | undefined

    termParser : P | undefined

}

export type VarSet = Set<string>

export type P = DetParser<ParseState, SectionData, TokenType>
export type S = Section<ParseState, SectionData, TokenType>
export type R = DPResult<ParseState, SectionData, TokenType>

export function printPractalResult(lines : TextLines, result : Result<SectionData, TokenType>, print : Printer = debug) {
    function nameOfS(type : SectionData) : string { return SectionName[type.type]; }
    function nameOfT(type : TokenType) : string { return TokenType[type]; }
    printResult(print, nameOfS, nameOfT, lines, result);
}

function isIdLetter(c : string) : boolean {
    return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z');
}

function isIdDigit(c : string) : boolean {
    return c >= '0' && c <= '9';
}

const idLetterL = charL(isIdLetter);
const idAlphaL = charL(c => isIdLetter(c) || isIdDigit(c));
const idHyphenL = literalL("-");
const identifierL : Lexer = seqL(idLetterL, repL(idAlphaL), repL(seqL(idHyphenL, rep1L(idAlphaL))));
const idDeclFragmentL = seqL(literalL("("), repL(firstL(idAlphaL, idHyphenL)), literalL(")"))
const idDeclL = seqL(firstL(idLetterL, idDeclFragmentL), repL(firstL(idAlphaL, idHyphenL, idDeclFragmentL)));

const boundVariableDP : P = tokenDP(identifierL, TokenType.bound_variable);
const freeVariableL : Lexer = seqL(optL(literalL("?")), identifierL)
const freeVariableDP : P = tokenDP(freeVariableL, TokenType.free_variable);

const spacesDP : P = tokenDP(spaces1L, TokenType.whitespace);
const optSpacesDP : P = optDP(spacesDP);
const whitespaceDP : P = rep1DP(tokenDP(spaces1L, TokenType.whitespace));
const optWhitespaceDP : P = repDP(tokenDP(spaces1L, TokenType.whitespace));
const invalidDP : P = debugDP("unknown", tokenDP(nonspaces1L, TokenType.invalid));
const invalidCharDP : P = debugDP("unknown", tokenDP(nonspaceL, TokenType.invalid));
const labelDP : P = seqDP(tokenDP(identifierL, TokenType.label), optSpacesDP, tokenDP(literalL(":"), TokenType.label_colon));
const abstractionDP : P = tokenDP(seqL(literalL("\\"), identifierL), TokenType.abstraction);
const abstractionDeclDP : P = tokenDP(seqL(literalL("\\"), idDeclL), TokenType.abstraction_declaration);
const freeT : P = tokenDP(seqL(literalL("?"), identifierL), TokenType.free_variable);
const roundOpenDP : P = tokenDP(literalL("("), TokenType.round_open);
const roundCloseDP : P = tokenDP(literalL(")"), TokenType.round_close);
const squareOpenDP : P = tokenDP(literalL("["), TokenType.square_open);
const squareCloseDP : P = tokenDP(literalL("]"), TokenType.square_close);
const dotDP : P = tokenDP(literalL("."), TokenType.dot);
const commaDP : P = tokenDP(literalL(","), TokenType.comma);


function termDP(binders : VarName[] = []) : P {
    return useDP((lines, state) => totalTermOfDP(lines, binders, state.termParser));
}

const boundArgsDP : P = seqDP(boundVariableDP, repDP(optWhitespaceDP, boundVariableDP), optSpacesDP, dotDP);

const templateDP : P = chainDP(optDP(boundArgsDP, spacesDP), 
    (lines : TextLines, state : ParseState, result : Result<SectionData, TokenType>) => {
        const boundVars = iterateContentTokens(result, t => t === TokenType.bound_variable);
        const varnames : VarName[] = [];
        const uivars : UIVar[] = [];
        for (const b of boundVars) {
            const name = textOfToken(lines, b);
            if (varnames.indexOf(name) >= 0) {
                const span = absoluteSpan(lines, spanOfResult(b));
                state.theory.error(span, "Duplicate binder '" + name + "'.");
            } else {
                varnames.push(name);
                uivars.push(mkUIVar(lines, b));
            }
        }
        return modifyResultDP(termDP(varnames), (lines : TextLines, term_result : DPResult<ParseState, SectionData, TokenType>) => {
            if (term_result === undefined) internalError("Term parser should be designed to always succeed.");
            if (term_result.result.kind === ResultKind.TREE && term_result.result.type?.type === SectionName.term) {
                const term = term_result.result.type.term;
                if (term !== undefined) {
                    const template = mkUITemplate(uivars, term);
                    return { state : term_result.state, result : joinResults([result, term_result.result], SectionDataTemplate(template)) };
                }
            }
            return { state : term_result.state, result : joinResults([result, term_result.result], SectionDataTemplate()) };
        });
    });

function allOfDP(type : TokenType) : P {
    return repDP(orDP(spacesDP, tokenDP(nonspaces1L, type)));
}
function anyOfDP(type : TokenType) : P {
    return rep1DP(orDP(spacesDP, tokenDP(nonspaces1L, type)));
}
function totalOfDP(parser?: P) : P {
    const skip = allOfDP(TokenType.invalid);
    if (parser === undefined) return skip;
    else return seqDP(parser, skip);
}

const markInvalidDP : P = orDP(
    seqDP(repDP(spacesDP), tokenDP(nonspaces1L, TokenType.invalid), allOfDP(TokenType.invalid)),
    seqDP(emptyDP(SectionDataTerm(SectionName.invalid)), repDP(spacesDP)));

function totalTermOfDP(lines : TextLines, binders : VarName[] = [], parser?: P) : P {
    if (parser === undefined) return allOfDP(TokenType.invalid);
    const termParser = parser;
    function parse(state : ParseState, lines : TextLines, line : number, offset : number) : DPResult<ParseState, SectionData, TokenType> {
        const termDPResult = termParser(state, lines, line, offset);
        if (termDPResult === undefined) return markInvalidDP(state, lines, line, offset);
        const termResult = termDPResult.result;
        if (termResult.kind === ResultKind.TREE && termResult.type?.type === SectionName.invalid) {
            const invalidDPResult = force(markInvalidDP(termDPResult.state, lines, termResult.endLine, termResult.endOffsetExclusive));
            const [endLine, endOffset] = endOf(invalidDPResult.result);
            const tree : Tree<SectionData, TokenType> = {
                kind: ResultKind.TREE,
                type: null,
                startLine: termResult.startLine,
                startOffsetInclusive: termResult.startOffsetInclusive,
                endLine: endLine,
                endOffsetExclusive: endOffset,
                children: [...termResult.children, invalidDPResult.result]
            }
            return { state : invalidDPResult.state, result : tree };
        } else {
            const uiterm = constructUITermFromResult(state.theory, lines, termResult);
            termResult.type = SectionDataTerm(SectionName.term, uiterm);
            if (uiterm) validateUITerm(state.theory, lines, uiterm, binders);
            return termDPResult;
        }
    }
    return parse;
}

function keyword(keyword : string) : P {
    const token : P = tokenDP(literalL(keyword), TokenType.primary_keyword);
    const identifierChar = firstL(alphaNumL, underscoreL, hyphenL);
    const cannotFollow : P = lookaheadInLineDP(identifierChar, false);
    return seqDP(token, cannotFollow);
}

function addTheoryName(lines : TextLines, result : R) : R {
    if (result === undefined) return undefined;
    for (const token of iterateTokensDeep(result.result)) {
        if (token.type === TokenType.module_name) {
            const span = spanOfResult(result.result);
            const name = SpanStr.fromToken(lines, token);
            result.state.theory.addTheoryName(span, name);
            return result;
        }
    }
    return result;
}

const theoryDP : P = keyword("theory");
const theoryNameDeclDP : P = tokenDP(identifierL, TokenType.module_name);
const theorySection : S = { bullet: theoryDP, body: totalOfDP(theoryNameDeclDP), type: SectionDataNone(SectionName.theory), 
    process : addTheoryName };

const commentDP : P = tokenDP(literalL("%"), TokenType.comment);
const commentBodyDP : P = allOfDP(TokenType.comment);
const commentSection : S = { bullet: commentDP, body: commentBodyDP, type: SectionDataNone(SectionName.comment) };

const errorDP : P = emptyDP();
const errorBodyDP : P = anyOfDP(TokenType.invalid);
const errorSection : S = { bullet: errorDP, body: errorBodyDP, type: SectionDataNone(SectionName.error) };

function varParserDP(head : Head) : P {
    const frees : Set<string> = new Set();
    const bounds : Set<string> = new Set();
    for (const b of head.bounds) bounds.add(b.str);
    for (const f of head.frees) frees.add(f[0].str);
    const sortedFrees = [...frees].sort((x,y) => y.length - x.length);
    const sortedBounds = [...bounds].sort((x,y) => y.length - x.length);
    const freeVarsParsers : P[] = sortedFrees.map(v => tokenDP(seqL(literalL("#"), optL(literalL("?")), literalL(v)), TokenType.free_variable));
    const freeVarParser : P = seqDP(orDP(...freeVarsParsers), optDP(syntacticSuffixDP));
    const boundVarsParsers : P[] = sortedBounds.map(v => tokenDP(literalL("#" + v), TokenType.bound_variable));
    const boundVarParser : P = orDP(...boundVarsParsers);
    return orDP(boundVarParser, freeVarParser);
}

function readSyntacticCategory(lines : TextLines, token : Token<TokenType>) : SpanStr | undefined {
    if (token.type !== TokenType.syntactic_category) return undefined;
    return readTokenAsName(lines, token).str;
}

function readSyntacticCategoryKeyword(lines : TextLines, token : Token<TokenType>) : { str : SpanStr, long : boolean } | undefined {
    if (token.type !== TokenType.syntactic_category_keyword) return undefined;
    const n = readTokenAsName(lines, token);
    return { str : n.str, long : n.stripped.length > 1 };
}

function addSyntacticConstraint(lines : TextLines, result : R) : R {
    if (result === undefined) return undefined;
    const theory = result.state.theory;
    let handle1 : Handle | undefined = undefined;
    let handle1IsHigher : boolean = true;
    let opSpan : Span | undefined = undefined;
    let loose = false;
    for (const token of iterateTokensFlat(result.result)) {
        if (token.type === TokenType.syntactic_category_atomic || token.type === TokenType.syntactic_category_term) {
            if (loose) {
                const span = spanOfResult(token);
                theory.error(absoluteSpan(lines, span), "Cannot be declared loose.");
            }
            const handle2 = token.type === TokenType.syntactic_category_atomic ? theory.SC_ATOMIC : theory.SC_TERM;
            if (handle1 !== undefined) {  
                if (handle1IsHigher) {
                    theory.addSyntacticCategoryPriority(opSpan!, handle1, handle2);
                } else {
                    theory.addSyntacticCategoryPriority(opSpan!, handle2, handle1);
                }
            }
            handle1 = handle2;
            continue;
        } 
        if (token.type === TokenType.loose) {
            loose = true;
            continue;
        }
        const sc = readSyntacticCategory(lines, token);
        if (sc !== undefined) {
            if (theory.lookupSyntacticCategory(sc.str) === undefined) {
                token.type = TokenType.syntactic_category_declaration;
            }
            const handle2 = theory.ensureSyntacticCategory(sc.span, sc.str, false, loose);
            if (handle1 !== undefined && handle2 !== undefined) {  
                if (handle1IsHigher) {
                    theory.addSyntacticCategoryPriority(opSpan!, handle1, handle2);
                } else {
                    theory.addSyntacticCategoryPriority(opSpan!, handle2, handle1);
                }
            }
            handle1 = handle2;
        } else {
            switch (token.type) {
                case TokenType.whitespace: break;
                case TokenType.syntactic_transitive_greater:
                    opSpan = spanOfResult(token);
                    handle1IsHigher = true;
                    loose = false;
                    break;
                case TokenType.syntactic_transitive_less:
                    opSpan = spanOfResult(token);
                    handle1IsHigher = false;
                    loose = false;
                    break;
                default:
                    throw new Error("Unexpected token of type: " + TokenType[token.type]);
            }
        }
    }
    return result;
}

function isntNameChar(c : string) : boolean {
    return c === "#" || c === "?" || c === tick || c === "\\";
}

function readTokenAsName<T>(lines : TextLines, token : Token<T>) : { str : SpanStr, stripped : string } {
    let text = textOfToken(lines, token);
    let stripped = "";
    while (text.length > 0 && isntNameChar(text.charAt(0))) {
        stripped += text.charAt(0);
        text = text.slice(1);
    }
    if (text.endsWith(tick)) text = text.slice(0, text.length - 1);
    return { str: new SpanStr(spanOfResult(token), text), stripped : stripped };
}

function readDeclarationHead(lines : TextLines, result : Result<SectionData, TokenType>) : Head | undefined {
    let tokens = [...iterateTokensFlat(result)];
    const count = tokens.length;
    function search(from : nat, to : nat, pred : (t: TokenType) => boolean) : int {
        for (let i = from; i < to; i++) {
            if (pred(tokens[i].type)) return i;
        }
        return -1;
    }
    function readName(i : int) : SpanStr | undefined {
        if (i < 0 || i >= count) return undefined;
        const s = readTokenAsName(lines, tokens[i]).str;
        if (s === undefined || s.str.length === 0) return undefined;
        return s;
    }
    if (count === 0) return undefined;
    function readBounds(from : int, to : int) : SpanStr[] {
        let bounds : SpanStr[] = [];
        let i = from;
        while (true) {
            const j = search(i, to, t => t === TokenType.bound_variable);
            const b = readName(j);
            if (b === undefined) return bounds;
            bounds.push(b);
            i = j + 1;
        }
    }
    let i = search(0, count, t => t === TokenType.abstraction_declaration);
    const abstraction = readName(i);
    if (abstraction === undefined) return undefined;
    i += 1;
    const dot = search(i, count, t => t === TokenType.dot);
    let bounds : SpanStr[] = [];
    if (dot >= 0) {
        bounds = readBounds(i, dot);
        i = dot + 1;
    }
    let frees : [SpanStr, SpanStr[]][] = [];
    while (true) {
        i = search(i, count, t => t === TokenType.free_variable)
        const free = readName(i);
        if (free === undefined) break;
        i += 1;
        if (i < count && tokens[i].type === TokenType.square_open) {
            const close = search(i + 1, count, t => t === TokenType.square_close);
            if (close < 0) internalError();
            const bounds = readBounds(i, count);
            frees.push([free, bounds]);
            i = close + 1;
        } else {
            frees.push([free, []]);
        }
    }
    return new Head(abstraction, bounds, frees);
}

function addDeclarationHead(lines : TextLines, result : R) : R {
    if (result === undefined) return undefined;
    const head = readDeclarationHead(lines, result.result);
    if (head === undefined) return undefined;
    const p = varParserDP(head);
    result.state.varParser = p;
    result.state.theory.startDeclaration(head);
    return result;
}
const tick = "`";
const syntacticCategoryAtomicDP : P = tokenDP(literalL("Atomic"), TokenType.syntactic_category_atomic); 
const syntacticCategoryTermDP : P = tokenDP(literalL("Term"), TokenType.syntactic_category_term); 
const looseDP : P = tokenDP(literalL("loose"), TokenType.loose);
const syntacticCategoryDP : P = tokenDP(seqL(literalL(tick), identifierL, optL(literalL(tick))), TokenType.syntactic_category); 
const syntacticCategoryKeywordDP : P = tokenDP(seqL(firstL(literalL(tick + tick), literalL(tick)), identifierL, optL(literalL(tick))), TokenType.syntactic_category_keyword); 
const syntacticCategoryDeclDP : P = seqDP(optDP(looseDP, optSpacesDP), orDP(syntacticCategoryAtomicDP, syntacticCategoryTermDP, tokenDP(seqL(literalL(tick), idDeclL), TokenType.syntactic_category))); 
const syntacticCategoryTransitiveGreaterDP : P = tokenDP(literalL(">"), TokenType.syntactic_transitive_greater);
const syntacticCategoryTransitiveLessDP : P = tokenDP(literalL("<"), TokenType.syntactic_transitive_less);
const syntacticCategoryComparatorDP : P = orDP(
    syntacticCategoryTransitiveGreaterDP,
    syntacticCategoryTransitiveLessDP);    
const syntacticCategoryConstraintDP : P = seqDP(syntacticCategoryDeclDP, repDP(optWhitespaceDP, syntacticCategoryComparatorDP, optWhitespaceDP, syntacticCategoryDeclDP));
const syntacticCategorySection : S = { bullet : modifyResultDP(syntacticCategoryConstraintDP, addSyntacticConstraint), body : totalOfDP(emptyDP()), type : SectionDataNone(SectionName.syntactic_category) };

const syntacticSuffixDP : P = orDP(syntacticCategoryDP, tokenDP(literalL(tick), TokenType.syntactic_category));
const syntacticSuffixKeywordDP : P = orDP(syntacticCategoryKeywordDP, tokenDP(firstL(literalL(tick + tick), literalL(tick)), TokenType.syntactic_category_keyword));
const fragment_nonhashDP : P = tokenDP(charsL(c => c !== " " && c !== "#"), TokenType.syntax_fragment);
function nontrailing_spaces(minimum : number) : Lexer {
    return seqL(charsL(c => c === " ", minimum), lookaheadL(anyCharL));
}

const fragment_optional_space : P = tokenDP(nontrailing_spaces(1), TokenType.syntax_optional_space);
const fragment_mandatory_space : P = tokenDP(nontrailing_spaces(2), TokenType.syntax_mandatory_space);
const fragment_newline : P = newlineDP(SectionDataNone(SectionName.newline));
const fragment_space : P = orDP(fragment_newline, fragment_mandatory_space, fragment_optional_space, whitespaceDP);
const syntaxFragmentsDP : P = orDP(fragment_space, useDP(varParserOf), fragment_nonhashDP,  tokenDP(anyCharL, TokenType.syntax_fragment));
const syntaxBulletDP : P = seqDP(syntacticSuffixKeywordDP, lookaheadInLineDP(nonspaceL, false));
const syntaxSection : S = { bullet: syntaxBulletDP, body: repDP(syntaxFragmentsDP), type: SectionDataNone(SectionName.syntax) }; 

const inlineLatexBulletDP : P = seqDP(tokenDP(literalL("$"), TokenType.secondary_keyword), optDP(syntacticSuffixDP), lookaheadInLineDP(nonspaceL, false));
const displayLatexBulletDP : P = seqDP(tokenDP(literalL("$$"), TokenType.secondary_keyword), optDP(syntacticSuffixDP), lookaheadInLineDP(nonspaceL, false));

const latexControlSymbolL : Lexer = seqL(literalL("\\"), anyCharL);
const latexControlWordL : Lexer = seqL(literalL("\\"), rep1L(letterL));
const latexControlSequence : P = tokenDP(firstL(latexControlWordL, latexControlSymbolL), TokenType.latex_control_sequence);
const latexSpace : P = tokenDP(spaces1L, TokenType.latex_space);
const latexSyntax : P = tokenDP(nonspaceL, TokenType.latex_syntax);
const latexInvalid : P = tokenDP(literalL("#"), TokenType.invalid);
const latexSpec : P = repDP(orDP(newlineDP(SectionDataNone(SectionName.newline)), useDP(varParserOf), latexControlSequence, latexSpace, latexInvalid, latexSyntax));

const inlineLatexSection : S = { bullet : inlineLatexBulletDP, body : latexSpec, type : SectionDataNone(SectionName.inline_latex) };
const displayLatexSection : S = { bullet : displayLatexBulletDP, body : latexSpec, type : SectionDataNone(SectionName.display_latex) };

const definitionBulletDP : P = seqDP(tokenDP(literalL("="), TokenType.primary_keyword),  lookaheadInLineDP(nonspaceL, false));
const definitionSection : S = { bullet : definitionBulletDP, body : termDP(), type : SectionDataNone(SectionName.definition) };

function varParserOf(lines : TextLines, state : ParseState) : P {
    return force(state.varParser);
}

function isSyntacticCategory(t : TokenType) : boolean {
    return t === TokenType.syntactic_category || t === TokenType.syntactic_category_atomic || t === TokenType.syntactic_category_term;
}

function usesBuiltInCategory(lines : TextLines, results : Result<SectionData, TokenType>[]) : boolean {
    const category = force(readSyntacticCategoryKeyword(lines, results[0] as Token<TokenType>)).str;
    return category.str === "";
}

function readSyntaxSpec(lines : TextLines, results : Result<SectionData, TokenType>[]) : SyntaxSpec | undefined {
    const category = force(readSyntacticCategoryKeyword(lines, results[0] as Token<TokenType>));
    let fragments : SyntaxFragment[] = [];
    let i = 1;
    while (i < results.length) {
        if (results[i].kind === ResultKind.TREE) {
            i += 1;
            fragments.push({ kind: SyntaxFragmentKind.optional_whitespace });
            continue;
        }
        const type = results[i].type;
        switch (type) {
            case TokenType.syntax_optional_space:
                i += 1;
                fragments.push({ kind: SyntaxFragmentKind.optional_whitespace });
                break;
            case TokenType.syntax_mandatory_space:
                i += 1;
                fragments.push({ kind: SyntaxFragmentKind.mandatory_whitespace });
                break;
            case TokenType.free_variable: {
                const s = force(readTokenAsName(lines, results[i] as Token<TokenType>).str);
                i += 1;
                if (i < results.length && results[i].kind === ResultKind.TOKEN && isSyntacticCategory(results[i].type as TokenType)) {
                    const sc = force(readTokenAsName(lines, results[i] as Token<TokenType>).str);
                    fragments.push({ kind: SyntaxFragmentKind.free_variable, name: s, syntactic_category: sc });
                    i += 1;
                } else {
                    fragments.push({ kind: SyntaxFragmentKind.free_variable, name: s, syntactic_category: undefined });                
                }
                break;
            }
            case TokenType.bound_variable: {
                const s = force(readTokenAsName(lines, results[i] as Token<TokenType>).str);
                fragments.push({ kind: SyntaxFragmentKind.bound_variable, name: s });                
                i += 1;
                break;
            }
            case TokenType.syntax_fragment: {
                const s = SpanStr.fromToken(lines, results[i] as Token<TokenType>);
                fragments.push({ kind: SyntaxFragmentKind.text, text: s });                
                i += 1;   
                break;  
            }           
            case TokenType.whitespace: 
                i += 1;
                break;
            default:
                throw new Error("Unexpected result of type " + type);

        }
    }
    return new SyntaxSpec(category.str, category.long, fragments);
}

function processDeclaration(lines : TextLines, result : R) : R {
    if (result === undefined) return undefined;   
    if (!result.state.theory.hasCurrent) return result;
    let usesBuiltIn = false;
    for (const section of iterateContentSections(result.result)) {
        if (section.kind === ResultKind.TREE && section.type?.type === SectionName.syntax) {
            if (usesBuiltInCategory(lines, [...iterateResultsDeep(s => s && s.type === SectionName.newline, section)]))
                usesBuiltIn = true;
        } 
    }
    if (usesBuiltIn) { 
        result.state.theory.ensureSyntacticCategoryOfDeclaration();
    }
    for (const section of iterateContentSections(result.result)) {
        if (section.kind === ResultKind.TREE && section.type?.type === SectionName.syntax) {
            const spec = readSyntaxSpec(lines, [...iterateResultsDeep(s => s && s.type === SectionName.newline, section)]);
            if (spec === undefined) return undefined;
            result.state.theory.addSyntaxSpec(spec);
        } else if (section.kind === ResultKind.TREE && section.type?.type === SectionName.definition) {
            const terms = [...iterateContentSections(section, s => s.type === SectionName.term)];
            if (terms.length === 1) {
                const term = terms[0].type as SectionDataTerm;
                if (term.term && term.term.freeVars) {
                    result.state.theory.addDefinition(lines, term.term);
                }
            }
        }
    }
    result.state.theory.endDeclaration();     
    return result;
}

const boundParamsDP : P = seqDP(boundVariableDP, repDP(optWhitespaceDP, commaDP, optWhitespaceDP, boundVariableDP));
const freeArgDP : P = seqDP(freeVariableDP, optDP(squareOpenDP, optDP(optWhitespaceDP, boundParamsDP), optWhitespaceDP, squareCloseDP));
const declarationDP : P = seqDP(abstractionDeclDP, optDP(optWhitespaceDP, boundArgsDP), repDP(optWhitespaceDP, freeArgDP));
const declarationBody = enumDP(definitionSection, syntaxSection, inlineLatexSection, displayLatexSection, commentSection, errorSection)
const declarationSection : S = { bullet : modifyResultDP(declarationDP, addDeclarationHead), 
    body: declarationBody, type: SectionDataNone(SectionName.declaration), process: processDeclaration};

function readLabel(lines : TextLines, result : Result<SectionData, TokenType>) : SpanStr | undefined {
    const labels = [...iterateContentTokens(result, t => t === TokenType.label)];
    let label : SpanStr | undefined = undefined;
    if (labels.length === 1) {
        const span = absoluteSpan(lines, spanOfResult(labels[0]));
        const text =  textOfToken(lines, labels[0]);
        label = new SpanStr(span, text);
    } 
    return label;
}
function processPremise(lines : TextLines, result : R) : R {
    if (result === undefined) return undefined;
    const label = readLabel(lines, result.result);
    const sections = [...iterateContentSections(result.result, s => s.type === SectionName.template)];
    let template : UITemplate | undefined = undefined;
    if (sections.length === 1) {
        const section = sections[0];
        template = (section.type as SectionDataTemplate).template;
    }
    result.result.type = SectionDataPremise(label, template);
    return result;
}
function processConclusion(lines : TextLines, result : R) : R {
    if (result === undefined) return undefined;
    const label = readLabel(lines, result.result);
    const sections = [...iterateContentSections(result.result, s => s.type === SectionName.term)];
    let term : UITerm | undefined = undefined;
    if (sections.length === 1) {
        const section = sections[0];
        term = (section.type as SectionDataTerm).term;
    }
    result.result.type = SectionDataConclusion(label, term);
    return result;
}
const rulePremiseSection : S = { bullet : seqDP(tokenDP(literalL("premise"), TokenType.premise), optDP(spacesDP, labelDP)), body : templateDP, type : null, process: processPremise};
const ruleInferSection : S = { bullet : optDP(seqDP(tokenDP(literalL("infer"), TokenType.infer), optDP(spacesDP, labelDP))), body : termDP(), type : null, process: processConclusion };
const ruleDP : P = modifyResultDP(enumDP(rulePremiseSection, ruleInferSection), (lines, result) => {
    if (result === undefined) return undefined;
    const premisses = iterateContentSections(result.result, s => s.type === SectionName.premise);
    const conclusions = iterateContentSections(result.result, s => s.type === SectionName.conclusion);
    let ps : { label : SpanStr | undefined, premise : UITemplate }[] = [];
    let cs : { label : SpanStr | undefined, conclusion : UITerm }[] = [];
    for (const premise of premisses) {
        const p = premise.type as SectionDataPremise;
        if (p.premise) 
            ps.push({label : p.label, premise : p.premise});
    }
    for (const conclusion of conclusions) {
        const c = conclusion.type as SectionDataConclusion;
        if (c.conclusion)
            cs.push({label : c.label, conclusion : c.conclusion});
    }
    const rule = mkUIRule(ps, cs);
    result.result.type = SectionDataRule(rule);
    return result;
});

function processAxiom(lines : TextLines, result : R) : R {
    if (result === undefined) return undefined;
    const label = readLabel(lines, result.result);
    const rules = [...iterateContentSections(result.result, s => s.type === SectionName.rule)];
    if (rules.length === 1) {
        result.state.theory.addAxiom(label, (rules[0].type as SectionDataRule).rule);
    }
    return result;
}
const axiomDP : P = seqDP(keyword("axiom"), optDP(spacesDP, labelDP));
const axiomSection : S = { bullet: axiomDP, body: ruleDP, type: SectionDataNone(SectionName.axiom), process: processAxiom };

export const practaliumDP : P = enumDP(syntacticCategorySection, commentSection, theorySection, axiomSection, declarationSection, errorSection);




