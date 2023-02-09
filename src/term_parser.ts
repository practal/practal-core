import { Shape } from "./logic/shape";
import { ParseState, SectionData, SectionDataCustom, SectionDataNone, SectionDataTerm, SectionDataTerms, SectionName, TokenType } from "./practalium_parser";
import { DetParser, eofDP, modifyResultDP, newlineDP, optDP, orDP, rep1DP, seqDP, strictTokenDP, textOfToken, Token, tokenDP } from "./pyramids/deterministic_parser";
import { cloneExprGrammar, Expr, ExprGrammar, ExprKind, opt, or, printExpr, rule, seq, star } from "./pyramids/expr_grammar";
import { Sym } from "./pyramids/grammar_symbols";
import { charL, literalL, optL, rep1L, repL, seqL } from "./pyramids/lexer";
import { lrDP, mkTerminalParsers, orGreedyTerminalParsers, TerminalParsers } from "./pyramids/lr_parser";
import { Span } from "./pyramids/span";
import { Handle, SyntaxFragmentKind, Theory } from "./theory";
import { debug } from "./things/debug";
import { Digraph, transitiveClosure } from "./things/digraph";
import { nat } from "./things/primitives";
import { assertNever, force, internalError, isUnicodeDigit, isUnicodeLetter, timeIt } from "./things/utils";

const ows = "ows";
const ws = "ws";

export const basic_grammar : ExprGrammar = { 
    start : "Start",
    
    rules : [
        rule("Start", "Term", "final"),

        rule("Term-base", "Operation-app"),
        rule("Term-base", "Operator-app"),
        rule("Term-base-nonatomic", "Operation-app"),
        rule("Term-base-nonatomic", "Operator-app"),

        rule("Atomic-base", "Var-app"),
        rule("Atomic-base", "Var"),
        rule("Atomic-base", "Value"),
        rule("Atomic-base", "Brackets"),
        rule("Atomic-base-atomic", "Var-app"),
        rule("Atomic-base-atomic", "Var"),
        rule("Atomic-base-atomic", "Value"),
        rule("Atomic-base-atomic", "Brackets"),


        rule("Value", "value-id"),
        rule("Value", "unknown-id"),

        rule("Brackets",  "round-open", ows, "Term", ows, "round-close"),

        rule("Var-app", "Var-open", opt("Term-list"), ows, "square-close"),
        rule("Var", or("free-var", "var")), 
        rule("Var-open", or("free-var-open", "var-open")), 
        rule("Term-list", ows, "Term", star(ows, "comma", ows, "Term")),

        rule("Operation-app", "operation-id", "Params"),
        rule("Operator-app", "operator-id", star(ows, "bound-var"), ows, "dot", "Params"),

        rule("Params", ws, "Term-greater-atomic"),
        rule("Params", ws, "Term-greater-nonatomic"),
        rule("Params", ws, "Term-base-nonatomic"),        
        rule("Params", ws, "Atomic-base-atomic", "Params"),
        rule("Params", ws, "Atomic-greater-atomic", "Params"),


    ],

    distinct : [
        [ 
            "value-id", "unknown-id", "operation-id", "operator-id",
            "free-var", "bound-var", "var", "free-var-open", "var-open",
            "round-open", "round-close", "square-close", "comma", "dot", 
            "ws", "final"
        ]
    ],

    empty : [["ows", "ws"]],

    final : ["final"]
};

type P = DetParser<ParseState, SectionData, TokenType>    

function isIdLetter(c : string) : boolean {
    return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z');
}

function isIdDigit(c : string) : boolean {
    return c >= '0' && c <= '9';
}    

const idLetterL = charL(isIdLetter);
const idAlphaL = charL(c => isIdLetter(c) || isIdDigit(c));
const idHyphenL = literalL("-");
const identifierL = seqL(idLetterL, repL(idAlphaL), repL(seqL(idHyphenL, rep1L(idAlphaL))));   

function isVarLetter(c : string) : boolean {
    return isUnicodeLetter(c);
}

function isVarDigit(c : string) : boolean {
    return isUnicodeDigit(c);
}    

const varLetterL = charL(isVarLetter);
const varAlphaL = charL(c => isVarLetter(c) || isVarDigit(c));
const varHyphenL = literalL("-");
const varL = seqL(varLetterL, repL(varAlphaL), repL(seqL(varHyphenL, rep1L(varAlphaL))));    

