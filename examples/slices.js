import { Fragment, withContext, createVNode } from "@opennetwork/vnode";
import htm from "htm";
import { slice } from "../dist/next/slice/index.js";
import { asyncExtendedIterable } from "iterable";

const context = {};
const h = withContext(context);
const html = htm.bind(h);

const node = html`
  <main ...${{}}>
    <section ...${{}}>
        <h1 ...${{}}>Title</h1>
        <p ...${{}}>Content</p>
    </section>
    ${createVNode({}, Fragment, { reference: Fragment }, html`<button ...${{ }}>Do something</button>`)}
  </main>
`;

asyncExtendedIterable(slice(node))
  .map(async slice => {
    const serialised = await serialise(slice);
    console.log(JSON.stringify(serialised, null, "  "))

  })
  .toArray()
  .catch(console.error)
  .then(() => console.log("Complete"));

async function serialise(slice) {
  if (!slice.children) {
    return slice;
  }
  return {
    ...slice,
    children: await asyncExtendedIterable(slice.children).map(serialise).toArray()
  }
}
