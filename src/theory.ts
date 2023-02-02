import { isConstId, normalConstId, splitIdDecl } from "./identifier";
import { Shape } from "./logic/shape";
import { OnlineDAG } from "./things/online_dag";
import { Span, spanOfResult, SpanStr } from "./pyramids/span";
import { absoluteSpan, TextLines } from "./pyramids/textlines";
import { nat } from "./things/primitives";
import { assertNever, force, freeze, notImplemented, privateConstructor } from "./things/utils";
import { UITerm } from "./uiterm";
import { debug } from "./things/debug";

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

    span : Span
    decl : string
    short : string
    long : string
    normal_short : string
    normal_long : string
    
    private constructor(span : Span, decl : string, short : string, long : string, normal_short : string, normal_long : string) {
        if (!NameDecl.#internal) privateConstructor("NameDecl");
        this.span = span;
        this.decl = decl;
        this.short = short;
        this.long = long;
        this.normal_short = normal_short;
        this.normal_long = normal_long;
        freeze(this);
    }

    get isDeclaration() : boolean {
        return this.decl.indexOf("(") >= 0;
    }

    matches(name : string) : boolean {
        const n = normalConstId(name);
        return n === this.normal_long || n === this.normal_short;
    }

    static mk(span : Span, decl : string) : NameDecl | undefined {
        const split = splitIdDecl(decl);
        if (split === undefined) return undefined;
        if (!isConstId(split.short)) return undefined;
        if (!isConstId(split.long)) return undefined;
        const normal_short = normalConstId(split.short);
        const normal_long = normalConstId(split.long);
        NameDecl.#internal = true;
        const nameDecl = new NameDecl(span, decl, split.short, split.long, normal_short, normal_long);
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
    fragments : SyntaxFragment[]
    constructor(category : SpanStr, fragments : SyntaxFragment[]) {
        this.syntactic_category = category;
        this.fragments = consolidateFragmentSpaces(fragments);
        freeze(this.fragments);
        freeze(this);
    }
    toString() : string {
        let s = "'" + this.syntactic_category;
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
    #less_than : Set<Handle>;
    #less_than_transitive : Set<Handle>

    constructor(decl : NameDecl) {
        this.decl = decl;
        this.#less_than = new Set();
        this.#less_than_transitive = new Set();
        freeze(this);
    }

    addLessThan(handle : Handle) {
        checkInternal();
        this.#less_than.add(handle);
    }

    addLessThanTransitive(handle : Handle) {
        checkInternal();
        this.#less_than_transitive.add(handle);
    }

    get less_than(): Handle[] { return [...this.#less_than]; }
    get less_than_transitive(): Handle[] { return [...this.#less_than_transitive]; }

}
freeze(SyntacticCategoryInfo);

export class AbstractionInfo {

    head : Head
    nameDecl : NameDecl
    shape : Shape
    syntacticCategory : Handle
    #syntax_specs : SyntaxSpec[]
    #definition : UITerm | undefined;

    constructor(head : Head, nameDecl : NameDecl, shape : Shape, syntacticCategory : Handle) {
        this.head = head;
        this.nameDecl = nameDecl;
        this.shape = shape;
        this.syntacticCategory = syntacticCategory;
        this.#syntax_specs = [];
        this.#definition = undefined;
        freeze(this);
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

export class Theory {

    #lines : TextLines
    #diagnoses : Diagnoses
    #name : NameDecl | undefined
    #abstrNormals : Map<string, Handle>
    #scNormals : Map<string, Handle>
    #abstractions : AbstractionInfo[]
    #current : AbstractionInfo | undefined
    #syntacticCategories : SyntacticCategoryInfo[]
    #online_dag : OnlineDAG<Handle>

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
    } 
        
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

    static mk(lines : TextLines) : Theory {
        return new Theory(lines);
    }    

    #canDeclareTheoryName() : boolean {
        if (this.#name !== undefined) return false;
        if (this.#syntacticCategories.length > 0) return false;
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
        name = normalConstId(name);
        return this.#scNormals.get(name);
    }

    lookupAbstraction(name : string) : Handle | undefined {
        name = normalConstId(name);
        return this.#abstrNormals.get(name);    
    }

    #addSyntacticCategory(decl : NameDecl) : Handle {
        const handle = this.#syntacticCategories.length;
        const info = new SyntacticCategoryInfo(decl);
        this.#syntacticCategories.push(info);
        this.#scNormals.set(decl.normal_short, handle);
        this.#scNormals.set(decl.normal_long, handle);
        this.#online_dag.addVertex(handle);
        return handle;
    }

    ensureSyntacticCategory(span : Span, decl : string, isNecessarilyDeclaration : boolean) : Handle | undefined {
        const nameDecl = NameDecl.mk(span, decl);
        if (nameDecl === undefined) {
            this.error(span, "Invalid syntactic category declaration '" + decl + "'.");
            return undefined;
        }
        const short = this.#scNormals.get(nameDecl.normal_short);
        const long = this.#scNormals.get(nameDecl.normal_long);
        if (short === undefined && long === undefined) {
            return this.#addSyntacticCategory(nameDecl);
        }
        const handle = force(short ?? long);
        if (isNecessarilyDeclaration || nameDecl.isDeclaration) {
            this.error(span, "Syntactic category is already declared as '" + this.#syntacticCategories[handle].decl.decl + "'.");
            return undefined;
        } else {
            return handle;
        }
    }

    addSyntacticCategoryPriority(span : Span, higher : Handle, lower : Handle, transitive : boolean) {
        if (this.#online_dag.hasEdge(higher, lower)) return;
        if (!this.#online_dag.addEdge(higher, lower)) {
            this.error(span, "This priority relation between syntactic categories introduces a cycle.");
            return;
        }
        const lsc = this.#syntacticCategories[lower];
        internal = true;
        if (transitive) {
            lsc.addLessThanTransitive(higher);
        } else {
            lsc.addLessThan(higher);
        }
        internal = false;
    }

    addSyntacticCategoryEquality(span : Span, first : Handle, second : Handle) {
        this.error(span, "Equality between syntactic categories is not supported (yet?).");
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
                this.error(bounds[i].span, "Duplicate binder variable '" + bounds[i] + "'.");
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
        const short = this.#abstrNormals.get(nameDecl.normal_short);
        const long = this.#abstrNormals.get(nameDecl.normal_long);
        if (short !== undefined || long !== undefined) {
            const handle = force(short ?? long);
            const info = this.#abstractions[handle];
            this.error(head.abstraction.span, "Abstraction is already declared elsewhere as: " + info.head);
            return this.#addSyntacticCategory(nameDecl);
        }
        const sc = this.ensureSyntacticCategory(head.abstraction.span, head.abstraction.str, true);
        if (sc === undefined) return;
        const info = new AbstractionInfo(head, nameDecl, shape, sc);
        this.#current = info;
    }

    endDeclaration() {
        if (this.#current === undefined) throw new Error("There is no declaration to finish, start one first.");
        const info = this.#current;
        this.#current = undefined;
        const handle = this.#abstractions.length;
        this.#abstractions.push(info);
        this.#abstrNormals.set(info.nameDecl.normal_short, handle);
        this.#abstrNormals.set(info.nameDecl.normal_long, handle);
    }

    #checkSyntaxSpec(info : AbstractionInfo, spec : SyntaxSpec) : boolean {
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

}
freeze(Theory);
