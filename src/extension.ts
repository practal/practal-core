import * as vscode from 'vscode';
import { registerLanguageTokenizer } from './parser_bridge.js';
import { TextLines } from './pyramids/textlines.js';
import { iterateTokensDeep, Result, ResultKind, textOfToken, Token } from './pyramids/deterministic_parser.js';
import { ALL_TOKEN_TYPES, practaliumDP, ParseState, TokenType, SectionData, SectionName } from './practalium_parser.js';
import { assertNever } from './things/utils.js';
import { configureDebugging, debug } from './things/debug.js';
import { config } from 'process';
import { Diagnoses, Diagnosis, Severity, UITheory } from './uitheory.js';
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
        case TokenType.abstraction_declaration : return ["practal-abstraction-declaration", []];
        case TokenType.identifier : return ["practal-identifier", []];
        case TokenType.custom_syntax : return ["practal-custom-syntax", []];
        case TokenType.syntactic_category : return ["practal-syntactic-category", []];
        case TokenType.syntactic_category_term : return ["practal-syntactic-category-keyword", []];
        case TokenType.syntactic_category_atomic : return ["practal-syntactic-category-keyword", []];
        case TokenType.loose: return ["practal-secondary-keyword", []];
        case TokenType.syntactic_category_keyword : return ["practal-syntactic-category-keyword", []];        
        case TokenType.syntactic_category_declaration : return ["practal-syntactic-category-declaration", []];
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
        case TokenType.label_expr : return ["practal-label-expr", []];
        case TokenType.thm_expr_punctuation : return ["practal-secondary-keyword", []];
        case TokenType.label_colon : return ["practal-label", []];      
        case TokenType.round_open : return ["practal-round-braces", []]; 
        case TokenType.round_close : return ["practal-round-braces", []]; 
        case TokenType.square_open : return ["practal-square-braces", []];
        case TokenType.square_close : return ["practal-square-braces", []];
        case TokenType.dot : return ["practal-punctuation", []];
        case TokenType.comma : return ["practal-punctuation", []];
        case TokenType.premise : return ["practal-secondary-keyword", []];
        case TokenType.infer : return ["practal-secondary-keyword", []];
        case TokenType.proof : return ["practal-secondary-keyword", []];
        case TokenType.sorry : return ["practal-primary-keyword", []];
        case TokenType.qed : return ["practal-secondary-keyword", []];  
        case TokenType.note : return ["practal-secondary-keyword", []];  
        case TokenType.syntactic_transitive_less: return ["practal-syntactic-comparator", []];
        case TokenType.syntactic_transitive_greater: return ["practal-syntactic-comparator", []];
        case TokenType.syntax_fragment: return ["practal-syntax-fragment", []];
        case TokenType.syntax_optional_space: return ["practal-syntax-optional-space", []];
        case TokenType.syntax_mandatory_space: return ["practal-syntax-mandatory-space", []];
        case TokenType.latex_control_sequence: return ["practal-latex-control-sequence", []];
        case TokenType.latex_space: return ["practal-latex-space", []];
        case TokenType.latex_syntax: return ["practal-latex-syntax", []];
        case TokenType.selector_index: return ["practal-secondary-keyword", []];
        case TokenType.selector_label: return ["practal-label", []];
        default : assertNever(type);  //return ["practal-invalid", []];
    }
}

function diagnose(theory : UITheory, lines : TextLines, diagnoses : Diagnosis[], result : Result<SectionData, TokenType>) {

    function diag(result : Result<SectionData, TokenType>) {
        const kind = result.kind;
        switch (kind) {
            case ResultKind.TOKEN: 
                if (result.type === TokenType.syntactic_category_keyword || result.type === TokenType.syntactic_category) {
                    let text = textOfToken(lines, result);
                    while (text.length > 0 && text.charAt(0) === "`") text = text.slice(1);
                    if (text !== "" && !(text.indexOf("(") >= 0) && theory.lookupSyntacticCategory(text) === undefined) {
                        diagnoses.push(new Diagnosis(spanOfResult(result), Severity.ERROR, "Unknown syntactic category: " + text));    
                    }            
                }
                break;
            case ResultKind.TREE: 
                if (result.type && result.type.type === SectionName.invalid_term) {
                    diagnoses.push(new Diagnosis(spanOfResult(result), Severity.ERROR, "Invalid syntax."));
                } else if (result.type && result.type.type === SectionName.error) {
                    const msg = result.type.message ?? "Invalid syntax.";
                    diagnoses.push(new Diagnosis(spanOfResult(result), Severity.ERROR, msg));
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
    const parsed1 = practaliumDP({theory : UITheory.mk(lines), varParser : undefined, maximum_valid : undefined, maximum_invalid : undefined}, lines, 0, 0);
    if (parsed1 === undefined) return [[], []];
    const termParser = generateCustomGrammar(parsed1.state.theory);
    const parsed = practaliumDP({theory : UITheory.mk(lines), varParser : undefined, maximum_valid : termParser.maximum_valid, maximum_invalid : termParser.maximum_invalid}, lines, 0, 0);
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
    let first_invalid = true;
    for (const token of tokens) {
        if (token.type === TokenType.invalid) {
            if (first_invalid) {
                first_invalid = false;
                const msg = "Syntax error.";
                const diagnosis = new Diagnosis(spanOfResult(token), Severity.ERROR, msg);
                diagnoses.push(diagnosis);
            }
            continue;
        }
        if (token.type !== TokenType.whitespace) first_invalid = true;
    }
    diagnose(parsed.state.theory, lines, diagnoses, parsed.result);
    return [tokens, diagnoses];
}

//registerLanguageTokenizer("practal", tokenizer, ALL_TOKEN_TYPES, semantics);

export function activate(context: vscode.ExtensionContext) {
    const output = vscode.window.createOutputChannel("Practal");
    configureDebugging((s : string) => output.appendLine(s));
    registerLanguageTokenizer("practal", tokenizer, ALL_TOKEN_TYPES, semantics);
    debug("Practal for VSCode v0.0.12");
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

