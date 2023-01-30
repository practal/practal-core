import { SemanticTokens } from "vscode";
import { debugDP, DetParser, DPResult, emptyDP, enumDP, iterateTokensDeep, lookaheadInLineDP, optDP, orDP, rep1DP, repDP, Section, sectionDP, seqDP, textOfToken, tokenDP, modifyDP, useDP, newlineDP, modifyResultDP, Token, iterateTokensFlat, printResult, Result, ResultKind, iterateContentSections, iterateResultsDeep } from "./pyramids/deterministic_parser";
import { alphaNumL, anyCharL, charL, charsL, firstL, hyphenL, letterL, Lexer, literalL, lookaheadL, nonspaceL, nonspaces1L, nonspacesL, optL, rep1L, repL, seqL, spaces1L, underscoreL } from "./pyramids/lexer";
import { Span, spanOfResult, SpanStr } from "./pyramids/span";
import { TextLines } from "./pyramids/textlines";
import { Handle, Head, SyntaxFragment, SyntaxFragmentKind, SyntaxSpec, Theory } from "./theory";
import { debug } from "./things/debug";
import { int, nat } from "./things/primitives";
import { assertTrue, force, internalError, notImplemented } from "./things/utils";

export enum TokenType {
    module_name,
    primary_keyword,
    secondary_keyword,
    label,
    label_colon,
    identifier,
    syntactic_category,
    syntactic_category_keyword,
    free_variable,
    bound_variable,
    variable,
    abstraction,
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
    syntactic_less,
    syntactic_eq,
    syntactic_greater,
    syntactic_transitive_less,
    syntactic_transitive_greater,
    syntax_fragment,
    syntax_optional_space,
    syntax_mandatory_space,
    latex_control_sequence,
    latex_syntax,
    latex_space,
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

    // Terms
    operation_app,
    operator_app,
    var_app,
    brackets,
    invalid,
    custom

}

export type SectionData = SectionDataNone

export type SectionDataNone = {
    type : SectionName
}

export function SectionDataNone(ty : SectionName) : SectionDataNone {
    return { type : ty };
}

export type ParseState = {

    theory : Theory

    varParser : P | undefined

    termParser : P | undefined

}

export type VarSet = Set<string>

export type P = DetParser<ParseState, SectionData, TokenType>
export type S = Section<ParseState, SectionData, TokenType>
export type R = DPResult<ParseState, SectionData, TokenType>

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

const identifierDP : P = debugDP("identifier", tokenDP(identifierL, TokenType.identifier));
//const identifierDeclDP : P = tokenDP(idDeclL, TokenType.identifierDecl); 

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
const abstractionDeclDP : P = tokenDP(seqL(literalL("\\"), idDeclL), TokenType.abstraction);
const freeT : P = tokenDP(seqL(literalL("?"), identifierL), TokenType.free_variable);
const roundOpenDP : P = tokenDP(literalL("("), TokenType.round_open);
const roundCloseDP : P = tokenDP(literalL(")"), TokenType.round_close);
const squareOpenDP : P = tokenDP(literalL("["), TokenType.square_open);
const squareCloseDP : P = tokenDP(literalL("]"), TokenType.square_close);
const dotDP : P = tokenDP(literalL("."), TokenType.dot);
const commaDP : P = tokenDP(literalL(","), TokenType.comma);
const symbolsDP : P = orDP(roundOpenDP, roundCloseDP, squareOpenDP, squareCloseDP, dotDP);

function cheatDP(chars : (c : string) => boolean, type : TokenType) : P {
    return tokenDP(charL(chars), type);
}

const cheatFreeDP = cheatDP(c => c >= "A" && c <= "Z", TokenType.free_variable);
const cheatIdDP = cheatDP(c => c >= "a" && c <= "z", TokenType.bound_variable);
const cheatSyntaxDP = cheatDP(c => true, TokenType.syntax_fragment); 

const termDP : P = useDP((lines, state) => totalOfDP(state.termParser));

//repDP(orDP(spacesDP, symbolsDP, abstractionDP, cheatFreeDP, cheatIdDP, cheatSyntaxDP, invalidCharDP))

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

const axiomDP : P = seqDP(keyword("axiom"), optDP(spacesDP, labelDP));
const axiomSection : S = { bullet: axiomDP, body: termDP, type: SectionDataNone(SectionName.axiom) };

const errorDP : P = emptyDP();
const errorBodyDP : P = anyOfDP(TokenType.invalid);
const errorSection : S = { bullet: errorDP, body: errorBodyDP, type: SectionDataNone(SectionName.error) };

const placeHolderBodyDP : P = repDP(tokenDP(anyCharL, TokenType.whitespace));

