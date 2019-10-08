import { VNodeSlice } from "./slice";
import { VNode } from "@opennetwork/vnode";

export interface VNodeSliceInstructions {
  apply: boolean;
}

export interface VNodeSliceInstruction<Node extends VNode, ChildNode extends VNode> extends VNodeSlice<Node, ChildNode>, VNodeSliceInstructions {
  children?: AsyncIterable<VNodeSliceInstruction<ChildNode, ChildNode>>;
}

export async function *apply<Node extends VNode, ChildNode extends VNode>(slices: AsyncIterable<VNodeSlice<Node, ChildNode>>, equals: (left: Node | ChildNode, right: Node | ChildNode) => boolean, current?: VNodeSlice<Node, ChildNode>): AsyncIterable<VNodeSliceInstruction<Node, ChildNode>> {
  type ChildNodeSlice = VNodeSlice<ChildNode, ChildNode>;
  type ChildNodeIterable = AsyncIterable<ChildNodeSlice>;
  type ChildNodeIterableInstructions = AsyncIterable<VNodeSliceInstruction<ChildNode, ChildNode>>;

  let tracking = current;
  for await (const { node, children } of slices) {
    if (!tracking) {
      yield instruct({ node, children }, { apply: true });
    } else if (!children) {
      yield instruct({ node }, { apply: !equals(tracking.node, node) });
    } else if (!tracking.children) {
      yield instruct({ node, children }, { apply: false }, { apply: true });
    } else {
      yield {
        ...instruct(
          {
            node
          },
          {
            apply: !equals(tracking.node, node)
          }
        ),
        children: instructComparedChildren(tracking.children, children)
      };
    }
    tracking = { node, children };
  }

  async function *instructComparedChildren(tracking: ChildNodeIterable, children: ChildNodeIterable): ChildNodeIterableInstructions {
    type ChildNodeIteratorResult = IteratorResult<ChildNodeSlice>;
    type IteratorResultPromise = Promise<ChildNodeIteratorResult>;

    const trackingIterator = tracking[Symbol.asyncIterator](),
      childrenIterator = children[Symbol.asyncIterator]();

    let trackingNext: ChildNodeIteratorResult,
      childrenNext: ChildNodeIteratorResult;

    let lastTrackingValue: ChildNodeSlice = undefined;

    do {
      const childrenNextPromise: IteratorResultPromise = childrenIterator.next(),
        trackingNextPromise: IteratorResultPromise = (trackingNext && trackingNext.done) ? Promise.resolve(trackingNext) : trackingIterator.next();

      [trackingNext, childrenNext] = await Promise.all([
        trackingNextPromise,
        childrenNextPromise
      ]);

      // We can break out, we don't need to do anything more
      if (childrenNext.done) {
        break;
      }

      const childSlice: ChildNodeSlice = childrenNext.value;

      if (!childSlice) {
        break;
      }

      lastTrackingValue = trackingNext.done ? lastTrackingValue : (trackingNext.value || lastTrackingValue);

      const apply = lastTrackingValue ? !equals(lastTrackingValue.node, childSlice.node) : true;

      yield instruct(childSlice, { apply });

    } while (!childrenNext.done);

    if (!trackingNext.done) {
      await trackingIterator.return();
    }
  }

  function instruct<Node extends VNode>(slice: VNodeSlice<Node, ChildNode>, instructions: VNodeSliceInstructions, childrenInstructions: VNodeSliceInstructions = instructions): VNodeSliceInstruction<Node, ChildNode> {
    const { children, node } = slice;
    const instruction: VNodeSliceInstruction<Node, ChildNode> = {
      node,
      ...instructions
    };
    if (!children) {
      return instruction;
    }
    return {
      ...instruction,
      children: instructChildren(children, childrenInstructions)
    };
  }

  async function *instructChildren(children: ChildNodeIterable, instructions: VNodeSliceInstructions): AsyncIterable<VNodeSliceInstruction<ChildNode, ChildNode>> {
    for await (const child of children) {
      yield instruct(child, instructions, instructions);
    }
  }
}
