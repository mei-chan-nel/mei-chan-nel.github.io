import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  quantize,
  grayValue,
  integralImage,
  averagePixels,
  convertPixels,
} from "../lab/digital-image/pixels.mjs";
test("quantization has exactly 2^b levels and a fixed-width code", () => {
  for (let bits = 1; bits <= 8; bits++) {
    const codes = new Set();
    for (let v = 0; v <= 255; v++) {
      const q = quantize(v, bits);
      codes.add(q.code);
      assert.equal(q.binary.length, bits);
      assert.equal(parseInt(q.binary, 2), q.code);
      assert.ok(q.display >= 0 && q.display <= 255);
    }
    assert.equal(codes.size, 2 ** bits);
    assert.equal(quantize(0, bits).display, 0);
    assert.equal(quantize(255, bits).display, 255);
  }
  assert.deepEqual(
    [0, 127, 128, 255].map((v) => quantize(v, 1).display),
    [0, 0, 255, 255],
  );
  assert.deepEqual(
    [0, 85, 170, 255].map((v) => quantize(v, 2).display),
    [0, 85, 170, 255],
  );
});
test("area sampling averages a full region and weights partial pixels", () => {
  // Two columns: black, white. A 3-wide output has black, 50% gray, white.
  const rgba = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);
  const integral = integralImage(rgba, 2, 1);
  assert.deepEqual(
    Array.from(averagePixels(integral, 1)),
    [127.5, 127.5, 127.5],
  );
  const thirds = averagePixels(integral, 3);
  assert.ok(Math.abs(thirds[0]) < 0.001);
  assert.ok(Math.abs(thirds[3] - 127.5) < 0.001);
  assert.ok(Math.abs(thirds[6] - 255) < 0.001);
  // Resampling to the original dimensions preserves every pixel value.
  const square = new Uint8ClampedArray([
    10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255, 100, 110, 120, 255,
  ]);
  assert.deepEqual(
    Array.from(averagePixels(integralImage(square, 2, 2), 2)),
    [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120],
  );
});
test("RGB components use independent bit depths; component view only masks display", () => {
  const averages = new Float32Array([100, 150, 200]);
  const settings = {
    mode: "color",
    bits: [1, 2, 3],
    grayBits: 8,
    channel: "rgb",
  };
  assert.deepEqual(
    Array.from(convertPixels(averages, settings)),
    [0, 170, 182, 255],
  );
  assert.deepEqual(
    Array.from(convertPixels(averages, { ...settings, channel: "g" })),
    [0, 170, 0, 255],
  );
  assert.deepEqual(settings.bits, [1, 2, 3]);
  assert.ok(Math.abs(grayValue(255, 0, 0) - 76.245) < 0.0001);
  assert.deepEqual(
    Array.from(
      convertPixels(averages, { ...settings, mode: "gray", grayBits: 1 }),
    ),
    [255, 255, 255, 255],
  );
});
test("Lab links the image exhibit under digital representation and its public pages are indexable", async () => {
  const home = await readFile(
    new URL("../lab/index.html", import.meta.url),
    "utf8",
  );
  assert.equal((home.match(/href="\.\/digital-image\/"/g) || []).length, 1);
  const page = await readFile(
    new URL("../lab/digital-image/index.html", import.meta.url),
    "utf8",
  );
  for (const html of [home, page]) {
    assert.doesNotMatch(html, /<meta name="robots" content="[^"]*noindex/);
    assert.doesNotMatch(html, /googletagmanager|adsbygoogle/);
  }
});
