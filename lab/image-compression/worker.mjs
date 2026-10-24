import {
  encodeBmp,
  decodeBmp,
  encodePng,
  decodePng,
  encodeGif,
  decodeGif,
  flatten,
  metrics,
  codecOptions,
  matchSize,
} from "./model.mjs";
const basic = {
  bmp: [encodeBmp, decodeBmp],
  png: [encodePng, decodePng],
  gif: [encodeGif, decodeGif],
};
const absoluteNow = () => performance.timeOrigin + performance.now();
self.onmessage = async ({ data: task }) => {
  const received = absoluteNow(),
    start = performance.now();
  try {
    const { format, image, settings, target } = task;
    let encode, decode;
    if (basic[format]) [encode, decode] = basic[format];
    else {
      const codec = await import(`./vendor/${format}.mjs`);
      await codec.prepare();
      encode = (im, s) => codec.encode(im, codecOptions(format, s));
      decode = codec.decode;
    }
    const setupMs = performance.now() - start;
    const input =
      format === "jpeg" ? { ...image, data: flatten(image.data) } : image;
    let encodeMs = 0;
    const timedEncode = async (s) => {
      const t = performance.now();
      const bytes = await encode(input, s);
      encodeMs += performance.now() - t;
      return bytes;
    };
    let bytes,
      used = settings,
      match = null;
    if (target) {
      match = await matchSize(
        format,
        settings,
        target,
        timedEncode,
        (attempts, size) =>
          self.postMessage({ type: "progress", attempts, size }),
      );
      bytes = match.bytes;
      used = match.settings;
      delete match.bytes;
    } else bytes = await timedEncode(settings);
    const decodeStart = performance.now();
    const decoded = await decode(bytes);
    if (decoded.width !== image.width || decoded.height !== image.height)
      throw new Error("復号した画像の寸法が一致しません");
    const quality = metrics(image.data, decoded.data),
      decodeMs = performance.now() - decodeStart;
    self.postMessage(
      {
        type: "result",
        bytes,
        pixels: decoded.data,
        settings: used,
        match,
        quality,
        encodeMs,
        setupMs,
        decodeMs,
        waitMs: Math.max(0, received - task.queuedAt),
      },
      [bytes.buffer, decoded.data.buffer],
    );
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error.message || String(error),
    });
  }
};
