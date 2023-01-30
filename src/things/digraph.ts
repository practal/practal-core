import { int, nat } from "./primitives";
import { freeze } from "./utils";

export type Vertex = int

/** 
 * This class implements directed graphs:
 * * Vertices are represented as integers.
 * * All edges are directed, and there are no multi-edges.
 */
export class Digraph {

    #edges : Map<Vertex, Set<Vertex>>
    #edge_count : nat

    constructor() {
        this.#edges = new Map();
        this.#edge_count = 0;
        freeze(this);
    }

    clone() : Digraph {
        const g = new Digraph();
        for (const [vertex, succs] of this.#edges) {
            g.#edges.set(vertex, new Set(succs));
        }
        g.#edge_count = this.#edge_count;
        return g;
    }

    insert(vertex : Vertex) : boolean {
        int.assert(vertex);
        const succs = this.#edges.get(vertex);
        if (succs === undefined) {
            this.#edges.set(vertex, new Set());
            return true;
        } else {
            return false;
        }
    }

    hasVertex(vertex : Vertex) : boolean {
        return this.#edges.has(vertex);
    }

    hasEdge(from : Vertex, to : Vertex) : boolean {
        const edges = this.#edges.get(from);
        if (edges === undefined) return false;
        return edges.has(to);
    }

    connect(from : Vertex, to : Vertex) : boolean {
        int.assert(from);
        int.assert(to);
        let changed : boolean;
        const succs = this.#edges.get(from);
        if (succs === undefined) {
            changed = true;
            this.#edges.set(from, new Set([to]));            
        } else {
            changed = !succs.has(to);
            if (changed) succs.add(to);
        }
        if (changed) {
            this.#edge_count++;  
            if (this.#edges.get(to) === undefined) {
                this.#edges.set(to, new Set());  
            }        
        }
        return changed;
    }

    get vertices() : Iterable<Vertex> {
        const edges = this.#edges;
        function *it() { yield* edges.keys(); };
        return it();
    }

    outgoing(vertex : Vertex) : Iterable<Vertex> {
        const succs = this.#edges.get(vertex);
        if (succs === undefined) return [];
        const out = succs
        function *it() { yield* out; }
        return it();
    }

    get isEmpty() : boolean {
        return this.vertexCount === 0;
    }

    /** The number of vertices of this graph */
    get vertexCount() : nat {
        return this.#edges.size;
    }

    /** The number of edges of this graph */
    get edgeCount() : nat {
        return this.#edge_count;
    }

    /** The number of edges and vertices of this graph */
    get size() : nat {
        return this.vertexCount + this.edgeCount;
    }

}
freeze(Digraph);

export type DFSNode = {
    parent : Vertex | null,
    discovered : nat,
    finished : nat
}

export function depthFirstSearch(graph : Digraph, vertices : Iterable<Vertex> = graph.vertices) : Map<Vertex, DFSNode> {
    let nodes : Map<Vertex, DFSNode> = new Map();
    let timestamp = 0;

    function visit(parent : Vertex | null, vertex : Vertex) {
        let node = nodes.get(vertex);
        if (node !== undefined) return;
        node = { parent : parent, discovered : ++timestamp, finished : 0 };
        nodes.set(vertex, node);
        for (const succ of graph.outgoing(vertex)) {
            visit(vertex, succ);
        }
        node.finished = ++timestamp;
    }

    for (const vertex of vertices) visit(null, vertex);

    return nodes;
}
freeze(depthFirstSearch);

export function forestOfDFS(dfs : Map<Vertex, DFSNode>) : Digraph {
    let graph : Digraph = new Digraph();
    for (const [vertex, node] of dfs) {
        graph.insert(vertex);
        if (node.parent !== null) {
            graph.connect(node.parent, vertex);
        }
    }
    return graph;
}
freeze(forestOfDFS);

export function depthFirstSearchForest(graph : Digraph, vertices : Iterable<Vertex> = graph.vertices) : Digraph {
    const dfs = depthFirstSearch(graph, vertices);
    return forestOfDFS(dfs);
}
freeze(depthFirstSearchForest);

export function transposeDigraph(graph : Digraph) : Digraph {
    let transposed : Digraph = new Digraph();
    for (const from of graph.vertices) {
        transposed.insert(from);
        for (const to of graph.outgoing(from)) {
            transposed.connect(to, from);
        }
    }
    return transposed;
}
freeze(transposeDigraph);

