import type { Draft } from './types.js';
export const samples: { name: string; draft: Draft }[] = [
  { name: '合計', draft: { version: 1, title: '2つの値の合計', source: 'x = 3\ny = 4\ngoukei = x + y\n表示する("合計は", goukei, "です。")', settings: { indexBase: 0, inputs: {} } } },
  { name: '配列の平均', draft: { version: 1, title: '配列の平均点', source: 'Tokuten = [5, 7, 8, 4]\nsum = 0\ni を 0 から 要素数(Tokuten) - 1 まで 1 ずつ増やしながら繰り返す：\n  sum = sum + Tokuten[i]\naverage = sum / 要素数(Tokuten)\n表示する("平均点は", average, "点です。")', settings: { indexBase: 0, inputs: {} } } },
  { name: '二次元配列', draft: { version: 1, title: '二次元配列を順番に読む', source: 'Data = [[3, 5, 9], [2, 4, 6]]\nsum = 0\ni を 0 から 要素数(Data) - 1 まで 1 ずつ増やしながら繰り返す：\n  j を 0 から 要素数(Data[i]) - 1 まで 1 ずつ増やしながら繰り返す：\n    sum = sum + Data[i, j]\n表示する("合計は", sum)', settings: { indexBase: 0, inputs: {} } } },
];
