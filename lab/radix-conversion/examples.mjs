// Each example has a specific teaching purpose, rather than using a number
// that happens to convert in a single step.
export const CONVERSION_EXAMPLES = {
  "decimal-binary": {
    source: 10, value: "45.6875", target: 2,
    focus: "整数は6回の割り算、小数は4回の掛け算。桁を読む向きの違いを確認します。",
  },
  "decimal-hex": {
    source: 10, value: "427.734375", target: 16,
    focus: "整数は3回、小数は2回計算します。10＝A、11＝B、12＝Cへの読み替えに注目。",
  },
  position: {
    source: 2, value: "101101.1011", target: 10,
    focus: "整数6桁・小数4桁を分解します。0の桁も位置を数え、小数点の右には負の指数を使います。",
  },
  "hex-decimal": {
    source: 16, value: "1AB.BC", target: 10,
    focus: "A＝10、B＝11、C＝12に読み替えてから計算。小数のBは11そのものではなく、11×16⁻¹です。",
  },
  "binary-hex": {
    source: 2, value: "110101011.101111", target: 16,
    focus: "整数3組・小数2組に区切ります。端の0による桁合わせと、1011＝11＝Bの対応を確認します。",
  },
  "hex-binary": {
    source: 16, value: "1AB.BC", target: 2,
    focus: "5つの桁をそれぞれ4ビットにします。B＝11＝1011と、各組の先頭の0に注目。",
  },
  cycle: {
    source: 10, value: "0.1", target: 2,
    focus: "同じ余りに戻ると、その先の桁も循環します。最初の0と、繰り返す0011を区別します。",
  },
};
