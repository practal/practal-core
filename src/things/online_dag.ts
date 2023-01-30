import { nat } from "./primitives";
import { force, freeze, notImplemented } from "./utils";

type Node<V> = { level : nat, in : Set<V>, out : Set<V> }

/** 
 * Based on the paper ["A New Approach to Incremental Cycle Detection and Related Problems"](https://doi.org/10.1145/2756553). 
 * This is the first algorithm they present in their paper in Section 2.
 **/
export class OnlineDAG<V> {

    #vertices : Map<V, Node<V>>
    #edgeCount : nat
    
    constructor() {
        this.#vertices = new Map();
        this.#edgeCount = 0;
        freeze(this);
    }

    addVertex(vertex : V) : boolean {
        const node = this.#vertices.get(vertex);
        if (node !== undefined) return false;
        this.#vertices.set(vertex, { level : 1, in : new Set(), out : new Set() });
        return true;
    }

    hasVertex(vertex : V) : boolean {
        return this.#vertices.has(vertex);
    }

    hasEdge(from : V, to : V) : boolean {
        const node = this.#vertices.get(from);
        if (node === undefined) return false;
        return node.out.has(to);
    }

    #ensure(vertex : V) : Node<V> {
        let node = this.#vertices.get(vertex);
        if (node !== undefined) return node;
        throw new Error("No vertex " + vertex + " in graph.");
    }

    #connect(from : V, fromNode : Node<V>, to : V, toNode : Node<V>) {
        fromNode.out.add(to);
        if (fromNode.level === toNode.level) {
            toNode.in.add(from);
        }
        this.#edgeCount += 1;
    }

    #delta() : number {
        const n = this.#vertices.size;
        const m = this.#edgeCount;
        return Math.min(Math.sqrt(m), Math.pow(n, 2/3));
    }    

    #searchBackward(from : V, to : V) : { visited : Set<V>, cyclic : boolean, cancelled : boolean } {
        const delta = this.#delta();
        const visited : Set<V> = new Set();
        const queue : V[] = [from];
        visited.add(from);
        let arcs = 0;
        while (arcs < delta) {
            const u = queue.pop();
            if (u === undefined) return { visited : visited, cyclic : false, cancelled : false };
            const node = force(this.#vertices.get(u));
            for (const i of node.in) {
                arcs += 1;
                if (!visited.has(i)) {
                    visited.add(i);
                    if (i === to) return { visited : visited, cyclic : true, cancelled : false };
                    queue.push(i);
                }
            }
        }
        return { visited : visited, cyclic : false, cancelled : true };
    }

    /** Returns true if cycle was found. */
    #searchForward(start : V, target : Set<V>) : boolean {
        const visited : Set<V> = new Set();
        const queue : V[] = [start];
        while (true) {
            const u = queue.pop();
            if (u === undefined) return false;
            const unode = this.#ensure(u);
            for (const v of unode.out) {
                if (target.has(v)) return true;
                const vnode = this.#ensure(v);
                if (unode.level === vnode.level) {
                    vnode.in.add(u);
                } else if (unode.level > vnode.level) {
                    vnode.level = unode.level;
                    vnode.in.clear();
                    vnode.in.add(u);
                    if (!visited.has(v)) {
                        visited.add(v);
                        queue.push(v);
                    }
                }
            }
        }
    }

    /** Returns true if the edge is part of the graph afterwards, false if the edge was rejected because of a cycle. */
    addEdge(from : V, to : V) : boolean {
        const nodeFrom = this.#ensure(from);
        if (from === to) return false;
        if (nodeFrom.out.has(to)) return true;
        const nodeTo = this.#ensure(to);
        if (nodeFrom.level < nodeTo.level) {
            this.#connect(from, nodeFrom, to, nodeTo);
            return true;
        }
        const B = this.#searchBackward(from, to);
        if (B.cyclic) return false;
        let target : Set<V> 
        if (!B.cancelled && nodeFrom.level === nodeTo.level) {
            if (nodeFrom.level === nodeTo.level) {
                this.#connect(from, nodeFrom, to, nodeTo);
                return true;
            }
            nodeTo.level = nodeFrom.level;
            target = B.visited;
        } else {
            nodeTo.level = nodeFrom.level + 1;
            target = new Set();
            target.add(from);
        }
        nodeTo.in.clear();
        if (this.#searchForward(to, target)) return false;
        this.#connect(from, nodeFrom, to, nodeTo);
        return true;
    }

}
freeze(OnlineDAG);