// Values here are encoded RGB intensities (0..255), not linear-light radiance.
export const resolutions = [
  4, 8, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768, 1024,
];
export function quantize(value, bits) {
  const max = 2 ** bits - 1;
  const code = Math.round((Math.min(255, Math.max(0, value)) * max) / 255);
  return {
    code,
    display: Math.round((code * 255) / max),
    binary: code.toString(2).padStart(bits, "0"),
  };
}
export const grayValue = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
export function integralImage(data, width, height) {
  const stride = width + 1;
  const planes = Array.from(
    { length: 3 },
    () => new Uint32Array(stride * (height + 1)),
  );
  for (let y = 0; y < height; y++) {
    const row = [0, 0, 0];
    for (let x = 0; x < width; x++) {
      const from = (y * width + x) * 4,
        to = (y + 1) * stride + x + 1;
      for (let c = 0; c < 3; c++) {
        row[c] += data[from + c];
        planes[c][to] = planes[c][to - stride] + row[c];
      }
    }
  }
  return { planes, width, height, stride };
}
// Bilinear evaluation of the summed-area table integrates partial source pixels.
function areaAt(plane, x, y, { width, height, stride }) {
  const ix = Math.min(width - 1, Math.floor(x)),
    iy = Math.min(height - 1, Math.floor(y));
  const fx = x - ix,
    fy = y - iy,
    p = iy * stride + ix;
  return (
    plane[p] * (1 - fx) * (1 - fy) +
    plane[p + 1] * fx * (1 - fy) +
    plane[p + stride] * (1 - fx) * fy +
    plane[p + stride + 1] * fx * fy
  );
}
export function averagePixels(integral, size) {
  const out = new Float32Array(size * size * 3);
  const dx = integral.width / size,
    dy = integral.height / size,
    area = dx * dy;
  for (let y = 0; y < size; y++) {
    const y0 = y * dy,
      y1 = (y + 1) * dy;
    for (let x = 0; x < size; x++) {
      const x0 = x * dx,
        x1 = (x + 1) * dx,
        p = (y * size + x) * 3;
      for (let c = 0; c < 3; c++) {
        const plane = integral.planes[c];
        out[p + c] = Math.min(
          255,
          Math.max(
            0,
            (areaAt(plane, x1, y1, integral) -
              areaAt(plane, x0, y1, integral) -
              areaAt(plane, x1, y0, integral) +
              areaAt(plane, x0, y0, integral)) /
              area,
          ),
        );
      }
    }
  }
  return out;
}
export function convertPixels(averages, { mode, bits, grayBits, channel }) {
  const out = new Uint8ClampedArray((averages.length / 3) * 4);
  for (let p = 0, to = 0; p < averages.length; p += 3, to += 4) {
    if (mode === "gray") {
      const v = quantize(
        grayValue(averages[p], averages[p + 1], averages[p + 2]),
        grayBits,
      ).display;
      out[to] = out[to + 1] = out[to + 2] = v;
    } else {
      for (let c = 0; c < 3; c++)
        out[to + c] =
          channel === "rgb" || channel === "rgb"[c]
            ? quantize(averages[p + c], bits[c]).display
            : 0;
    }
    out[to + 3] = 255;
  }
  return out;
}
