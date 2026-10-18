import {
  zlibSync,
  unzlibSync,
  GIFEncoder,
  quantize,
  applyPalette,
  GifReader,
} from "./vendor/basic.mjs";

export const formats = ["bmp", "png", "gif", "jpeg", "webp", "avif"];
export const labels = {
  original: "元画像",
  bmp: "BMP",
  png: "PNG",
  gif: "GIF",
  jpeg: "JPEG",
  webp: "WebP",
  avif: "AVIF",
};
export const mime = {
  bmp: "image/bmp",
  png: "image/png",
  gif: "image/gif",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
};
export const defaults = {
  bmp: { alpha: true },
  png: { level: 6, filter: true },
  gif: { colors: 256, threshold: 128 },
  jpeg: { quality: 75, chroma: 2 },
  webp: { quality: 75, lossless: false, method: 4 },
  avif: { quality: 50, lossless: false, speed: 8, subsample: 1 },
};
export const canTarget = (format, settings) =>
  ["gif", "jpeg"].includes(format) ||
  (["webp", "avif"].includes(format) && !settings.lossless);
export const bytesLabel = (n) =>
  n < 1000
    ? `${n} B`
    : n < 1e6
      ? `${(n / 1000).toFixed(1)} kB`
      : `${(n / 1e6).toFixed(2)} MB`;
export const ratio = (bytes, rawBytes) => (bytes / rawBytes) * 100;

export function flatten(data) {
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    for (let c = 0; c < 3; c++)
      out[i + c] = Math.round(data[i + c] * a + 255 * (1 - a));
    out[i + 3] = 255;
  }
  return out;
}

// RGB PSNR is measured on the visible image composited over white. Alpha is
// measured separately so loss of transparency cannot hide behind a good PSNR.
export function metrics(a, b) {
  if (a.length !== b.length || !a.length)
    throw new Error("Pixel dimensions differ");
  let error = 0,
    alphaError = 0,
    exact = true;
  for (let i = 0; i < a.length; i += 4) {
    for (let c = 0; c < 4; c++) if (a[i + c] !== b[i + c]) exact = false;
    alphaError += Math.abs(a[i + 3] - b[i + 3]);
    for (let c = 0; c < 3; c++) {
      const av = (a[i + c] * a[i + 3]) / 255 + 255 - a[i + 3];
      const bv = (b[i + c] * b[i + 3]) / 255 + 255 - b[i + 3];
      error += (av - bv) ** 2;
    }
  }
  const mse = error / ((a.length / 4) * 3);
  return {
    psnr: mse === 0 ? Infinity : 10 * Math.log10(255 ** 2 / mse),
    mse,
    alphaMae: alphaError / (a.length / 4),
    exact,
  };
}
export function difference(a, b, gain = 4) {
  const out = new Uint8ClampedArray(a.length);
  for (let i = 0; i < a.length; i += 4) {
    // Include alpha differences even when both images appear white.
    const alpha = Math.abs(a[i + 3] - b[i + 3]);
    for (let c = 0; c < 3; c++) {
      const av = (a[i + c] * a[i + 3]) / 255 + 255 - a[i + 3],
        bv = (b[i + c] * b[i + 3]) / 255 + 255 - b[i + 3];
      out[i + c] = Math.min(255, Math.max(Math.abs(av - bv), alpha) * gain);
    }
    out[i + 3] = 255;
  }
  return out;
}

