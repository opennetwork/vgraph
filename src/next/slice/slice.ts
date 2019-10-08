import { Fragment, FragmentVNode, isFragmentVNode, VNode } from "@opennetwork/vnode";
import { merge } from "@opennetwork/progressive-merge";
import { asyncExtendedIterable } from "iterable";

export interface VNodeSlice<Node extends VNode, ChildNode extends VNode> {
  node: Node;
  children?: AsyncIterable<VNodeSlice<ChildNode, ChildNode>>;

}

export interface EmptyFragmentVNode extends FragmentVNode {
  children?: undefined;
}

export async function *slice<Node extends VNode, ChildNode extends VNode>(node: Node): AsyncIterable<VNodeSlice<Node, ChildNode | EmptyFragmentVNode>> {
  type ChildNodeOrFragment = ChildNode | EmptyFragmentVNode;

  if (!node.children) {
    return yield { node };
  }

  let yielded;

  for await (const children of node.children) {

    // This will produce a set of slices for each available child
    const layers = merge(
      asyncExtendedIterable(children).map(child => child ? slice(child) : undefined),
      undefined
    );

    // Values will always grow, but never shrink
    const values: VNodeSlice<ChildNodeOrFragment, ChildNodeOrFragment>[] = [];

    for await (const layer of layers) {
      yield {
        node,
        children: generateChildren(values, layer)
      };

      // Flag that we have yielded at least one slice
      yielded = true;
    }

  }

  if (!yielded) {
    yield { node };
  }

  function generateChildren(values: VNodeSlice<ChildNodeOrFragment, ChildNodeOrFragment>[], layer: AsyncIterable<IteratorResult<VNodeSlice<ChildNodeOrFragment, ChildNodeOrFragment>> | undefined>) {
    // We require a fixed scope for our index variable
    let index = -1;

    return asyncExtendedIterable(layer)
      .map((result): VNodeSlice<ChildNodeOrFragment, ChildNodeOrFragment> => {
        // Map is invoked in order, which means we can rely on this index to record values to retain for when
        // a child is done
        index += 1;
        const value = (result ? (result.done ? values[index] : result.value) : undefined) || { node: { reference: Fragment }, fragment: true };
        values[index] = value;
        return value;
      })
      .flatMap(flatMap)
      .retain();
  }

  async function *flatMap(slice: VNodeSlice<ChildNodeOrFragment, ChildNodeOrFragment>): AsyncIterable<VNodeSlice<ChildNodeOrFragment, ChildNodeOrFragment>> {
    if (!isFragmentVNode(slice.node) || !slice.children) {
      return yield slice;
    }
    return yield* asyncExtendedIterable(slice.children).flatMap(flatMap).retain();
  }

}

