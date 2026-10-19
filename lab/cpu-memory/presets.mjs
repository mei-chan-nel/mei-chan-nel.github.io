import { SIZE } from "./model.mjs";
const memory = (program, data = {}) => {
  const cells = Array.from({ length: SIZE }, () => ({ op: "data", arg: 0 }));
  program.forEach(([op, arg = 0], i) => (cells[i] = { op, arg }));
  Object.entries(data).forEach(
    ([address, arg]) => (cells[+address] = { op: "data", arg }),
  );
  return cells;
};
export const presets = [
  {
    id: "addition",
    name: "基本の加算",
    hint: "16番地と17番地を足して18番地へ。16・17番地は同じブロックなので、2回目の参照はどうなる？",
    memory: memory([["load", 16], ["add", 17], ["store", 18], ["halt"]], {
      16: 7,
      17: 5,
    }),
  },
  {
    id: "repeat",
    name: "同じ番地を参照",
    hint: "16番地を繰り返し使う。キャッシュを2個から1個へ減らして、命令との取り合いを観察しよう。",
    memory: memory(
      [
        ["set", 0],
        ["add", 16],
        ["add", 16],
        ["add", 16],
        ["add", 16],
        ["store", 18],
        ["halt"],
      ],
      { 16: 3 },
    ),
  },
  {
    id: "sequential",
    name: "連続する番地",
    hint: "16・17・18・19番地を順番に加算。同じブロックに入る隣の数値が、高速化につながるか確かめよう。",
    memory: memory(
      [
        ["set", 0],
        ["add", 16],
        ["add", 17],
        ["add", 18],
        ["add", 19],
        ["store", 24],
        ["halt"],
      ],
      { 16: 1, 17: 2, 18: 3, 19: 4 },
    ),
  },
  {
    id: "scattered",
    name: "離れた番地",
    hint: "同じ1・2・3・4を離して配置。連続する番地のプリセットと計算結果・時間を比べよう。",
    memory: memory(
      [
        ["set", 0],
        ["add", 16],
        ["add", 20],
        ["add", 24],
        ["add", 28],
        ["store", 30],
        ["halt"],
      ],
      { 16: 1, 20: 2, 24: 3, 28: 4 },
    ),
  },
  {
    id: "loop",
    name: "繰り返し処理",
    hint: "16番地の値を1ずつ減らし、0で終了。命令の再利用、条件分岐、ライトスルーを観察しよう。",
    memory: memory(
      [
        ["load", 16],
        ["sub", 17],
        ["store", 16],
        ["zero", 5],
        ["jump", 0],
        ["halt"],
      ],
      { 16: 5, 17: 1 },
    ),
  },
];