export function encodeBmp({ data, width, height }, { alpha }) {
  const header = alpha ? 122 : 54,
    stride = alpha ? width * 4 : Math.ceil((width * 3) / 4) * 4;
  const bytes = new Uint8Array(header + stride * height),
    v = new DataView(bytes.buffer);
  bytes.set([66, 77]);
  v.setUint32(2, bytes.length, true);
  v.setUint32(10, header, true);
  v.setUint32(14, alpha ? 108 : 40, true);
  v.setInt32(18, width, true);
  v.setInt32(22, height, true);
  v.setUint16(26, 1, true);
  v.setUint16(28, alpha ? 32 : 24, true);
  v.setUint32(30, alpha ? 3 : 0, true);
  v.setUint32(34, stride * height, true);
  if (alpha) {
    [0xff0000, 0xff00, 0xff, 0xff000000, 0x73524742].forEach((n, i) =>
      v.setUint32(54 + i * 4, n, true),
    );
  }
  const pixels = alpha ? data : flatten(data);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4,
        dst = header + (height - y - 1) * stride + x * (alpha ? 4 : 3);
      bytes[dst] = pixels[src + 2];
      bytes[dst + 1] = pixels[src + 1];
      bytes[dst + 2] = pixels[src];
      if (alpha) bytes[dst + 3] = pixels[src + 3];
    }
  return bytes;
}
export function decodeBmp(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    width = v.getInt32(18, true),
    height = v.getInt32(22, true),
    alpha = v.getUint16(28, true) === 32;
  const data = new Uint8ClampedArray(width * height * 4),
    offset = v.getUint32(10, true),
    stride = alpha ? width * 4 : Math.ceil((width * 3) / 4) * 4;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const dst = (y * width + x) * 4,
        src = offset + (height - y - 1) * stride + x * (alpha ? 4 : 3);
      data[dst] = bytes[src + 2];
      data[dst + 1] = bytes[src + 1];
      data[dst + 2] = bytes[src];
      data[dst + 3] = alpha ? bytes[src + 3] : 255;
    }
  return { data, width, height };
}

const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function chunk(type, data) {
  const out = new Uint8Array(data.length + 12),
    v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  let crc = 0xffffffff;
  for (let i = 4; i < out.length - 4; i++)
    crc = crcTable[(crc ^ out[i]) & 255] ^ (crc >>> 8);
  v.setUint32(out.length - 4, (crc ^ 0xffffffff) >>> 0);
  return out;
}
function join(arrays) {
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let pos = 0;
  for (const a of arrays) {
    out.set(a, pos);
    pos += a.length;
  }
  return out;
}
const paeth = (a, b, c) => {
  const p = a + b - c,
    pa = Math.abs(p - a),
    pb = Math.abs(p - b),
    pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};
function predictor(type, left, up, corner) {
  return type === 0
    ? 0
    : type === 1
      ? left
      : type === 2
        ? up
        : type === 3
          ? Math.floor((left + up) / 2)
          : paeth(left, up, corner);
}
export function encodePng({ data, width, height }, { level, filter }) {
  const stride = width * 4,
    raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    let best,
      score = Infinity,
      bestType = 0;
    for (let type = 0; type < (filter ? 5 : 1); type++) {
      const row = new Uint8Array(stride);
      let s = 0;
      for (let x = 0; x < stride; x++) {
        const i = y * stride + x,
          p = predictor(
            type,
            x >= 4 ? data[i - 4] : 0,
            y ? data[i - stride] : 0,
            y && x >= 4 ? data[i - stride - 4] : 0,
          );
        row[x] = (data[i] - p) & 255;
        s += Math.min(row[x], 256 - row[x]);
      }
      if (s < score) {
        best = row;
        score = s;
        bestType = type;
      }
    }
    raw[y * (stride + 1)] = bestType;
    raw.set(best, y * (stride + 1) + 1);
  }
  const header = new Uint8Array(13),
    v = new DataView(header.buffer);
  v.setUint32(0, width);
  v.setUint32(4, height);
  header.set([8, 6], 8);
  return join([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlibSync(raw, { level })),
    chunk("IEND", new Uint8Array()),
  ]);
}
export function decodePng(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    width = v.getUint32(16),
    height = v.getUint32(20),
    parts = [];
  for (let pos = 8; pos < bytes.length;) {
    const len = v.getUint32(pos),
      type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    if (type === "IDAT") parts.push(bytes.subarray(pos + 8, pos + 8 + len));
    pos += len + 12;
  }
  const raw = unzlibSync(join(parts)),
    stride = width * 4,
    data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x,
        type = raw[y * (stride + 1)];
      data[i] =
        (raw[y * (stride + 1) + x + 1] +
          predictor(
            type,
            x >= 4 ? data[i - 4] : 0,
            y ? data[i - stride] : 0,
            y && x >= 4 ? data[i - stride - 4] : 0,
          )) &
        255;
    }
  return { data, width, height };
}