export const squareOpenP : P = tokenDP(literalL("["), TokenType.square_open);
export const squareCloseP : P = tokenDP(literalL("]"), TokenType.square_close);

export const roundOpenP : P = tokenDP(literalL("("), TokenType.round_open);
export const roundCloseP : P = tokenDP(literalL(")"), TokenType.round_close);

export const dotP : P = tokenDP(literalL("."), TokenType.dot);
export const commaP : P = tokenDP(literalL(","), TokenType.comma);

export const wsP : P = rep1DP(orDP(newlineDP(SectionDataNone(SectionName.newline)), tokenDP(literalL(" "), TokenType.whitespace)))
export const owsP : P = optDP(wsP);
export const finalP : P = seqDP(owsP, eofDP());

export const varP : P = strictTokenDP(varL, TokenType.variable);
export const varOpenP : P = seqDP(varP, squareOpenP);

export const boundVarP : P = strictTokenDP(varL, TokenType.bound_variable);

export const freeVarL = seqL(literalL("?"), varL)
export const freeVarP : P = strictTokenDP(freeVarL, TokenType.free_variable);
export const freeVarOpenP : P = seqDP(freeVarP, squareOpenP);

const abstrL = seqL(optL(literalL("\\")), identifierL)

function mkIdP(tt : TokenType, require_slash : boolean, shapePred : (s : Shape | null) => boolean) : DetParser<ParseState, SectionData, TokenType> {
    return modifyResultDP(tokenDP(abstrL, tt), (lines, result) => {
        if (result === undefined) return undefined;
        let text = textOfToken(lines, result.result as Token<TokenType>);
        if (require_slash && !text.startsWith("\\")) return undefined;
        if (text.startsWith("\\")) text = text.slice(1);
        for (const abstr of result.state.theory.abstractions) {
            if (abstr.nameDecl.matches(text)) {
                return shapePred(abstr.shape) ? result : undefined;
            }
        }
        return shapePred(null) ? result : undefined;
    });
}

export const unknownIdP : P = mkIdP(TokenType.unknown_id, true, s => true);
export const valueIdP : P = mkIdP(TokenType.value_id, true, s => s !== null && s.arity === 0);
export const operationIdP : P = mkIdP(TokenType.operation_id, true, s => s !== null && s.valence === 0 && s.arity > 0);
export const operatorIdP : P = mkIdP(TokenType.operator_id, true, s => s !== null && s.valence > 0);
export const valueIdNoBackslashP : P = mkIdP(TokenType.value_id, false, s => s !== null && s.arity === 0);
export const operationIdNoBackslashP : P = mkIdP(TokenType.operation_id, false, s => s !== null && s.valence === 0 && s.arity > 0);
export const operatorIdNoBackslashP : P = mkIdP(TokenType.operator_id, false, s => s !== null && s.valence > 0);

export const terminalParsers1: TerminalParsers<ParseState, SectionData, TokenType> = 
    mkTerminalParsers([
        ["final", finalP],
        ["free-var-open", freeVarOpenP],
        ["var-open", varOpenP],
        ["square-close", squareCloseP],
        ["operator-id", operatorIdP],
        ["operation-id", operationIdP],
        ["value-id", valueIdP],
        ["unknown-id", unknownIdP],
        ["free-var", freeVarP],
        ["bound-var", boundVarP],
        ["round-open", roundOpenP],
        ["round-close", roundCloseP], 
        ["dot", dotP],
        ["comma", commaP],
        ["ws", wsP],
        ["ows", owsP]
    ]);

export const terminalParsers2 : TerminalParsers<ParseState, SectionData, TokenType> = 
    mkTerminalParsers([
        ["operator-id", operatorIdNoBackslashP],
        ["operation-id", operationIdNoBackslashP],
        ["value-id", valueIdNoBackslashP],
        ["var", varP]
    ]);

export const basic_labels : [Sym, SectionData][] = [
    ["Operator-app", SectionDataTerm(SectionName.operator_app)],
    ["Operation-app", SectionDataTerm(SectionName.operation_app)],
    ["Value", SectionDataTerm(SectionName.value)],
    ["Brackets", SectionDataTerm(SectionName.brackets)],
    ["Var-app", SectionDataTerm(SectionName.var_app)], 
    ["Var", SectionDataTerm(SectionName.var)],
    ["Var-open", SectionDataTerm(SectionName.var)],
    ["Term", SectionDataTerm(SectionName.term)],
    ["Params", SectionDataTerms(SectionName.params)]
];

