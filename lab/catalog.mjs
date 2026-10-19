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
// generated: false preserves an independently authored page during shell builds.
export const contents = [
  {
    id: "cpu-memory",
    group: "algorithm",
    styles: ["memory.css?v=1"],
    scripts: ["app.mjs?v=1"],
    name: "CPUと記憶装置",
    description: "RAMの命令を書き換えてCPUを動かす。キャッシュのヒット・ミス、計算結果と実行時間を実験して比べよう。",
  },
  {
    id: "color-vision",
    group: "information-design",
    generated: false,
    name: "色覚シミュレーター",
    description: "文化祭の案内を段階的に改善。通常・P型・D型・T型を比べ、色に頼らない伝え方を見つけよう。自分の画像もブラウザ内で確認できます。",
  },
  {
    id: "question-map",
    group: "information-design",
    standalone: false,
    styles: ["question-map.css?v=12"],
    scripts: ["question-map.mjs?v=13"],
    name: "問題マップ",
    description:
      "知識の地形を地図のように探索。近づくと言葉から問題へ、気になる問題を開くと選択肢・解説へ。学習履歴は色の地形に。",
  },
  {
    id: "thinking-tools",
    group: "society-security",
    generated: false,
    name: "思考ツール",
    description:
      "付箋、原因の枝、アイデア、比較表。7つの段階を行き来しながら、考えをつなぐ。プリセット体験・自由作成に対応。",
  },
  {
    id: "relational-database",
    group: "data-database",
    styles: ["database.css?v=1"],
    scripts: ["app.mjs?v=1"],
    name: "リレーショナルデータベース",
    description:
      "自分で表をつくり、関係をつなぐ。結合・射影・選択を操作して、必要なデータを取り出そう。",
  },
  {
    id: "radix-conversion",
    group: "digital-representation",
    generated: false,
    name: "進数の変換",
    description:
      "2・10・16進数を、途中計算で理解する。整数・小数・循環小数と4ビットの対応を試してみよう。",
  },
  {
    id: "packet-routing",
    group: "network",
    generated: false,
    name: "パケット通信とルーティング",
    description:
      "メッセージを送り、回線を切り、ネットワークをつなぎ変える。ルータの判断と経路の更新を観察しよう。",
  },
  {
    id: "image-compression",
    group: "digital-representation",
    standalone: false,
    styles: ["compression.css?v=6"],
    scripts: ["app.mjs?v=5"],
    name: "画像圧縮",
    description: "同じ画像を6形式で圧縮。サイズ・画質・処理時間を比べ、拡大と差分で圧縮の違いを探ろう。",
  },
  {
    id: "digital-image",
    group: "digital-representation",
    styles: ["image.css?v=4"],
    scripts: ["image.mjs?v=8"],
    name: "画像のデジタル化",
    description:
      "画素数と量子化ビット数を変えて、元画像と見比べる。RGBの各成分も表示できます。",
  },
  {
    id: "digital-audio",
    group: "digital-representation",
    styles: ["audio.css?v=5"],
    scripts: ["audio.mjs?v=5"],
    name: "音のデジタル化",
    description:
      "標本化周波数と量子化ビット数を変えて、音と波形を比較。標本点や折り返しも確かめます。",
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
    description:
      "図記号をつないで手順を作り、1つずつ実行。変数・分岐・繰返しを図で確かめます。",
  },
];
