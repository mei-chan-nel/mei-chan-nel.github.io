import { simulatePixels } from './simulation.mjs';
self.onmessage = ({ data: { id, pixels } }) => {
  try {
    const results = ['p', 'd', 't'].map((type) => ({ type, pixels: simulatePixels(pixels, type) }));
    self.postMessage({ id, results }, results.map((r) => r.pixels.buffer));
  } catch {
    self.postMessage({ id, error: 'シミュレーションを計算できませんでした。小さい画像で再度お試しください。' });
  }
};