/*function pushVars(lines : TextLines, result : R) : R {
    if (result === undefined) return undefined;
    const r = result.result;
    const frees : VarSet = new Set();
    const bounds : VarSet = new Set();
    for (const t of iterateTokensDeep(r)) {
        if (t.type === TokenType.free_variable) {
            const text = normalizeVar(textOfToken(lines, t));
            frees.add(text);
        }
        if (t.type === TokenType.bound_variable) {
            const text = normalizeVar(textOfToken(lines, t));
            bounds.add(text);
        }
    }
    const sortedFrees = [...frees].sort((x,y) => y.length - x.length);
    const sortedBounds = [...bounds].sort((x,y) => y.length - x.length);
    const freeVarsParsers : P[] = sortedFrees.map(v => tokenDP(seqL(literalL("#"), optL(literalL("?")), literalL(v)), TokenType.free_variable));
    const freeVarParser : P = seqDP(orDP(...freeVarsParsers), optDP(syntacticSuffixDP));
    const boundVarsParsers : P[] = sortedBounds.map(v => tokenDP(literalL("#" + v), TokenType.bound_variable));
    const boundVarParser : P = orDP(...boundVarsParsers);
    const varParser : P = orDP(boundVarParser, freeVarParser);
    result.state.varParser = varParser;
    return result;
}*/

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
    return readTokenAsName(lines, token);
}

function readSyntacticCategoryKeyword(lines : TextLines, token : Token<TokenType>) : SpanStr | undefined {
    if (token.type !== TokenType.syntactic_category_keyword) return undefined;
    return readTokenAsName(lines, token);
}

function addSyntacticConstraint(lines : TextLines, result : R) : R {
    if (result === undefined) return undefined;
    const theory = result.state.theory;
    let handle1 : Handle | undefined = undefined;
    let handle1IsHigher : boolean | undefined = undefined;
    let transitive : boolean = false;
    let opSpan : Span | undefined = undefined;
    for (const token of iterateTokensFlat(result.result)) {
        const sc = readSyntacticCategory(lines, token);
        if (sc !== undefined) {
            //const span = spanOfResult(token);
            const handle2 = theory.ensureSyntacticCategory(sc.span, sc.str, false);
            if (handle1 !== undefined && handle2 !== undefined) {  
                if (handle1IsHigher === undefined) {  
                    theory.addSyntacticCategoryEquality(opSpan!, handle1, handle2);
                } else if (handle1IsHigher) {
                    theory.addSyntacticCategoryPriority(opSpan!, handle1, handle2, transitive);
                } else {
                    theory.addSyntacticCategoryPriority(opSpan!, handle2, handle1, transitive);
                }
            }
            handle1 = handle2;
        } else {
            switch (token.type) {
                case TokenType.whitespace: break;
                case TokenType.syntactic_eq:
                    opSpan = spanOfResult(token);
                    handle1IsHigher = undefined;
                    break;
                case TokenType.syntactic_greater:
                    opSpan = spanOfResult(token);
                    handle1IsHigher = true;
                    transitive = false;
                    break;
                case TokenType.syntactic_transitive_greater:
                    opSpan = spanOfResult(token);
                    handle1IsHigher = true;
                    transitive = true;
                    break;
                case TokenType.syntactic_less:
                    opSpan = spanOfResult(token);
                    handle1IsHigher = false;
                    transitive = false;
                    break;
                case TokenType.syntactic_transitive_less:
                    opSpan = spanOfResult(token);
                    handle1IsHigher = false;
                    transitive = true;
                    break;
                default:
                    throw new Error("Unexpected token of type: " + TokenType[token.type]);
            }
        }
    }
    return result;
}

function isntNameChar(c : string) : boolean {
    return c === "#" || c === "?" || c === "'" || c === "\\";
}

