import { performance } from 'perf_hooks';
import * as vscode from 'vscode';
import { TextLines } from './pyramids/textlines';
import { DetParser, Token } from './pyramids/deterministic_parser';
import { debug } from './things/debug';
import { Diagnosis, Severity } from './uitheory';
import { Span, spanOfResult } from './pyramids/span';
import { assertNever, notImplemented } from './things/utils';

class TextDocumentLines implements TextLines {

    document : vscode.TextDocument

    constructor(document : vscode.TextDocument) {
        this.document = document;
    }

    get lineCount() : number {
        return this.document.lineCount
    }

    lineAt(line : number) : string {
        return this.document.lineAt(line).text;    
    }

    absolute(line: number, offset: number): [number, number] {
        return [line, offset];
    }

}

//export let output = vscode.window.createOutputChannel("Tokenizer");
let counter = 0;
let diagnosticCollection = vscode.languages.createDiagnosticCollection("Practal documents");

function rangeOfSpan(span : Span) : vscode.Range {
    const start = new vscode.Position(span.startLine, span.startOffsetInclusive);
    const end = new vscode.Position(span.endLine, span.endOffsetExclusive);

    return new vscode.Range(start, end);
}

function convertSeverity(severity : Severity) : vscode.DiagnosticSeverity {
    switch (severity) {
        case Severity.ERROR: return vscode.DiagnosticSeverity.Error;
        case Severity.WARNING: return vscode.DiagnosticSeverity.Warning;
        case Severity.HINT: return vscode.DiagnosticSeverity.Hint;
        case Severity.INFO: return vscode.DiagnosticSeverity.Information;
        default: assertNever(severity);
    }
}

function convertDiagnosis(diagnosis : Diagnosis) : vscode.Diagnostic {
    const range = rangeOfSpan(diagnosis.span);
    const severity = convertSeverity(diagnosis.severity);
    return new vscode.Diagnostic(range, diagnosis.message, severity); 
}

export function createDocumentSemanticTokensProvider<T>(
    tokenizer : (textlines : TextLines) => [Iterable<Token<T>>, Iterable<Diagnosis>],
    legend : vscode.SemanticTokensLegend,
    type_semantics : (type : T) => [string, string[]] | undefined) : vscode.DocumentSemanticTokensProvider
{
    return {  
        provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.ProviderResult<vscode.SemanticTokens> {
            // analyze the document and return semantic tokens
            const textlines = new TextDocumentLines(document);
            const startTime = performance.now();
            const [tokens_, diagnoses] = tokenizer(textlines);
            const tokens = [...tokens_];
            const endTime = performance.now();
            const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
            counter += 1;
            const duration = Math.round((endTime - startTime) * 100) / 100;
            for (const token of tokens) {
                const start = new vscode.Position(token.line, token.startOffsetInclusive);
                const end = new vscode.Position(token.line, token.endOffsetInclusive + 1);
                const range = new vscode.Range(start, end);
                const semantics = type_semantics(token.type);
                if (semantics === undefined) continue;
                const [cl, modifiers] = semantics;
                tokensBuilder.push(range, cl, modifiers);
            }
            const diagnostics = [...diagnoses].map(convertDiagnosis);
            debug("[" + counter + "] found " + tokens.length + " tokens and "+diagnostics.length+" diagnostics in " + duration + " ms (" + document.fileName + ":" + document.version + ")");
            diagnosticCollection.set(document.uri, diagnostics);
            return tokensBuilder.build();
        }
    };
}

export function createLegend<T>(types : Iterable<T>, type_semantics : (type : T) => [string, string[]] | undefined) : vscode.SemanticTokensLegend
{
    let classes : Set<string> = new Set();
    let modifiers : Set<string> = new Set();
    for (const t of types) {
        const semantics = type_semantics(t);
        if (semantics === undefined) continue;
        const [cl, ms] = semantics;
        classes.add(cl);
        for (const m of ms) modifiers.add(m);
    }
    return new vscode.SemanticTokensLegend([...classes], [...modifiers]);
}

export function registerLanguageTokenizer<T, State>(
    language : string, 
    tokenizer : (textlines : TextLines) => [Iterable<Token<T>>, Iterable<Diagnosis>],   
    types : Iterable<T>,
    type_semantics : (type : T) => [string, string[]] | undefined)
{
    const selector : vscode.DocumentSelector = { language: language }; 
    const legend = createLegend(types, type_semantics);
    const provider = createDocumentSemanticTokensProvider(tokenizer, legend, type_semantics);
    vscode.languages.registerDocumentSemanticTokensProvider(selector, provider, legend);
}