export function computeSyntacticCategorySuccessors(theory : Theory) : Map<Handle, Set<Handle>> {
    const sc_infos = theory.syntacticCategories;
    let transitive = new Digraph();
    for (let sc = 0; sc < sc_infos.length; sc++)  {
        const info = sc_infos[sc];
        for (const succ of info.less_than_transitive) {
            transitive.connect(sc, succ);
        }
    }
    transitive = transitiveClosure(transitive);
    let result : Map<Handle, Set<Handle>> = new Map();
    for (let sc = 0; sc < sc_infos.length; sc++) {
        const successors = new Set(transitive.outgoing(sc));
        result.set(sc, successors);
    }
    return result;
}

export function generateCustomSyntax(theory : Theory) : { rules : { lhs : Sym, rhs : Expr}[], texts : Map<string, nat>, syntactic_categories : Set<Handle>, labels : Map<string, SectionData> } {
    const rules : { lhs : Sym, rhs : Expr, bounds? : Map<string, nat>, frees? : Map<string, nat>}[] = [];
    const texts : Map<string, nat> = new Map();
    const syntactic_categories : Set<nat> = new Set([theory.SC_ATOMIC, theory.SC_TERM]);
    const labels : Map<string, SectionData> = new Map();
    const successors = computeSyntacticCategorySuccessors(theory);
    const atomics = new Set(successors.get(theory.SC_ATOMIC) ?? new Set());    
    atomics.add(theory.SC_ATOMIC);

    function error(span : Span, msg : string) {
        theory.error(span, msg);
    }

    let sc_done = false;

    function sc_name(sc : Handle) : string {
        if (sc === theory.SC_ATOMIC) return "Atomic";
        else if (sc === theory.SC_TERM) return "Term";
        else return "S`" + sc;
    }

    function sc_greater(sc : Handle) : string {
        if (!sc_done) syntactic_categories.add(sc);
        return sc_name(sc) + "-greater";
    }

    function sc_greater_nonatomic(sc : Handle) : string {
        if (atomics.has(sc)) return "";
        if (!sc_done) syntactic_categories.add(sc);
        return sc_name(sc) + "-greater-nonatomic";
    }

    function sc_greater_atomic(sc : Handle) : string {
        if (!sc_done) syntactic_categories.add(sc);
        return sc_name(sc) + "-greater-atomic";
    }

    function sc_base(sc : Handle) : string {
        if (!sc_done) syntactic_categories.add(sc);
        return sc_name(sc) + "-base";
    }

    function sc_base_nonatomic(sc : Handle) : string {
        if (atomics.has(sc)) return "";
        if (!sc_done) syntactic_categories.add(sc);
        return sc_name(sc) + "-base-nonatomic";
    }

    function sc_base_atomic(sc : Handle) : string {
        if (!sc_done) syntactic_categories.add(sc);
        return sc_name(sc) + "-base-atomic";
    }

    function sc_this(sc : Handle) : string {
        if (!sc_done) syntactic_categories.add(sc);
        return sc_name(sc);
    }

    function sc_this_nonatomic(sc : Handle) : string {
        if (atomics.has(sc)) return "";
        if (!sc_done) syntactic_categories.add(sc);
        return sc_name(sc) + "-nonatomic";
    }

    function sc_this_atomic(sc : Handle) : string {
        if (!sc_done) syntactic_categories.add(sc);
        return sc_name(sc) + "-atomic";
    }


    function text(t : string) : string {
        let h = texts.get(t);
        if (h === undefined) {
           h = texts.size;
           texts.set(t, h); 
        }
        return "§" + h;
    }

    function invalid(expr : Expr) : boolean {
        if (typeof expr === "string") return expr === "";
        for (const param of expr.params) {
            if (invalid(param)) return true;
        }
        return false;
    }

    function addRule(sym : Sym, ...rhs : Expr[]) {
        if (sym === "") return;
        for (const r of rhs) {
            if (invalid(r)) return;
        }
        rules.push({lhs : sym, rhs : seq(...rhs)});
    }

    const abstractions = theory.abstractions;
    for (const [abstr_handle, abstraction] of abstractions.entries()) {
        const specs = abstraction.syntax_specs;
        for (let i = 0; i < specs.length; i++) {
            const spec = specs[i];
            const sc = spec.syntactic_category.str === "" ? abstraction.syntacticCategory : theory.lookupSyntacticCategory(spec.syntactic_category.str);
            if (sc === undefined) {
                error(spec.syntactic_category.span, "Unknown syntactic category '" + spec.syntactic_category.str + "'.");
                continue;
            }
            const rhs : Expr[] = [];
            const rhs_nonatomic : Expr[] = [];
            const rhs_atomic : Expr[] = [];
            const used_bounds : Map<string, nat> = new Map();
            const used_vars : Map<string, nat> = new Map();
            for (const fragment of spec.fragments) {
                const kind = fragment.kind;
                const first = rhs.length === 0;
                switch (kind) {
                    case SyntaxFragmentKind.mandatory_whitespace: 
                        rhs.push("ws");
                        rhs_nonatomic.push("ws");
                        rhs_atomic.push("ws");
                        break;
                    case SyntaxFragmentKind.optional_whitespace:
                        rhs.push("ows");
                        rhs_nonatomic.push("ows");
                        rhs_atomic.push("ows");
                        break;
                    case SyntaxFragmentKind.bound_variable: {
                        if (used_bounds.has(fragment.name.str)) {
                            error(fragment.name.span, "Bound variables cannot be reused.");
                            break;
                        }
                        rhs.push("bound-var");
                        rhs_nonatomic.push("bound-var");
                        rhs_atomic.push(first ? "" : "bound-var");
                        used_bounds.set(fragment.name.str, used_bounds.size);
                        break;
                    }
                    case SyntaxFragmentKind.free_variable: {
                        if (used_vars.has(fragment.name.str)) {
                            error(fragment.name.span, "Free variables cannot be reused.");
                            break;
                        }
                        used_vars.set(fragment.name.str, used_vars.size);
                        if (fragment.syntactic_category === undefined) {
                            rhs.push(sc_greater(sc));
                            rhs_nonatomic.push(first ? sc_greater_nonatomic(sc) : sc_greater(sc));
                            rhs_atomic.push(first ? sc_greater_atomic(sc) : sc_greater(sc));
                        } else {
                            if (fragment.syntactic_category.str === "") {
                                rhs.push(sc_this(sc));
                                rhs_nonatomic.push(first ? sc_this_nonatomic(sc) : sc_this(sc));
                                rhs_atomic.push(first ? sc_this_atomic(sc) : sc_this(sc));
                            } else {
                                const fsc = theory.lookupSyntacticCategory(fragment.syntactic_category.str);
                                if (fsc === undefined) {
                                    error(spec.syntactic_category.span, "Unknown syntactic category '" + fragment.syntactic_category.str + "'.");
                                } else {
                                    rhs.push(sc_this(fsc));
                                    rhs_nonatomic.push(first ? sc_this_nonatomic(fsc) : sc_this(fsc));
                                    rhs_atomic.push(first ? sc_this_atomic(fsc) : sc_this(fsc));
                                }
                            }
                        } 
                        break;
                    }
                    case SyntaxFragmentKind.text:
                        rhs.push(text(fragment.text.str));
                        rhs_nonatomic.push(text(fragment.text.str));
                        rhs_atomic.push(first ? "" : text(fragment.text.str));
                        break;
                    default: assertNever(kind);
                }
            }
            const base = "Base`" + abstr_handle + "-" + i;
            labels.set(base, SectionDataCustom(abstr_handle, abstraction.head, used_vars, used_bounds));
            addRule(base, ...rhs);
            addRule(sc_base(sc), base);
            const base_nonatomic = "Base-nonatomic`" + abstr_handle + "-" + i;
            labels.set(base_nonatomic, SectionDataCustom(abstr_handle, abstraction.head, used_vars, used_bounds));
            addRule(base_nonatomic, ...rhs_nonatomic);
            addRule(sc_base_nonatomic(sc), base_nonatomic);
            const base_atomic = "Base-atomic`" + abstr_handle + "-" + i;
            labels.set(base_atomic, SectionDataCustom(abstr_handle, abstraction.head, used_vars, used_bounds));
            addRule(base_atomic, ...rhs_atomic);
            addRule(sc_base_atomic(sc), base_atomic);
        }
        
    }
    
    sc_done = true;

    function sc_greater_generic(sc : Handle, atomic : null | false | true) : string {
        if (atomic === null) return sc_greater(sc);
        if (atomic === false) return sc_greater_nonatomic(sc);
        if (atomic === true) return sc_greater_atomic(sc);
        internalError();
    }

    function sc_base_generic(sc : Handle, atomic : null | false | true) : string {
        if (atomic === null) return sc_base(sc);
        if (atomic === false) return sc_base_nonatomic(sc);
        if (atomic === true) return sc_base_atomic(sc);
        internalError();
    }

    function sc_this_generic(sc : Handle, atomic : null | false | true) : string {
        if (atomic === null) return sc_this(sc);
        if (atomic === false) return sc_this_nonatomic(sc);
        if (atomic === true) return sc_this_atomic(sc);
        internalError();
    }

    for (const sc of syntactic_categories) {
        for (const atomic of [null, true, false]) {
            const lhs = sc_greater_generic(sc, atomic);
            const greater_bases : string[] = [];
            for (const succ of successors.get(sc) ?? []) {
                const base = sc_base_generic(succ, atomic);
                if (base !== "") greater_bases.push(base);
            }
            if (greater_bases.length > 0) {
                addRule(lhs, or(...greater_bases));
                addRule(sc_this_generic(sc, atomic), or(sc_base_generic(sc, atomic), sc_greater_generic(sc, atomic)));
            } else {
                addRule(sc_this_generic(sc, atomic), sc_base_generic(sc, atomic));
            }
        }
    }

    return { rules : rules, texts : texts, syntactic_categories : syntactic_categories, labels : labels };
}

