import { int } from "../things/primitives";
import { force, internalError } from "../things/utils";
import { ExprGrammar, opt, or, star, rule, seq, plus } from "./expr_grammar";
import { GrammarSymbols } from "./grammar_symbols";

const ws = "ws";
const ows = "ows";

export const basic_grammar1 : ExprGrammar = { start : "Term", rules : [
    rule("Term", "Var-app"),
    rule("Term", "Abstr-app"),
    rule("Term", "round-open", ows, opt("Term"), ows, "round-close"),

    rule("Var-app", "Var", opt("square-open", ows, opt("Term-list", ows), "square-close")),
    rule("Var", or("free-var", "var")), 
    rule("Term-list", "Term", star(ows, "comma", ows, "Term")),

    rule("Abstr-app", "abstr-id", star(ws, "var"), opt(ows, "dot"), star(ws, "Param")),

    rule("Param", "Var-app"),
    rule("Param", "abstr-id"),
    rule("Param", "round-open", ows, "Term", ows, "round-close")
]};

export const test_grammar : ExprGrammar = { start : "S", rules : [

    rule("S", "C", "C"),
    rule("C", or(seq("c", "C"), "d"))

]};

export const simple_grammar1 : ExprGrammar = { start : "Term", rules : [
    rule("Term", "Var-app"),

    //rule(ows, opt("ws")),

    rule("Var-app", "Var", opt("square-open", ows, opt("Term-list", ows), "square-close")),
    rule("Var", or("free-var", "var")), 

    rule("Term-list", "Term", star(ows, "Term"))
]};

export const simple_grammar2 : ExprGrammar = { start : "Term-list", rules : [
    rule("Term", "var"),

    rule("Term-list", "Term", star(ows, "Term"))
]};

export const simple_grammar3 : ExprGrammar = { start : "Term", rules : [
    rule("Term", "Var-app"),

    rule("Var-app", "Var", opt("square-open", star(ows, "Term"), "ows-square-close")),

    rule("Var", or("free-var", "var")), 

]};

export const basic_grammar2 : ExprGrammar = { start : "Term", rules : [
    rule("Term", "Var-app"),
    rule("Term", "Abstr-app"),
    rule("Term", "round-open", opt(ows, "Term"), "ows,round-close"),

    rule("Var-app", "Var", opt("square-open", opt(ows, "Term-list"), "ows,square-close")),
    rule("Var", or("free-var", "var")), 
    rule("Term-list", "Term", star("ows,comma,ows", "Term")),

    rule("Abstr-app", "abstr-id", star("ws,var"), opt("ows,dot"), star(ws, "Param")),

    rule("Param", "Var-app"),
    rule("Param", "abstr-id"),
    rule("Param", "round-open,ows", "Term", "ows,round-close")
]};

export const basic_grammar3 : ExprGrammar = { start : "Term", rules : [

    rule("Term", "Atomic"),
    rule("Term", "Operation-app"),
    rule("Term", "Operator-app"),

    rule("Atomic", "Var-app"),
    rule("Atomic", "value-id"),
    rule("Atomic", "unknown-id"),
    rule("Atomic", "round-open", "Term", "round-close"),

    rule("Var-app", "Var"),
    rule("Var-app", "Var-open", opt("Term-list"), "square-close"),
    rule("Var", or("free-var", "var")), 
    rule("Var-open", or("free-var-open", "var-open")), 
    rule("Term-list", "Term", star("comma", "Term")),

    rule("Operation-app", "operation-id", star ("Atomic")),
    rule("Operator-app", "operator-id", star("var"), "dot", star("Atomic")),
]};

export const basic_grammar : ExprGrammar = { 
    start : "Term",
    
    rules : [

        rule("Term", "Atomic"),
        rule("Term", "Operation-app"),
        rule("Term", "Operator-app"),

        rule("Atomic", "Var-app"),
        rule("Atomic", "Var"),
        rule("Atomic", "value-id"),
        rule("Atomic", "unknown-id"),
        rule("Atomic", "Brackets"),

        rule("Brackets",  "round-open", ows, "Term", ows, "round-close"),

        rule("Var-app", "Var-open", opt("Term-list"), ows, "square-close"),
        rule("Var", or("free-var", "var")), 
        rule("Var-open", or("free-var-open", "var-open")), 
        rule("Term-list", ows, "Term", star(ows, "comma", ows, "Term")),

        rule("Operation-app", "operation-id", star (ows, "Atomic")),
        rule("Operator-app", "operator-id", star(ows, "bound-var"), ows, "dot", "Operator-params"),
        rule("Operator-params", ws, "Term"),
        rule("Operator-params", ws, "Atomic", "Operator-params")
    ],

    distinct : [
        [ 
            "value-id", "unknown-id", "operation-id", "operator-id",
            "free-var", "bound-var", "var", "free-var-open", "var-open",
            "round-open", "round-close", "square-close", "comma", "dot", 
            "ws"
        ]
    ],

    empty : [["ows", "ws"]]
};

