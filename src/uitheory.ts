import { idMatcher, isConstId, normalConstId, splitIdDecl } from "./identifier";
import { Shape } from "./logic/shape";
import { OnlineDAG } from "./things/online_dag";
import { Span, spanOfResult, SpanStr } from "./pyramids/span";
import { absoluteSpan, TextLines } from "./pyramids/textlines";
import { nat } from "./things/primitives";
import { assertNever, force, freeze, notImplemented, privateConstructor } from "./things/utils";
import { UIRule, UITerm } from "./uiterm";
import { debug } from "./things/debug";
import { firstL, Lexer } from "./pyramids/lexer";

export type Handle = nat

export const enum Severity {
    WARNING,
    ERROR,
    HINT,
    INFO
}

export class Diagnosis {
    span : Span
    severity : Severity
    message : string
    constructor(span : Span, severity : Severity, message : string) {
        this.span = span;
        this.severity = severity;
        this.message = message;
        freeze(this);
    }
}
freeze(Diagnosis);

export class Diagnoses {
    #diagnoses : Diagnosis[]
    constructor() {
        this.#diagnoses = [];
        freeze(this);
    }
    add(diagnosis : Diagnosis) {
        this.#diagnoses.push(diagnosis);
    }
    export() : Diagnosis[] {
        return [...this.#diagnoses];
    }
}
freeze(Diagnoses);

export class NameDecl {

    static #internal = false

    static SC_ATOMIC = NameDecl.mkSCAtomic();
    static SC_TERM = NameDecl.mkSCTerm();

    span : Span
    decl : string
    short : string
    long : string
    normals : Set<string>
    matcher : Lexer
    
