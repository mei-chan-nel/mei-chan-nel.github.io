import { fromProgram } from "./conversion.mjs";
import { defaultInput } from "./studio.mjs";
export const examples = [
  {
    id: "addition",
    name: "2つの値の合計",
    source: "x = 3\ny = 4\n合計 = x + y\n表示する(合計)",
  },
  {
    id: "decision",
    name: "条件で分岐",
    source:
      '点数 = 72\nもし 点数 >= 60 ならば：\n  表示する("合格")\nそうでなければ：\n  表示する("再挑戦")',
  },
  {
    id: "sum",
    name: "1から5まで足す",
    source:
      "合計 = 0\ni を 1 から 5 まで 1 ずつ増やしながら繰り返す：\n  合計 = 合計 + i\n表示する(合計)",
  },
  {
    id: "while",
    name: "条件で繰り返す",
    source:
      '残り = 3\n残り > 0 の間繰り返す：\n  表示する(残り)\n  残り = 残り - 1\n表示する("終了")',
  },
  {
    id: "input",
    name: "入力して偶数・奇数を判定",
    source:
      '数 = 【外部からの入力】\nもし 数 % 2 == 0 ならば：\n  表示する("偶数")\nそうでなければ：\n  表示する("奇数")',
    inputs: { 数: defaultInput() },
  },
  {
    id: "array",
    name: "配列から値を探す",
    source:
      "Data = [3, 7, 12, 18, 25]\n探す値 = 18\n場所 = -1\ni を 0 から 要素数(Data) - 1 まで 1 ずつ増やしながら繰り返す：\n  もし Data[i] == 探す値 ならば：\n    場所 = i\n表示する(場所)",
  },
  {
    id: "function",
    name: "関数を呼び出す",
    source:
      "x = 7\n結果 = 二倍(x)\n表示する(結果)\n定義する 二倍(n)：\n  返す n * 2",
  },
  {
    id: "fibonacci",
    name: "再帰でフィボナッチ",
    source:
      "結果 = フィボナッチ(5)\n表示する(結果)\n定義する フィボナッチ(n)：\n  もし n <= 1 ならば：\n    返す n\n  返す フィボナッチ(n - 1) + フィボナッチ(n - 2)",
  },
];
export function exampleDocument(id) {
  const e = examples.find((e) => e.id === id);
  if (!e) throw Error("例を選んでください。");
  return fromProgram({
    version: 1,
    title: e.name,
    source: e.source,
    settings: { indexBase: 0, inputs: e.inputs ?? {} },
  });
}