export function generateCustomGrammar(theory : Theory) : { grammar : ExprGrammar, parser : P, syntactic_categories_with_Conflicts : Set<Handle | null> } {
    let customSyntax = generateCustomSyntax(theory);
    let customGrammar = cloneExprGrammar(basic_grammar);
    customGrammar.rules.push(...customSyntax.rules);
    /*debug("-------------");
    for (const rule of customGrammar.rules) {
        debug(rule.lhs + " => " + printExpr(rule.rhs));
    }
    debug("-------------");*/
    const texts = [...customSyntax.texts].sort((a, b) => b[0].length - a[0].length);
    force(customGrammar.distinct)[0].push(...texts.map(t => "§" + t[1]));
    /*for (let i = 0; i < texts.length; i++) {
        console.log("Text §" + texts[i][1] + " = '" + texts[i][0] + "'");
    }*/
    const fragments_parser : TerminalParsers<ParseState, SectionData, TokenType> = mkTerminalParsers(texts.map(t => ["§" + t[1], tokenDP(literalL(t[0]), TokenType.custom_syntax)]));
    const custom_terminal_parsers : TerminalParsers<ParseState, SectionData, TokenType> = orGreedyTerminalParsers([terminalParsers1, fragments_parser, terminalParsers2]);
    const labels = [...basic_labels, ...customSyntax.labels];
    const customLRParser = lrDP(customGrammar, labels, custom_terminal_parsers, SectionDataTerm(SectionName.invalid)); 
    const conflicts = customLRParser.conflicts;
    const conflict_scs : Set<Handle | null> = new Set();
    if (conflicts.size > 0) {
        debug("Found grammar conflicts:");
        for (const sym of conflicts) {
            debug("  symbol " + sym);
            if (sym != null && sym.startsWith("S`")) {
                const i = sym.indexOf("-");
                if (i >= 0) {
                    const sc = Number.parseInt(sym.slice(2, i));
                    if (nat.is(sc)) {
                        conflict_scs.add(sc);
                        const sc_name = theory.syntacticCategories[sc].decl.decl;
                        debug("  conflict in syntactic category: "+ sc_name + " (" + sc + ")");
                        continue;
                    }
                }
            } 
            conflict_scs.add(null);
        }
        if (conflicts.has(null)) {
            debug("  conflict without clear source");
        }
    }
    return { grammar : customGrammar, parser : customLRParser.parser, syntactic_categories_with_Conflicts : conflict_scs }; 
}
