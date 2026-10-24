import { academicExplanation } from "../shared/reading.mjs?v=20261024-proportional-area";
import { readDataset } from "../shared/data.mjs";
import { render } from "./view.mjs?v=20261024-proportional-area";
export { parseRows, displayedRows, binIndex, distribution } from "./model.mjs";

const EXAMPLE = [
  ...[32, 36, 38, 40, 42, 43, 44, 45, 47, 49, 52, 56].map((value, i) => ({
    id: `a${i}`,
    value,
    group: "A",
  })),
  ...[42, 53, 57, 60, 61, 62, 63, 64, 65, 67, 70, 73].map((value, i) => ({
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
      width: 5,
      start: 0,
      mode: "split",
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
    width: 5,
    start: 0,
    mode: "split",
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
  title: "データの分布",
  description: "分布・箱ひげ図・代表値計算から、群の違いと外れ値を調べる。",
  lead: "同じデータでも、区切り方が変わると違う姿が見えてきます。まず階級幅を動かして、元の点と棒の関係を調べましょう。",
  initial,
  render,
  explanation: academicExplanation("histogram"),
  related: ["correlation", "hypothesis-test", "projects"],
};
