// Match the learning app's six subject areas.
export const groups = [
  {
    id: "society-security",
    name: "社会・セキュリティ",
    color: "violet",
    hint: "情報と社会の関わり、安心して情報を扱うためのしくみ。",
  },
  {
    id: "digital-representation",
    name: "デジタル表現",
    color: "blue",
    hint: "文字・数・画像・音を、コンピュータで扱える形に。",
  },
  {
    id: "network",
    name: "ネットワーク",
    color: "mint",
    hint: "情報を届ける道と、通信を支える約束ごと。",
  },
  {
    id: "data-database",
    name: "データ活用・DB",
    color: "amber",
    hint: "データを集め、整理し、つなげて、意味を見つける。",
  },
  {
    id: "algorithm",
    name: "アルゴリズム",
    color: "coral",
    hint: "問題を解く手順と、コンピュータが処理を進めるしくみ。",
  },
  {
    id: "information-design",
    name: "情報デザイン",
    color: "pink",
    hint: "相手に伝わり、使いやすい情報のかたちを考える。",
  },
];

// Add completed exhibits here; category headings are not content cards.
export const contents = [
  {
    id: "digital-image",
    group: "digital-representation",
    styles: ["image.css?v=3"],
    scripts: ["image.mjs?v=7"],
    name: "画像のデジタル化",
    description:
      "画素数と量子化ビット数を変えて、元画像と見比べる。RGBの各成分も表示できます。",
  },
  {
    id: "logic-circuit",
    group: "digital-representation",
    styles: ["circuit.css?v=8"],
    scripts: ["editor.mjs?v=9"],
    name: "論理回路をつくる",
    description:
      "AND・OR・NOTと分岐を配置して配線。各ゲートの出力と真理値表を見比べます。",
  },
  {
    id: "flowchart",
    group: "algorithm",
    styles: ["../logic-circuit/circuit.css?v=8", "flowchart.css?v=5"],
    scripts: ["editor.mjs?v=9"],
    name: "フローチャートをつくる",
    description: "図記号をつないで手順を作り、1つずつ実行。変数・分岐・繰返しを図で確かめます。",
  },
];
