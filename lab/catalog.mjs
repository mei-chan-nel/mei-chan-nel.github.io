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
    id: "color-vision",
    group: "information-design",
    name: "色覚シミュレーター",
    description: "文化祭の案内を段階的に改善。通常・P型・D型・T型を比べ、色に頼らない伝え方を見つけよう。自分の画像もブラウザ内で確認できます。",
  },
];