    private constructor(span : Span, decl : string, short : string, long : string) {
        if (!NameDecl.#internal) privateConstructor("NameDecl");
        this.span = span;
        this.decl = decl;
        this.short = short;
        this.long = long;
        this.normals = new Set([normalConstId(short), normalConstId(long)]);
        this.matcher = firstL(idMatcher(long), idMatcher(short));
        freeze(this);
    }

    get isDeclaration() : boolean {
        return this.decl.indexOf("(") >= 0;
    }

    matches(name : string) : boolean {
        return this.matcher(name, 0) === name.length;
    }

    private static mkSCAtomic() : NameDecl {
        NameDecl.#internal = true;
        const decl =  new NameDecl(Span.none, "", "", "");
        NameDecl.#internal = false;
        return decl;
    }

    private static mkSCTerm() : NameDecl {
        NameDecl.#internal = true;
        const decl = new NameDecl(Span.none, "", "", "");
        NameDecl.#internal = false;
        return decl;
    }

    static mk(span : Span, decl : string) : NameDecl | undefined {
        const split = splitIdDecl(decl);
        if (split === undefined) return undefined;
        if (!isConstId(split.short)) return undefined;
        if (!isConstId(split.long)) return undefined;
        NameDecl.#internal = true;
        const nameDecl = new NameDecl(span, decl, split.short, split.long);
        NameDecl.#internal = false;
        return nameDecl;
    }

    static fromSpanStr(s : SpanStr) : NameDecl | undefined {
        return NameDecl.mk(s.span, s.str);
    }

}
freeze(NameDecl);

export class Head {
    abstraction : SpanStr
    bounds : SpanStr[]
    frees : [SpanStr, SpanStr[]][]
    constructor(abstraction : SpanStr, bounds : SpanStr[], frees : [SpanStr, SpanStr[]][]) {
        this.abstraction = abstraction;
        this.bounds = [...bounds];
        this.frees = frees.map(f => [f[0], [...f[1]]]);
        freeze(this);
    }
    toString() : string {
        let s = "" + this.abstraction;
        for (const b of this.bounds) s += " " + b;
        if (this.bounds.length > 0) s += ".";
        for (const [f, bs] of this.frees) {
            s += " " + f;
            if (bs.length > 0) {
                s += "[";
                s += bs.map(b => "" + b).join(", ");
                s += "]";
            }
        }
        return s;
    }
    hasBound(name : string) : boolean {
        for (const bound of this.bounds) {
            if (bound.str === name) return true;
        }
        return false;
    }
    hasFree(name : string) : boolean {
        for (const free of this.frees) {
            if (free[0].str === name) return true;
        }
        return false;
    }
}
freeze(Head);

export enum SyntaxFragmentKind {
    optional_whitespace,
    mandatory_whitespace,
    bound_variable,
    free_variable,
    text
};
freeze(SyntaxFragmentKind);

export type SyntaxWhitespace = {
    kind : SyntaxFragmentKind.optional_whitespace | SyntaxFragmentKind.mandatory_whitespace
};

export type SyntaxBoundVariable = {
    kind : SyntaxFragmentKind.bound_variable,
    name : SpanStr
};

export type SyntaxFreeVariable = {
    kind : SyntaxFragmentKind.free_variable,
    name : SpanStr,
    syntactic_category : SpanStr | undefined
};

export type SyntaxText = {
    kind : SyntaxFragmentKind.text,
    text : SpanStr
};

export type SyntaxFragment = SyntaxWhitespace | SyntaxBoundVariable | SyntaxFreeVariable | SyntaxText

function consolidateFragmentSpaces(fragments : SyntaxFragment[]) : SyntaxFragment[] {
    let result : SyntaxFragment[] = [];
    let lastspace : SyntaxWhitespace | undefined = undefined;
    for (const f of fragments) {
        if (f.kind === SyntaxFragmentKind.mandatory_whitespace) {
            if (result.length === 0) continue;
            lastspace = f;
        } else if (f.kind === SyntaxFragmentKind.optional_whitespace) {
            if (result.length === 0) continue;
            if (lastspace === undefined) lastspace = f;
        } else {
            if (lastspace !== undefined) result.push(lastspace);
            result.push(f);
            lastspace = undefined;
        }
    }
    return result;
}

export class SyntaxSpec {
    syntactic_category : SpanStr
    long : boolean
    fragments : SyntaxFragment[]
    constructor(category : SpanStr, long : boolean, fragments : SyntaxFragment[]) {
        this.syntactic_category = category;
        this.long = long;
        this.fragments = consolidateFragmentSpaces(fragments);
        freeze(this.fragments);
        freeze(this);
    }
    toString() : string {
        let s = "`" + this.syntactic_category;
        for (const fragment of this.fragments) {
            s += " ";
            const kind = fragment.kind;
            switch (kind) {
                case SyntaxFragmentKind.bound_variable:
                    s += `[bound ${fragment.name}]`;
                    break;
                case SyntaxFragmentKind.free_variable:
                    s += `[free ${fragment.name}`;
                    if (fragment.syntactic_category === undefined) {
                        s += "]";
                    } else {
                        s += "'" + fragment.syntactic_category + "]";
                    }
                    break;
                case SyntaxFragmentKind.mandatory_whitespace:
                    s += `[ws!]`
                    break;
                case SyntaxFragmentKind.optional_whitespace:
                    s += `[ws?]`;
                    break;
                case SyntaxFragmentKind.text:
                    s += `[text '${fragment.text}']`;
                    break;
                default:
                    assertNever(kind);
            }
        }
        return s;
    }
}
freeze(SyntaxSpec);

let internal = false;
function checkInternal() {
    if (!internal) throw new Error("Cannot call internal functionality.");
}

export class SyntacticCategoryInfo {

    decl : NameDecl
    #less_than_transitive : Set<Handle>

    constructor(decl : NameDecl) {
        this.decl = decl;
        this.#less_than_transitive = new Set();
        freeze(this);
    }

    addLessThanTransitive(handle : Handle) {
        checkInternal();
        this.#less_than_transitive.add(handle);
    }

