import { VNode } from "@opennetwork/vnode";
import { VEdge } from "./edge";
import { asyncIterable, AsyncIterableLike, isAsyncIterable, isIterable } from "iterable";

export interface VGraph {

  set(node: VNode, ...edges: (VEdge | AsyncIterableLike<VEdge>)[]): Promise<void>;
  put(node: VNode, ...edges: (VEdge | AsyncIterableLike<VEdge>)[]): Promise<void>;
  get(node: VNode): AsyncIterable<VEdge>;
  delete(node: VNode): Promise<boolean>;
  has(node: VNode): Promise<boolean>;

}

async function *arrayUnion(...values: (VEdge | AsyncIterableLike<VEdge>)[]): AsyncIterable<VEdge> {
  for (const value of values) {
    if (isAsyncIterable(value) || isIterable(value)) {
      yield* value;
    } else {
      yield value;
    }
  }
}

export function isVGraph(value: unknown): value is VGraph {
  function isVGraphLike(value: unknown): value is { set?: unknown, put?: unknown, get?: unknown, delete?: unknown, has?: unknown } {
    return typeof value === "object";
  }
  return (
    isVGraphLike(value) &&
    typeof value.set === "function" &&
    typeof value.put === "function" &&
    typeof value.get === "function" &&
    typeof value.delete === "function" &&
    typeof value.has === "function"
  );
}

export class VGraph {

  constructor(private graph: VGraph | Map<VNode, AsyncIterable<VEdge>> | WeakMap<VNode, AsyncIterable<VEdge>> = new WeakMap()) {

  }

  async set(node: VNode, ...edges: (VEdge | AsyncIterableLike<VEdge>)[]): Promise<void> {
    await this.graph.set(node, arrayUnion(...edges));
  }

  async put(node: VNode, ...edges: (VEdge | AsyncIterableLike<VEdge>)[]): Promise<void> {
    if (isVGraph(this.graph)) {
      await this.graph.put(node, ...edges);
    } else {
      await this.set(node, arrayUnion(this.get(node), ...edges));
    }
  }

  get(node: VNode): AsyncIterable<VEdge> {
    return this.graph.get(node) || asyncIterable([]);
  }

  async delete(node: VNode): Promise<boolean> {
    return this.graph.delete(node);
  }

  async has(node: VNode): Promise<boolean> {
    return this.graph.has(node);
  }

}