export function symmetricClosure(graph : Digraph) : Digraph {
    let symmetric : Digraph = new Digraph();
    for (const from of graph.vertices) {
        symmetric.insert(from);
        for (const to of graph.outgoing(from)) {
            symmetric.connect(from, to);
            symmetric.connect(to, from);
        }
    }
    return symmetric;
}
freeze(symmetricClosure);

export function reachableFrom(graph : Digraph, start : Iterable<Vertex>) : Set<Vertex> {
    let processing = [...start];
    let hull : Set<Vertex> = new Set();
    while (processing.length > 0) {
        const vertex = processing.pop()!;
        for (const succ of graph.outgoing(vertex)) {
            if (!hull.has(succ)) {
                processing.push(succ);
                hull.add(succ);
            }
        }
    }
    return hull;
}
freeze(reachableFrom);

export function closureFrom(graph : Digraph, start : Iterable<Vertex>) : Set<Vertex> {
    let processing = [...start];
    let hull = new Set(processing);
    while (processing.length > 0) {
        const vertex = processing.pop()!;
        for (const succ of graph.outgoing(vertex)) {
            if (!hull.has(succ)) {
                processing.push(succ);
                hull.add(succ);
            }
        }
    }
    return hull;    
}
freeze(closureFrom);

export function transitiveClosure(graph : Digraph) : Digraph {
    const closure = graph.clone();
    while (true) {
        const oldsize = closure.size;
        for (const vertex of closure.vertices) {
            for (const succ of closure.outgoing(vertex)) {
                for (const succ_succ of closure.outgoing(succ)) {
                    closure.connect(vertex, succ_succ);
                }
            }
        }
        if (closure.size === oldsize) return closure;
    }
}

/** 
 * Assigns to each vertex V of the graph a unique index S(V) such that 0 ≤ S(V) < graph.vertexCount.
 * If the graph is acyclic, and if there is an edge from A to B in the graph with A ≠ B, then S(A) < S(B). 
 */
export function topologicalSort(graph : Digraph, vertices : Iterable<Vertex> = graph.vertices) : Map<Vertex, nat> {
    let sorted : Map<Vertex, nat> = new Map();
    let visited : Set<Vertex> = new Set();

    const count = graph.vertexCount;

    function visit(vertex : Vertex) {
        if (visited.has(vertex)) return;
        visited.add(vertex);
        for (const succ of graph.outgoing(vertex)) {
            visit(succ);
        }
        sorted.set(vertex, count - sorted.size - 1);
    }

    for (const vertex of vertices) visit(vertex);

    return sorted;
}
freeze(topologicalSort);

export function backEdgesOfTopologicalSort(graph : Digraph, topsort : Map<Vertex, nat>) : Digraph {
    const g = new Digraph();
    for (const from of graph.vertices) {
        const rank_from = topsort.get(from)!;
        for (const to of graph.outgoing(from)) {
            const rank_to = topsort.get(to)!;
            if (rank_from >= rank_to) g.connect(from, to);
        }
    }
    return g;
}
freeze(backEdgesOfTopologicalSort);

/** 
 * Orders the vertices of a directed graph by finishing times, later times appear at higher array indices.
 */
 export function topologicalSortByFinish(
    graph : Digraph, vertices : Iterable<Vertex> = graph.vertices) : Vertex[] 
{
    let sorted : Vertex[] = [];
    let visited : Set<Vertex> = new Set();

    const count = graph.vertexCount;

    function visit(vertex : Vertex) {
        if (visited.has(vertex)) return;
        visited.add(vertex);
        for (const succ of graph.outgoing(vertex)) {
            visit(succ);
        }
        sorted.push(vertex);
    }

    for (const vertex of vertices) visit(vertex);

    return sorted;
}
freeze(topologicalSortByFinish);

export function weaklyConnectedComponents(graph : Digraph) : Set<Vertex>[] {
    let components : Set<Vertex>[] = [];
    let processed : Set<Vertex> = new Set();
    
    graph = symmetricClosure(graph);

    function visit(vertex : Vertex) {
        if (processed.has(vertex)) return;
        const component = closureFrom(graph, [vertex]);
        components.push(component);
        for (const vertex of component) {
            processed.add(vertex);
        }
    }
    
    for (const vertex of graph.vertices) visit(vertex);

    return components;
}
freeze(weaklyConnectedComponents);

export function stronglyConnectedComponents(graph : Digraph) : Set<Vertex>[] {
    const vertices = topologicalSortByFinish(graph);
    vertices.reverse();
    graph = transposeDigraph(graph);
    const forest = depthFirstSearchForest(graph, vertices);
    return weaklyConnectedComponents(forest);
}
freeze(stronglyConnectedComponents);



