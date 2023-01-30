import { nat } from "../things/primitives";
import { assertTrue, freeze, privateConstructor } from "../things/utils.js";

export class Shape {

    static #internal : boolean = false;

    valence : number;
    arity : number;
    shape : number[][];
    
    constructor(shape : Iterable<Iterable<nat>>) {
        if (!Shape.#internal) privateConstructor("Shape");
        let max_dep = -1;
        let result = [];
        for (const deps of shape) {
            let max_d = -1;
            let ds = [];
            for (const d of deps) {
                if (nat.is(d) && d > max_d) {
                    max_d = d;
                    ds.push(d);
                } else {
                    throw new Error(`Shape: invalid dependencies in argument ${result.length}`);
                }
            }
            if (max_d > max_dep) max_dep = max_d;
            Object.freeze(ds);
            result.push(ds);
        }
        Object.freeze(result);
        let used = Array(max_dep + 1);
        used.fill(false);
        for (const deps of result) {
            for (const d of deps) {
                used[d] = true;
            }
        }
        for (const [i, u] of used.entries()) {
            if (!u) {
                throw new Error(`Shape: missing dependency on variable ${i}`);
            }
        } 
        this.shape = result;
        this.valence = max_dep + 1;
        this.arity = result.length;
        freeze(this);
    }

    valenceAt(index : nat) : nat {
        return this.shape[index].length;
    }

    toString() : string {
        let s = `(${this.valence};`;
        let first = true;
        for (const deps of this.shape) {
            if (first) first = false; else  s += ",";
            s += ` {${deps}}`;
        }
        s += ")";
        return s;
    }
   
    static make(shape : number [][]) {
        this.#internal = true;
        const s = new Shape(shape);
        this.#internal = false;
        return s;
    }

    static value = Shape.make([]);

    static unary = Shape.make([[]]);

    static binary = Shape.make([[], []]);

    static operator = Shape.make([[0]]);

    static isShape(x : any) : x is Shape {
        return x instanceof Shape;
    }

    static assertShape(x : any) : asserts x is Shape {
        if (!Shape.isShape(x)) throw new Error("invalid shape");
    }

    static overlapping(x : Shape, y : Shape) : boolean {
        return x.valence == y.valence && x.arity == y.arity;
    }

}
freeze(Shape);

export class ShapeWithNames {
    shape : Shape
    bounds : string[]
    frees : string[]

    constructor(shape : Shape, bounds : string[], frees : string[]) {
        this.shape = shape;
        this.bounds = [...bounds];
        this.frees = [...frees];
        freeze(this);
    }

}
freeze(ShapeWithNames);

