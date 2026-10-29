import { metrics, difference } from "./model.mjs";
self.onmessage = ({ data: { id, a, b, gain, diff } }) => {
  const quality = metrics(a, b),
    pixels = diff ? difference(a, b, gain) : null;
  self.postMessage({ id, quality, pixels }, pixels ? [pixels.buffer] : []);
};
