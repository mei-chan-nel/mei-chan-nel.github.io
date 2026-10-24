// Brettel, Viénot & Mollon (1997), full dichromacy, sRGB / Smith–Pokorny 1975.
// Parameters adapted from Nicolas Burrus's public-domain libDaltonLens:
// https://github.com/DaltonLens/libDaltonLens/blob/master/libDaltonLens.c
// RGB white is the neutral axis. Two projection planes are used for EVERY type.
export const PARAMETERS = {
  p: {
    a: [.14980, 1.19548, -.34528, .10764, .84864, .04372, .00384, -.00540, 1.00156],
    b: [.14570, 1.16172, -.30742, .10816, .85291, .03892, .00386, -.00524, 1.00139],
    n: [.00048, .00393, -.00441],
  },
  d: {
    a: [.36477, .86381, -.22858, .26294, .64245, .09462, -.02006, .02728, .99278],
    b: [.37298, .88166, -.25464, .25954, .63506, .10540, -.01980, .02784, .99196],
    n: [-.00281, -.00611, .00892],
  },
  t: {
    a: [1.01277, .13548, -.14826, -.01243, .86812, .14431, .07589, .80500, .11911],
    b: [.93678, .18979, -.12657, .06154, .81526, .12320, -.37562, 1.12767, .24796],
    n: [.03901, -.02788, -.01113],
  },
};
export const decode = (v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
export const encode = (v) => Math.round(255 * (v <= 0 ? 0 : v >= 1 ? 1 : v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055));
const linear = Float64Array.from({ length: 256 }, (_, i) => decode(i / 255));
export function simulateRGB(rgb, type) {
  if (type === 'normal') return [...rgb];
  const {a, b, n} = PARAMETERS[type];
  const [r, g, bl] = rgb.map((v) => linear[v]);
  const m = r*n[0] + g*n[1] + bl*n[2] >= 0 ? a : b;
  return [encode(m[0]*r + m[1]*g + m[2]*bl), encode(m[3]*r + m[4]*g + m[5]*bl), encode(m[6]*r + m[7]*g + m[8]*bl)];
}
// Input must already be composited onto the actual viewing background.
export function simulatePixels(input, type) {
  const out = new Uint8ClampedArray(input.length);
  const {a, b, n} = PARAMETERS[type];
  for (let i = 0; i < input.length; i += 4) {
    const r = linear[input[i]], g = linear[input[i+1]], bl = linear[input[i+2]];
    const m = r*n[0] + g*n[1] + bl*n[2] >= 0 ? a : b;
    out[i] = encode(m[0]*r + m[1]*g + m[2]*bl);
    out[i+1] = encode(m[3]*r + m[4]*g + m[5]*bl);
    out[i+2] = encode(m[6]*r + m[7]*g + m[8]*bl);
    out[i+3] = input[i+3];
  }
  return out;
}
export const fromHex = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i+2), 16));
export function contrast(foreground, background) {
  const luminance = (hex) => fromHex(hex).map((v) => decode(v/255)).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