export function encodeGif({ data, width, height }, { colors, threshold }) {
  // Reserve a palette slot for binary transparency; partial opacity is matted
  // against white, then made opaque. GIF cannot store semi-transparent pixels.
  const rgba = flatten(data);
  let transparent = false;
  for (let i = 0; i < data.length; i += 4)
    if (data[i + 3] < threshold) {
      rgba[i] = rgba[i + 1] = rgba[i + 2] = 0;
      transparent = true;
    }
  const available = colors - (transparent ? 1 : 0),
    unique = new Map();
  for (let i = 0; i < rgba.length; i += 4)
    if (data[i + 3] >= threshold) {
      const key = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
      if (!unique.has(key)) unique.set(key, unique.size);
      if (unique.size > available) break;
    }
  let palette, index;
  if (unique.size <= available) {
    palette = [...unique.keys()].map((k) => [k >> 16, (k >> 8) & 255, k & 255]);
    if (!palette.length) palette = [[0, 0, 0]];
    index = new Uint8Array(width * height);
    for (let i = 0; i < index.length; i++)
      index[i] =
        unique.get(
          (rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2],
        ) ?? 0;
  } else {
    palette = quantize(rgba, Math.max(1, available));
    index = applyPalette(rgba, palette);
  }
  const transparentIndex = transparent ? palette.length : 0;
  if (transparent) {
    palette.push([0, 0, 0]);
    for (let i = 0; i < index.length; i++)
      if (data[i * 4 + 3] < threshold) index[i] = transparentIndex;
  }
  const gif = GIFEncoder();
  gif.writeFrame(index, width, height, {
    palette,
    transparent,
    transparentIndex,
    repeat: -1,
  });
  gif.finish();
  return gif.bytes();
}
export function decodeGif(bytes) {
  const reader = new GifReader(bytes),
    data = new Uint8ClampedArray(reader.width * reader.height * 4);
  reader.decodeAndBlitFrameRGBA(0, data);
  return { data, width: reader.width, height: reader.height };
}

export function codecOptions(format, s) {
  if (format === "jpeg")
    return {
      quality: s.quality,
      auto_subsample: false,
      chroma_subsample: s.chroma,
    };
  if (format === "webp")
    return {
      quality: s.lossless ? 75 : s.quality,
      lossless: s.lossless ? 1 : 0,
      method: s.method,
      exact: 1,
    };
  if (format === "avif")
    return {
      quality: s.lossless ? 100 : s.quality,
      qualityAlpha: 100,
      lossless: s.lossless,
      speed: s.speed,
      subsample: s.lossless ? 3 : s.subsample,
    };
  return s;
}

// Search actual encoded files, retaining the closest result rather than
// assuming sizes are perfectly monotonic. The result records feasibility.
export async function matchSize(
  format,
  settings,
  target,
  encode,
  progress = () => {},
) {
  if (!Number.isFinite(target) || target <= 0)
    throw new Error("Invalid target size");
  if (!canTarget(format, settings))
    throw new Error("This mode cannot target file size");
  let best = null,
    attempts = 0,
    minSize = Infinity,
    maxSize = 0;
  const tryValue = async (value) => {
    const candidate = {
      ...settings,
      [format === "gif" ? "colors" : "quality"]: value,
    };
    const encoded = await encode(candidate);
    attempts++;
    minSize = Math.min(minSize, encoded.length);
    maxSize = Math.max(maxSize, encoded.length);
    const error = Math.abs(encoded.length - target);
    if (!best || error < best.error)
      best = { bytes: encoded, settings: candidate, error };
    progress(attempts, encoded.length);
    return encoded.length;
  };
  if (format === "gif") {
    for (const n of [2, 4, 8, 16, 32, 64, 128, 256]) await tryValue(n);
  } else {
    let lo = 1,
      hi = 100;
    await tryValue(lo);
    await tryValue(hi);
    for (let i = 0; i < 6 && hi - lo > 1; i++) {
      const mid = Math.floor((lo + hi) / 2),
        size = await tryValue(mid);
      if (size > target) hi = mid;
      else lo = mid;
    }
  }
  return {
    ...best,
    attempts,
    target,
    minSize,
    maxSize,
    within: best.error / target <= 0.1,
  };
}
