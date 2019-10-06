import { Fragment, VNode } from "@opennetwork/vnode";
import { merge } from "@opennetwork/progressive-merge";
import { asyncExtendedIterable } from "iterable";

interface VNodeSlice {
  node: VNode;
  children?: AsyncIterable<VNodeSlice>;
}

export async function *slice(node: VNode): AsyncIterable<VNodeSlice> {

  if (!node.children) {
    return yield { node };
  }

  let yielded;

  for await (const children of node.children) {

    // This will produce a set of slices for each available child
    const layers = merge(
      asyncExtendedIterable(children).map(child => child ? slice(child) : undefined),
      { done: false, value: undefined }
    );

    // Values will always grow, but never shrink
    const values: VNodeSlice[] = [];

    for await (const layer of layers) {
      let index = -1;

      yield {
        node,
        children: asyncExtendedIterable(layer)
          .map((result): VNodeSlice => {
            // Map is invoked in order, which means we can rely on this index to record values to retain for when
            // a child is done
            index += 1;
            const value = (result.done ? values[index] : result.value) || { node: { reference: Fragment } };
            values[index] = value;
            return value;
          })
      };

      // Flag that we have yielded at least one slice
      yielded = true;
    }

  }

  if (!yielded) {
    yield { node };
  }

}

