import { normalConstId } from "../identifier";
import { identifierL } from "../term_parser";
import { nat, string } from "../things/primitives";
import { mkOrderAndHash } from "../things/things";
import { freeze, privateConstructor } from "../things/utils";

export class Identifier {
    static #internal : boolean = false
    id : string
    normal : string
    constructor(id : string, normal : string) {
        if (!Identifier.#internal) privateConstructor("Identifier");
        this.id = id;
        this.normal = normal;
        freeze(this);
    }
    toString() : string {
        return this.id;
    }
    static make(id : string) : Identifier | undefined {
        const len = identifierL(id, 0);
        if (len !== id.length) return undefined;
        Identifier.#internal = true;
        const normal = normalConstId(id);
        const made = new Identifier(id, normal);
        Identifier.#internal = false;
        return made;
    }
    static thing = mkOrderAndHash<Identifier>("Identifier", 
        x => x instanceof Identifier,
        (x, y) => string.compare(x.normal, y.normal),
        x => string.hash(x.id));
}
freeze(Identifier);

/*export const IdentifierT = mkOrderAndHash<Identifier>("Identifier", 
    x => x instanceof Identifier,
    (x, y) => string.compare(x.normal, y.normal),
    x => string.hash(x.id));*/

export class Identifiers implements Iterable<Identifier> {
    static #internal : boolean = false
    components : Identifier[]
    constructor(components : Identifier[]) {
        if (!Identifiers.#internal) privateConstructor("Identifiers");
        this.components = components;
        freeze(this);
    }
    [Symbol.iterator](): Iterator<Identifier, any, undefined> {
        return this.components[Symbol.iterator]();
    }
    get length() : nat {
        return this.components.length;
    }
    toString() : string {
        return this.components.map(c => c.toString()).join("\\");
    }
    static make(ids : Identifier[]) : Identifiers | undefined {
        const components = [...ids];
        freeze(components);
        for (const id of components) {
            if (!(id instanceof Identifier)) return undefined;
        }
        Identifiers.#internal = true;
        const made = new Identifiers(components);
        Identifiers.#internal = false;
        return made;
    }    
}
freeze(Identifiers);
