import * as vscode from 'vscode';
import { registerLanguageTokenizer } from './parser_bridge.js';
import { TextLines } from './pyramids/textlines.js';
import { iterateTokensDeep, Result, ResultKind, textOfToken, Token } from './pyramids/deterministic_parser.js';
import { ALL_TOKEN_TYPES, practaliumDP, ParseState, TokenType, SectionData, SectionName } from './practalium_parser.js';
import { assertNever } from './things/utils.js';
import { configureDebugging, debug } from './things/debug.js';
import { config } from 'process';
import { Diagnoses, Diagnosis, Severity, Theory } from './theory.js';
import { Span, spanOfResult } from './pyramids/span.js';
import { generateCustomGrammar } from './term_parser.js';
import { nat } from './things/primitives.js';

function semantics(type : TokenType) : [string, string[]] | undefined {
    switch (type) {
        case TokenType.module_name : return ["practal-module-name", []];
        case TokenType.unknown_id:
        case TokenType.value_id:
        case TokenType.operation_id:
        case TokenType.operator_id:    
        case TokenType.abstraction : return ["practal-abstraction", []];
        case TokenType.identifier : return ["practal-identifier", []];
        case TokenType.custom_syntax : return ["practal-custom-syntax", []];
        case TokenType.syntactic_category : return ["practal-syntactic-category", []];
        case TokenType.syntactic_category_keyword : return ["practal-syntactic-category-keyword", []];        
        //case TokenType.identifierDecl : return ["practal-identifier", ["declaration"]];
        case TokenType.invalid : return ["practal-invalid", []];
        case TokenType.whitespace : return undefined;
        case TokenType.primary_keyword : return ["practal-primary-keyword", []];
        case TokenType.secondary_keyword : return ["practal-secondary-keyword", []];
        case TokenType.free_variable : return ["practal-free-variable", []];
        case TokenType.bound_variable : return ["practal-bound-variable", []];
        case TokenType.variable : return ["practal-variable", []];
        case TokenType.comment : return ["practal-comment", []];
        case TokenType.label : return ["practal-label", []];
        case TokenType.label_colon : return ["practal-label", []];      
        case TokenType.round_open : return ["practal-round-braces", []]; 
        case TokenType.round_close : return ["practal-round-braces", []]; 
        case TokenType.square_open : return ["practal-square-braces", []];
        case TokenType.square_close : return ["practal-square-braces", []];
        case TokenType.dot : return ["practal-punctuation", []];
        case TokenType.comma : return ["practal-punctuation", []];
        //case TokenType.quick_syntax: return ["practal-syntax", []];
        case TokenType.syntactic_less: return ["practal-syntactic-comparator", []];
        case TokenType.syntactic_greater: return ["practal-syntactic-comparator", []];
        case TokenType.syntactic_transitive_less: return ["practal-syntactic-comparator", []];
        case TokenType.syntactic_transitive_greater: return ["practal-syntactic-comparator", []];
        case TokenType.syntactic_eq: return ["practal-syntactic-comparator", []];
        case TokenType.syntax_fragment: return ["practal-syntax-fragment", []];
        case TokenType.syntax_optional_space: return ["practal-syntax-optional-space", []];
        case TokenType.syntax_mandatory_space: return ["practal-syntax-mandatory-space", []];
        case TokenType.latex_control_sequence: return ["practal-latex-control-sequence", []];
        case TokenType.latex_space: return ["practal-latex-space", []];
        case TokenType.latex_syntax: return ["practal-latex-syntax", []];
        default : assertNever(type);  //return ["practal-invalid", []];
    }
}

