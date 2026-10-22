import { readDataset } from "../shared/data.mjs";
import { render } from "./view.mjs?v=20261023-distribution";
export { parseRows, displayedRows, binIndex, distribution } from "./model.mjs";

const EXAMPLE = [
  ...[36, 39, 41, 42, 44, 45, 45, 47, 49, 50, 52, 110].map((value, i) => ({
    id: `a${i}`,
    value,
    group: "A",
  })),
  ...[58, 61, 64, 65, 67, 68, 70, 72, 73, 76, 79, 145].map((value, i) => ({
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
  explanation: `<h3>分布と代表値を同じデータで見る</h3><p>度数分布表、分布と箱ひげ図、代表値計算はデータタブの同じ値を使います。平均は合計を個数で割る値で、外れ値の影響を受けます。中央値と四分位数は並べ替えた順位から求め、箱ひげ図だけでは山の数はわかりません。元の値とヒストグラムも併せて確かめます。</p><h3>棒・記号・模様の読み方</h3><p>階級は下端を含み、上端を含みません。相対度数の分母は全データ数です。群別表示ではAとBを同じ階級内に積み上げます。Aは丸・無地・実線、Bはひし形・斜線・破線で区別し、色だけに頼りません。群の人数が違う場合、この相対度数を群内の割合と取り違えないようにします。</p><h3>四分位数と外れ値候補</h3><p>奇数個のデータでは中央値の1個を除いた上下半分の中央値をQ₁・Q₃とします。四分位数には他の定義もあります。箱はQ₁〜Q₃で、IQRはQ₃−Q₁。ひげはQ₁−1.5IQR〜Q₃＋1.5IQRの内側の最小・最大の観測値まで伸ばし、外側の値を個別の記号で示します。外れ値候補は誤入力と断定せず、背景を調べます。</p><h3>分散・標準偏差</h3><p>偏差の和は0になるため、二乗してから足します。データ全体の分散は偏差平方和をnで割り、標準偏差はその平方根です。標本から母分散を推定する不偏分散はn−1で割りますが、その平方根自体が母標準偏差の不偏推定量になるわけではありません。</p><h3>発展：一元配置分散分析</h3><p>群間平方和は各群の平均と全体平均の差を人数で重み付けした二乗和、群内平方和は各観測と群平均との差の二乗和です。両者の和が全体平方和になります。群間をk−1、群内をN−kという自由度で割った平均平方の比がF値です。通常のF検定は観測の独立性、各群の誤差の正規性、等分散性を仮定します。外れ値のある教材サンプルで、前提を確認せずp値だけで結論を出すことは避けます。p値は帰無仮説が正しい確率ではなく、平均の差が原因によるものか、実用上重要かも別の判断です。</p>`,
  related: ["correlation", "hypothesis-test", "projects"],
};