function readTokenAsName<T>(lines : TextLines, token : Token<T>) : SpanStr {
    let text = textOfToken(lines, token);
    while (text.length > 0 && isntNameChar(text.charAt(0))) text = text.slice(1);
    if (text.endsWith("'")) text = text.slice(0, text.length - 1);
    return new SpanStr(spanOfResult(token), text);
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
        const s = readTokenAsName(lines, tokens[i]);
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
    let i = search(0, count, t => t === TokenType.abstraction);
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

function endDeclaration(lines : TextLines, result : R) : R {
    if (result === undefined) return undefined;
    result.state.theory.endDeclaration();
    return result;
}

const syntacticCategoryDP : P = seqDP(tokenDP(seqL(literalL("'"), identifierL, optL(literalL("'"))), TokenType.syntactic_category)); 
const syntacticCategoryKeywordDP : P = seqDP(tokenDP(seqL(literalL("'"), identifierL, optL(literalL("'"))), TokenType.syntactic_category_keyword)); 
const syntacticCategoryDeclDP : P = seqDP(tokenDP(seqL(literalL("'"), idDeclL), TokenType.syntactic_category)); 
const syntacticCategoryTransitiveGreaterDP : P = tokenDP(literalL(">"), TokenType.syntactic_transitive_greater);
const syntacticCategoryTransitiveLessDP : P = tokenDP(literalL("<"), TokenType.syntactic_transitive_less);
const syntacticCategoryGreaterDP : P = tokenDP(firstL(literalL("⪫"), literalL("->")), TokenType.syntactic_greater);
const syntacticCategoryLessDP : P = tokenDP(firstL(literalL("⪪"), literalL("<-")), TokenType.syntactic_less);
const syntacticCategoryEqDP : P = tokenDP(literalL("="), TokenType.syntactic_eq);
const syntacticCategoryComparatorDP : P = orDP(
    syntacticCategoryGreaterDP,
    syntacticCategoryLessDP,
    syntacticCategoryTransitiveGreaterDP,
    syntacticCategoryTransitiveLessDP,
    syntacticCategoryEqDP);    
const syntacticCategoryConstraintDP : P = seqDP(syntacticCategoryDeclDP, repDP(optWhitespaceDP, syntacticCategoryComparatorDP, optWhitespaceDP, syntacticCategoryDeclDP));
const syntacticCategorySection : S = { bullet : modifyResultDP(syntacticCategoryConstraintDP, addSyntacticConstraint), body : totalOfDP(emptyDP()), type : SectionDataNone(SectionName.syntactic_category) };

const syntacticSuffixDP : P = orDP(syntacticCategoryDP, tokenDP(literalL("'"), TokenType.syntactic_category));
const syntacticSuffixKeywordDP : P = orDP(syntacticCategoryKeywordDP, tokenDP(literalL("'"), TokenType.syntactic_category_keyword));
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
const definitionSection : S = { bullet : definitionBulletDP, body : termDP, type : SectionDataNone(SectionName.definition) };

function varParserOf(lines : TextLines, state : ParseState) : P {
    return force(state.varParser);
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
                const s = force(readTokenAsName(lines, results[i] as Token<TokenType>));
                i += 1;
                if (i < results.length && results[i].kind === ResultKind.TOKEN && results[i].type === TokenType.syntactic_category) {
                    const sc = force(readTokenAsName(lines, results[i] as Token<TokenType>));
                    fragments.push({ kind: SyntaxFragmentKind.free_variable, name: s, syntactic_category: sc });
                    i += 1;
                } else {
                    fragments.push({ kind: SyntaxFragmentKind.free_variable, name: s, syntactic_category: undefined });                
                }
                break;
            }
            case TokenType.bound_variable: {
                const s = force(readTokenAsName(lines, results[i] as Token<TokenType>));
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
    return new SyntaxSpec(category, fragments);
}

function processDeclaration(lines : TextLines, result : R) : R {
    if (result === undefined) return undefined;   
    if (!result.state.theory.hasCurrent) return result;
    for (const section of iterateContentSections(result.result)) {
        if (section.kind === ResultKind.TREE && section.type?.type === SectionName.syntax) {
            const spec = readSyntaxSpec(lines, [...iterateResultsDeep(s => s && s.type === SectionName.newline, section)]);
            if (spec === undefined) return undefined;
            result.state.theory.addSyntaxSpec(spec);
        }
    }
    result.state.theory.endDeclaration();     
    return result;
}

const boundArgsDP : P = seqDP(boundVariableDP, repDP(optWhitespaceDP, boundVariableDP), optSpacesDP, dotDP);
const boundParamsDP : P = seqDP(boundVariableDP, repDP(optWhitespaceDP, commaDP, optWhitespaceDP, boundVariableDP));
const freeArgDP : P = seqDP(freeVariableDP, optDP(squareOpenDP, optDP(optWhitespaceDP, boundParamsDP), optWhitespaceDP, squareCloseDP));
const declarationDP : P = seqDP(abstractionDeclDP, optDP(optWhitespaceDP, boundArgsDP), repDP(optWhitespaceDP, freeArgDP));
//const declarationArgsDP : P = seqDP(optDP(boundArgsDP), repDP(optWhitespaceDP, freeArgDP));
//const declarationBodySection : S = { bullet : declarationArgsDP, body : enumDP(commentSection, errorSection), type : undefined };
//const declarationBodyDP : P = sectionDP(declarationBodySection);  //seqDP(declarationArgsDP, enumDP(commentSection, errorSection));
//const quickSyntaxBulletDP : P = seqDP(tokenDP(literalL(":"), TokenType.secondary_keyword), lookaheadInLineDP(nonspaceL, false));
//const quickSyntaxBodyDP : P = repDP(tokenDP(nonspaces1L, TokenType.quick_syntax), optWhitespaceDP);
//const quickSyntaxSection : S = { bullet : quickSyntaxBulletDP, body : totalOfDP(quickSyntaxBodyDP), type : SectionName.quick_syntax };
const declarationBody = enumDP(definitionSection, syntaxSection, inlineLatexSection, displayLatexSection, commentSection, errorSection)
const declarationSection : S = { bullet : modifyResultDP(declarationDP, addDeclarationHead), 
    body: declarationBody, type: SectionDataNone(SectionName.declaration), process: processDeclaration};

export const practaliumDP : P = enumDP(syntacticCategorySection, commentSection, theorySection, axiomSection, declarationSection, errorSection);