function diagnose(theory : Theory, lines : TextLines, diagnoses : Diagnosis[], result : Result<SectionData, TokenType>) {

    function diag(result : Result<SectionData, TokenType>) {
        const kind = result.kind;
        switch (kind) {
            case ResultKind.TOKEN: 
                if (result.type === TokenType.syntactic_category_keyword || result.type === TokenType.syntactic_category) {
                    const text = textOfToken(lines, result).slice(1);
                    if (text !== "" && theory.lookupSyntacticCategory(text) === undefined) {
                        diagnoses.push(new Diagnosis(spanOfResult(result), Severity.ERROR, "Unknown syntactic category."));    
                    }            
                }
                break;
            case ResultKind.TREE: 
                if (result.type && result.type.type === SectionName.invalid) {
                    //debug("result = " + result.startLine + ", " + result.startOffsetInclusive + ", " + result.endLine + ", " + result.endOffsetExclusive);
                    if (nat.is(result.endOffsetExclusive) && nat.is(result.startOffsetInclusive)) // no idea where this is coming from
                        diagnoses.push(new Diagnosis(spanOfResult(result), Severity.ERROR, "Invalid syntax."));
                } else {
                    if (result.type !== undefined) {
                        for (const child of result.children) diag(child);
                    }
                }
                break;
            default: assertNever(kind);
        }
    }

    diag(result);
}

function tokenizer(lines : TextLines) : [Iterable<Token<TokenType>>, Iterable<Diagnosis>] {

    //const termParser = generateCustomGrammar(thy).parser;
    const parsed1 = practaliumDP({theory : Theory.mk(lines), varParser : undefined, termParser : undefined}, lines, 0, 0);
    if (parsed1 === undefined) return [[], []];
    const termParser = generateCustomGrammar(parsed1.state.theory);
    const parsed = practaliumDP({theory : Theory.mk(lines), varParser : undefined, termParser : termParser.parser}, lines, 0, 0);
    if (parsed === undefined) return [[], []];
    const tokens = [...iterateTokensDeep(parsed.result)];
    const diagnoses = parsed.state.theory.diagnoses;
    const conflicts = termParser.syntactic_categories_with_Conflicts;
    const sc_infos = parsed.state.theory.syntacticCategories;
    for (const sc of conflicts) {
        if (sc !== null) {
            const span = sc_infos[sc].decl.span;
            diagnoses.push(new Diagnosis(span, Severity.WARNING, "This syntactic category has conflicting syntax elements leading to problems."));
        } else {
            diagnoses.push(new Diagnosis(new Span(0, 0, 0, 0), Severity.WARNING, "The syntax definition contains conflicting elements, causing issues."));
        }
    }
    for (const token of tokens) {
        if (token.type === TokenType.invalid) {
            const chars = [...textOfToken(lines, token)];
            const msg = "Syntax error.";
            const diagnosis = new Diagnosis(spanOfResult(token), Severity.ERROR, msg);
            diagnoses.push(diagnosis);
        }
    }
    diagnose(parsed.state.theory, lines, diagnoses, parsed.result);
    return [tokens, diagnoses];
}

//registerLanguageTokenizer("practal", tokenizer, ALL_TOKEN_TYPES, semantics);

export function activate(context: vscode.ExtensionContext) {
    const output = vscode.window.createOutputChannel("Practal");
    configureDebugging((s : string) => output.appendLine(s));
    registerLanguageTokenizer("practal", tokenizer, ALL_TOKEN_TYPES, semantics);
    debug("Practal Core v0.0.1");
    debug("©︎ 2023 Steven Obua (trading as Recursive Mind)");
    debug("Check https://practal.com for information and updates."); 
    debug("--------------------------------------------------------------------");
    /*const state = context.globalState
    const installed = state.get("practalium.installed");
    if (installed) {
        output.appendLine("Practalium is already installed.");
        state.update("practalium.installed", undefined);    
    } else {
        output.appendLine("Installing Practalium ...");
        //state.update("practalium.installed", true);
        const config = vscode.workspace.getConfiguration("", { languageId: "practalium" }); 
        //config.update("editor.fontFamily", "STIXGeneral", true, true);
        //const fontSize = config.get("editor.fontSize");
        //config.update("editor.fontSize", 14, true, true);        
    }  */
}

