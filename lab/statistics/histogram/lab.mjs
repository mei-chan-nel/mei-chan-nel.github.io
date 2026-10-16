import { readDataset } from "../shared/data.mjs";
import { render } from "./view.mjs";
export { parseRows, displayedRows, binIndex, distribution } from "./model.mjs";

const EXAMPLE = [
  ...[36, 39, 41, 42, 44, 45, 45, 47, 49, 50, 52, 55].map((value, i) => ({
    id: `a${i}`,
    value,
    group: "A",
  })),
  ...[58, 61, 64, 65, 67, 68, 70, 72, 73, 76, 79, 83].map((value, i) => ({
    id: `b${i}`,
    value,
    group: "B",
  })),
];
function initial() {
  if (
    typeof location !== "undefined" &&
    new URLSearchParams(location.search).get("dataset") === "project"
  ) {
    const data = readDataset(),
      field =
        new URLSearchParams(location.search).get("field") === "x" ? "x" : "y";
    const groups = [
      ...new Set(data.rows.map((r) => String(r.group ?? "未指定"))),
    ];
    return {
      groupNames: [groups[0] || "A", groups.slice(1).join("・") || "B"],
      showEditor: false,
      rows: data.rows.map((r, i) => ({
        id: r.id || `p${i}`,
        value: r[field],
        group: String(r.group ?? "未指定") === groups[0] ? "A" : "B",
      })),
      width: 10,
      start: 0,
      mode: "combined",
      measure: "count",
      shiftB: 0,
      selected: -1,
      source: data.name,
      label: field === "x" ? data.xLabel : data.yLabel,
      error: "",
    };
  }
  return {
    groupNames: ["A", "B"],
    showEditor: false,
    rows: EXAMPLE.map((r) => ({ ...r })),
    width: 10,
    start: 0,
    mode: "combined",
    measure: "count",
    shiftB: 0,
    selected: -1,
    source: "架空の24人がクイズを解き終わるまでの時間",
    label: "所要時間（秒）",
    error: "",
  };
}
export default {
  id: "histogram",
  title: "データの分布とヒストグラム",
  description: "階級の区切り方と集団の合成で、隠れていた分布を見つける。",
  lead: "同じデータでも、区切り方が変わると違う姿が見えてきます。まず階級幅を動かして、元の点と棒の関係を調べましょう。",
  initial,
  render,
  explanation: `<h3>棒が表しているもの</h3><p>度数は階級に入るデータの個数です。相対度数は「その階級の個数 ÷ 全データ数」、累積相対度数は「その階級までの個数の合計 ÷ 全データ数」です。度数分布表の行を選ぶと、分子に入った点を確認できます。このラボは等しい階級幅を用いるため、棒の高さで度数を比較できます。幅の異なる階級を使う場合は、面積が度数に対応するよう度数密度を用います。</p><h3>集計によって失われる情報</h3><p>階級内のどこに値があるかは、ヒストグラムだけではわかりません。平均・中央値や生データも合わせて確かめましょう。階級の開始位置を変えるだけで山や谷の印象が変わることがあります。都合のよい区切りだけを選ばず、複数の幅と開始位置を比較すると読み取りの頑健さを検討できます。</p><h3>混ぜる前に、分けてみる</h3><p>二つの集団を合成すると、集団ごとにはない山や広がりが現れる場合があります。たとえば課題の経験の違う人を一緒に集計すると、個人差と集団差が混ざります。色別表示の相対度数は全体を分母とするため、集団人数が違うと棒の高さだけでは集団内の割合を比較できません。その場合は集団別に個数を数え、それぞれの人数で割る必要があります。</p><h3>境界と読み取りの注意</h3><p>各階級は下端を含み、上端を含みません。たとえば50以上60未満に60は入りません。基準位置より小さいデータも左側の階級に入り、すべてのデータが集計されます。割合は表示時だけ丸めるため、表示値の合計が100%からわずかにずれる場合があります。累積相対度数は、その階級の上端未満の値が全体に占める割合です。最後の階級で100%になります。</p>`,
  related: ["summary", "correlation", "projects"],
};
