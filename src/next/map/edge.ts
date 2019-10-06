import { VNode } from "@opennetwork/vnode";

export interface VEdge extends VNode {
  target: VNode;
  scalar: true;
  // Can never have a value
  children?: undefined;
}