    get less_than_transitive(): Handle[] { return [...this.#less_than_transitive]; }

}
freeze(SyntacticCategoryInfo);

export class AbstractionInfo {

    head : Head
    nameDecl : NameDecl
    shape : Shape
    #syntacticCategory : Handle | undefined
    #syntax_specs : SyntaxSpec[]
    #definition : UITerm | undefined;

    constructor(head : Head, nameDecl : NameDecl, shape : Shape, syntacticCategory : Handle | undefined) {
        this.head = head;
        this.nameDecl = nameDecl;
        this.shape = shape;
        this.#syntacticCategory = syntacticCategory;
        this.#syntax_specs = [];
        this.#definition = undefined;
        freeze(this);
    }

    get syntacticCategory() : Handle | undefined {
        return this.#syntacticCategory;
    }

    set syntacticCategory(h : Handle | undefined) {
        if (this.#syntacticCategory !== undefined) throw new Error("Cannot unset syntactic category.");
        this.#syntacticCategory = h;
    }

    addSyntaxSpec(spec : SyntaxSpec) {
        checkInternal();
        this.#syntax_specs.push(spec);
    }

    addDefinition(definition : UITerm) {
        checkInternal();
        this.#definition = definition;
    }

    hasDefinition() : boolean {
        return this.#definition !== undefined;
    }

    get syntax_specs() : SyntaxSpec[] {
        return [...this.#syntax_specs];
    }

}
freeze(AbstractionInfo);

export class UITheory {

    #lines : TextLines
    #diagnoses : Diagnoses
    #name : NameDecl | undefined
    #abstrNormals : Map<string, Handle>
    #scNormals : Map<string, Handle>
    #abstractions : AbstractionInfo[]
    #current : AbstractionInfo | undefined
    #syntacticCategories : SyntacticCategoryInfo[]
    #online_dag : OnlineDAG<Handle>
    #SC_ATOMIC : Handle
    #SC_TERM : Handle
    #rules : [NameDecl | undefined, UIRule][];
    #ruleNormals : Map<string, Handle>

    private constructor(lines : TextLines) {
        this.#lines = lines;
        this.#diagnoses = new Diagnoses();
        this.#name = undefined;
        this.#abstractions = [];
        this.#syntacticCategories = [];
        this.#abstrNormals = new Map();
        this.#scNormals = new Map();
        this.#online_dag = new OnlineDAG();
        freeze(this);
        this.#SC_ATOMIC = this.#addSyntacticCategory(NameDecl.SC_ATOMIC);
        this.#SC_TERM = this.#addSyntacticCategory(NameDecl.SC_TERM);
        this.addSyntacticCategoryPriority(Span.none, this.#SC_ATOMIC, this.#SC_TERM);
        this.#rules = [];
        this.#ruleNormals = new Map();
    } 

    get SC_ATOMIC() : Handle { return this.#SC_ATOMIC; }

    get SC_TERM() : Handle { return this.#SC_TERM; }
        
    report(span : Span | undefined, severity : Severity, msg : string) {
        if (!span) span = new Span(0, 0, 0, 0);
        this.#diagnoses.add(new Diagnosis(span, severity, msg));
    } 

    error(span : Span | undefined, msg : string) {
        this.report(span, Severity.ERROR, msg);
    }

    get diagnoses() : Diagnosis[] {
        return this.#diagnoses.export();
    }

    get syntacticCategories() : SyntacticCategoryInfo[] {
        return [...this.#syntacticCategories];
    }

    get abstractions() : AbstractionInfo[] {
        return [...this.#abstractions];
    }

    info(abstr : Handle) : AbstractionInfo | undefined {
        if (nat.is(abstr) && abstr < this.#abstractions.length)
            return this.#abstractions[abstr];
        else    
            return undefined;
    }

    static mk(lines : TextLines) : UITheory {
        return new UITheory(lines);
    }    

    #canDeclareTheoryName() : boolean {
        if (this.#name !== undefined) return false;
        if (this.#syntacticCategories.length > 2) return false;
        if (this.#abstractions.length > 0) return false;
        return true;
    }

    addTheoryName(span : Span, name : SpanStr) {
        if (!this.#canDeclareTheoryName()) {
            this.error(span, "Theory declaration must be at the beginning.");
            return;
        }
        const decl = NameDecl.mk(name.span, name.str);
        if (decl === undefined || decl.short != decl.long) {
            this.error(name.span, "Invalid theory name '" + name + "'.");
            return;
        }
        this.#name = decl;
    }

    lookupSyntacticCategory(name : string) : Handle | undefined {
        const handle = this.#scNormals.get(normalConstId(name));
        if (handle === undefined) return undefined;
        if (this.#syntacticCategories[handle].decl.matches(name)) return handle;
        else return undefined;
    }

    lookupAbstraction(name : string) : Handle | undefined {
        const handle = this.#abstrNormals.get(normalConstId(name)); 
        if (handle === undefined) return undefined;
        if (this.#abstractions[handle].nameDecl.matches(name)) return handle; 
        else return undefined;   
    }

    #addSyntacticCategory(decl : NameDecl) : Handle {
        const handle = this.#syntacticCategories.length;
        const info = new SyntacticCategoryInfo(decl);
        this.#syntacticCategories.push(info);
        for (const normal of decl.normals) {
            this.#scNormals.set(normal, handle);
        }
        this.#online_dag.addVertex(handle);
        return handle;
    }

    ensureSyntacticCategory(span : Span, decl : string, isNecessarilyDeclaration : boolean, loose : boolean) : Handle | undefined {
        const nameDecl = NameDecl.mk(span, decl);
        if (nameDecl === undefined) {
            this.error(span, "Invalid syntactic category declaration '" + decl + "'.");
            return undefined;
        }
        const normals = nameDecl.normals;
        let defined = 0;
        let handle = 0;
        for (const n of normals) {
            const h = this.#scNormals.get(n);
            if (h !== undefined)  {
                handle = h;
                defined += 1;
            }
        }
        if (defined === 0) {
            const sc = this.#addSyntacticCategory(nameDecl);
            if (!loose) {
                this.addSyntacticCategoryPriority(span, sc, this.SC_TERM);
                this.addSyntacticCategoryPriority(span, this.SC_ATOMIC, sc);
            }
            return sc;
        }
        if (loose) {
            this.error(span, "Syntactic category cannot be redeclared as loose.");
        }
        if (isNecessarilyDeclaration || nameDecl.isDeclaration) {
            this.error(span, "Syntactic category is already declared as '" + this.#syntacticCategories[handle].decl.decl + "'.");
            return undefined;
        } else {
            if (this.#syntacticCategories[handle].decl.matches(decl)) return handle; else return undefined;
        }
    }

    addSyntacticCategoryPriority(span : Span, higher : Handle, lower : Handle) {
        if (this.#online_dag.hasEdge(higher, lower)) return;
        if (!this.#online_dag.addEdge(higher, lower)) {
            this.error(span, "This priority relation between syntactic categories introduces a cycle.");
            return;
        }
        const lsc = this.#syntacticCategories[lower];
        internal = true;
        lsc.addLessThanTransitive(higher);
        internal = false;
    }

    #processHead(head : Head) : [NameDecl, Shape] | undefined {
        const nameDecl = NameDecl.fromSpanStr(head.abstraction);
        if (nameDecl === undefined) {
            this.error(head.abstraction.span, "Invalid abstraction name(s) '" + head.abstraction + "'.");
            return undefined;
        }
        let binders : Map<string, nat> = new Map();
        const bounds = head.bounds;
        for (let i = 0; i < bounds.length; i++) {
            if (binders.has(bounds[i].str)) {
                this.error(bounds[i].span, "Duplicate binder '" + bounds[i] + "'.");
                return undefined;
            }
            binders.set(bounds[i].str, binders.size);
        } 
        const frees = head.frees;
        const freeNames : Set<string> = new Set();
        const deps : nat[][] = [];
        const used : Set<nat> = new Set();
        for (let i = 0; i < frees.length; i++) {
            const free = frees[i][0];
            const params = frees[i][1];
            //const deps : Set<nat> = new Set();
            if (freeNames.has(free.str)) {
                this.report(free.span, Severity.ERROR, "Duplicate occurrence of free variable '" + free + "'.");
                return undefined;
            }
            freeNames.add(free.str);
            if (binders.has(free.str)) {
                this.report(free.span, Severity.ERROR, "Free variable '" + free + "' has same name as binder.");
            }
            const args : nat[] = [];
            for (const param of params) {
                const i = binders.get(param.str);
                if (i === undefined) {
                    this.error(param.span, "Binder '" + param + "' is not in scope.");
                    return undefined;
                }
                if (args.length > 0 && args[args.length - 1] >= i) {
                    const failure = args[args.length - 1] === i ? "duplicate" : "out of order";
                    this.error(param.span, "Binder '" + param + "' is " + failure + ".");
                    return undefined;
                }
                args.push(i);
                used.add(i);
            }
            deps.push(args);
        }
        for (let i = 0; i < head.bounds.length; i++) {
            if (!used.has(i)) {
                this.error(head.bounds[i].span, "Binder '" + head.bounds[i] + "' is not used by any parameter.");
                return undefined;
            }
        }
        const shape = Shape.make(deps);
        return [nameDecl, shape];
    }

    get hasCurrent() : boolean {
        return this.#current !== undefined;
    }

    startDeclaration(head : Head) {
        if (this.#current !== undefined) throw new Error("Cannot start declaration, end current one first.");
        const processedHead = this.#processHead(head);
        if (processedHead === undefined) return;
        const [nameDecl, shape] = processedHead;   
        for (const normal of nameDecl.normals) {
            const handle = this.#abstrNormals.get(normal);
            if (handle !== undefined) {
                const info = this.#abstractions[handle];
                this.error(head.abstraction.span, "Abstraction is already declared elsewhere as: " + info.head);
                return this.#addSyntacticCategory(nameDecl);
            }
        }
        const info = new AbstractionInfo(head, nameDecl, shape, undefined);
        this.#current = info;        
    }

    ensureSyntacticCategoryOfDeclaration() {
        if (this.#current === undefined) throw new Error("There is no declaration, start one first.");
        const head = this.#current.head;
        const span = head.abstraction.span;
        const sc = this.ensureSyntacticCategory(head.abstraction.span, head.abstraction.str, true, true);
        if (sc === undefined) {
            this.error(span, "Cannot redeclare syntactic category.");
            return;
        }
        const shape = this.#current.shape;
        if (shape.arity === 0) {
            this.addSyntacticCategoryPriority(span, sc, this.SC_ATOMIC);
        } else {
            this.addSyntacticCategoryPriority(span, sc, this.SC_TERM);
            this.addSyntacticCategoryPriority(span, this.SC_ATOMIC, sc);
        }
        this.#current.syntacticCategory = sc;
    }

    endDeclaration() {
        if (this.#current === undefined) throw new Error("There is no declaration to finish, start one first.");
        const info = this.#current;
        this.#current = undefined;
        const handle = this.#abstractions.length;
        this.#abstractions.push(info);
        for (const normal of info.nameDecl.normals) {
            this.#abstrNormals.set(normal, handle);
        }
    }

    #checkSyntaxSpec(info : AbstractionInfo, spec : SyntaxSpec) : boolean {
        if (spec.fragments.length === 0) {
            this.error(spec.syntactic_category.span, "Empty syntax specification.");
            return false;
        }
        const head = info.head;
        const bounds = new Set<string>();
        const frees = new Set<string>();
        let ok = true;
        for (const fragment of spec.fragments) {
            const kind = fragment.kind;
            switch (kind) {
                case SyntaxFragmentKind.text:
                case SyntaxFragmentKind.mandatory_whitespace:
                case SyntaxFragmentKind.optional_whitespace:
                    break;
                case SyntaxFragmentKind.bound_variable: {
                    const name = fragment.name.str;
                    if (bounds.has(name)) {
                        this.error(fragment.name.span, "Reuse of binder.");
                        ok = false;
                    } else {
                        bounds.add(name);
                    }
                    if (!head.hasBound(name)) {
                        ok = false;
                        this.error(fragment.name.span, "Unknown binder.");
                    }
                    break;
                }
                case SyntaxFragmentKind.free_variable: {
                    const name = fragment.name.str;
                    if (frees.has(name)) {
                        this.error(fragment.name.span, "Reuse of free variable.");
                        ok = false;
                    } else {
                        frees.add(name);
                    }
                    if (!head.hasFree(name)) {
                        ok = false;
                        this.error(fragment.name.span, "Unknown free variable.");
                    }
                    break;                
                }
                default: assertNever(kind);
            }
        }
        for (const bound of head.bounds) {
            if (!bounds.has(bound.str)) {
                ok = false;
                this.error(bound.span, "Binder does not appear in custom syntax.");
            }
        }
        for (const free of head.frees) {
            if (!frees.has(free[0].str)) {
                ok = false;
                this.error(free[0].span, "Free variable does not appear in custom syntax.");
            }
        }
        return ok;
    }

    addSyntaxSpec(spec : SyntaxSpec) : boolean {
        if (this.#current === undefined) throw new Error("There is no declaration to add syntax to.");    
        if (this.#checkSyntaxSpec(this.#current, spec)) {
            internal = true;
            this.#current.addSyntaxSpec(spec);
            internal = false;
            return true;
        } else {
            return false;
        }
    }

    #checkDefinition(lines : TextLines, info : AbstractionInfo, body : UITerm) : boolean {
        if (!body.freeVars) throw new Error("body has not been validated, validate first");
        const frees = info.head.frees;
        let ok = true;
        for (const [free, arity] of body.freeVars) {
            if (frees.findIndex(value => value[0].str === free && value[1].length === arity) < 0) {
                ok = false;
                let span = info.head.abstraction.span;
                if (body.syntax) {
                    span = absoluteSpan(lines, spanOfResult(body.syntax));
                }
                this.error(span, "Variable " + free + " of arity " + arity + " appears free in definition body.");
            }
        }
        return ok;
    }

    addDefinition(lines : TextLines, body : UITerm) : boolean {
        if (this.#current === undefined) throw new Error("There is no declaration to add a definition to.");    
        if (this.#checkDefinition(lines, this.#current, body)) {
            internal = true;
            this.#current.addDefinition(body);
            internal = false;
            return true;
        } else {
            return false;
        }        
    }

    #checkLabelsAreDifferent(labels : (NameDecl | undefined)[]) : boolean {
        const used : Set<string> = new Set();
        let ok = true;
        for (const labelled of labels) {
            if (labelled === undefined) continue;
            for (const normal of labelled.normals) {
                if (used.has(normal)) {
                    this.error(labelled.span, "Duplicate label '" + labelled.decl + "'.");
                    ok = false;
                } 
            }
            for (const normal of labelled.normals) {
                used.add(normal);
            }
        }
        return ok;
    }

    addRule(label : NameDecl | undefined, rule : UIRule) {
        if (!this.#checkLabelsAreDifferent([...rule.premisses, ... rule.conclusions].map(a => a.label))) return;
        if (label === undefined)
            this.#rules.push([label, rule]);
        else {
            let ok = true
            for (const normal of label.normals) {
                if (this.#ruleNormals.has(normal)) {
                    this.error(label.span, "Duplicate label '" + label.decl + "'.");
                    ok = false;
                }
            }
            if (!ok) return;
            const handle = this.#rules.length;
            this.#rules.push([label, rule]);
            for (const normal of label.normals) {
                this.#ruleNormals.set(normal, handle);
            }
    
        }
    }

}
freeze(UITheory);


