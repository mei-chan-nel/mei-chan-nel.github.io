import { esc } from "./ui.mjs";
const jmaMonthly =
  "https://www.data.jma.go.jp/stats/etrn/view/monthly_s3.php?prec_no=44&block_no=47662&year=&month=&day=&view=a1";
const jmaDaily = (month) =>
  `https://www.data.jma.go.jp/stats/etrn/view/daily_s1.php?prec_no=44&block_no=47662&year=2025&month=${month}&day=&view=`;
const household = [
  "総務省統計局「家計調査」",
  "https://www.e-stat.go.jp/stat-search/database?layout=datalist&toukei=00200561&tstat=000000330001",
];
const iceTable = [
  "日本アイスクリーム協会・家計調査実績（月別表）",
  "https://www.icecream.or.jp/iceworld/data/expenditures.html",
];
const iceArchive = [
  "2016〜2020年の月別表を転載した公開資料",
  "https://github.com/tail-island/machine-learning-primer/blob/d2bfc058889a43d6ff7c14d677616aee7e0e3cf1/ice_cream/dataset.py",
];
const admissions = [
  "R datasets「UCBAdmissions」（原研究の書誌・集計値）",
  "https://stat.ethz.ch/R-manual/R-devel/library/datasets/html/UCBAdmissions.html",
];
const info = {
  "time-series": {
    scope:
      "全国・二人以上の世帯、1世帯当たりのアイスクリーム・シャーベットへの月別支出金額。2016年1月〜2025年12月、120か月、円。",
    interpretation:
      "夏に高く冬に低い周期と、近年の支出水準の変化を分けて読みます。支出額には価格の変化も含まれるため、購入個数の増加とは限りません。季節調整値は、この教材で公表値から計算した値です。",
    links: [household, iceTable, iceArchive],
  },
  correlation: {
    scope:
      "2016〜2025年の120か月。各行は同じ月の、東京の月平均気温（℃）と全国・二人以上の世帯の1世帯当たりアイスクリーム・シャーベット支出金額（円）の組です。",
    interpretation:
      "夏の暑い月ほど支出が多い関係が見えます。東京の気温と全国の支出を対応させた月別の関連であり、個人の行動や、気温だけの因果効果を表すものではありません。",
    links: [
      ["気象庁・東京の月平均気温", jmaMonthly],
      household,
      iceTable,
      iceArchive,
    ],
  },
  histogram: {
    scope:
      "東京の日最高気温。2025年6月30日分と7月31日分、計61日、℃。各月の日付順。6月9日の25.9℃は気象庁の準正常値（資料の一部不足）として収録しています。",
    interpretation:
      "7月には35℃前後の日が多い一方、11日の25.1℃など低い日もあります。月ごとに分けると、全体の分布では目立たない外れ値の候補を見つけられます。連続する日の観測なので、発展の分散分析を独立な無作為標本の検定として解釈することはできません。",
    links: [
      ["気象庁・東京2025年6月の日別値", jmaDaily(6)],
      ["気象庁・東京2025年7月の日別値", jmaDaily(7)],
    ],
  },
  summary: {
    scope: "東京の日最高気温。2025年7月、31日、℃。",
    interpretation: "低温の日が平均と中央値に与える違いを確かめます。",
    links: [["気象庁・東京2025年7月の日別値", jmaDaily(7)]],
  },
  sampling: {
    scope:
      "東京の月平均気温。2016年1月〜2025年12月、120か月、℃。各行は月順です。抽出単位は人ではなく、1か月分の観測値です。",
    interpretation:
      "ここでは掲載した120か月を固定した母集団とし、その期間平均を無作為抽出で推定します。日本全体の気温や将来の気温を推定しているわけではありません。季節の偏りがある取り方と、無作為抽出の違いも考えてみましょう。",
    links: [["気象庁・東京の月平均気温", jmaMonthly]],
  },
  crosstab: {
    scope:
      "米国UCバークレー大学大学院、1973年の学科AとFの志願者1,647人。大学全体の集計ではありません。公表された人数の集計値を、属性の組ごとに人数分の匿名行へ展開しています。個人識別情報・元の個票ではありません。",
    interpretation:
      "合計では男性の合格率が高い一方、学科AでもFでも女性の方が高くなります。合格率の高い学科Aへ志願した割合が男女で違うためです。この2学科の比較だけで、大学全体の公平性や性別の因果効果は判断できません。",
    links: [admissions],
  },
  "hypothesis-test": {
    scope: "Nightingale & Farid（2022）の実験1。オンライン参加者315人が各128枚（本物64枚・AI生成64枚）の顔写真を判定。計40,320回、正答19,415回。公開された回答表から1人ごとの判定枚数・正答数を集計し、参加者番号だけをP001〜P315へ置き換えています。",
    interpretation: "参加者ごとの正答率の平均は48.15%、論文の報告は48.2%（95%信頼区間47.1〜49.2%）。教材の初期設定（基準50%・両側）で1標本t検定を再計算すると、両側p≈0.000627です。基準や方向を変えると別の問い・計算になります。50%を下回る方向の差であり、偶然よりよく見分けられたという結果ではありません。この画像群と実験条件についての分析で、日本の高校生や現在の生成画像全般へそのまま一般化はできません。「判断の誤り」は、参加者の正答率を正規分布で近似した別の調査計画です。",
    links: [["Nightingale & Farid（2022）, PNAS・原論文", "https://doi.org/10.1073/pnas.2120481119"], ["著者公開の実験データ（OSF）", "https://osf.io/ru36d/"]],
  },
  lorenz: {
    scope:
      "厚生労働省「2023年国民生活基礎調査」表44、2022年の所得。各行は世帯を所得順に20%ずつ分けた五分位階級の平均所得、万円／世帯・年です。",
    interpretation:
      "各階級が同じ世帯数を代表するので、各点で世帯割合が20%ずつ増えます。階級内の所得差を省いて線で結ぶため、表示するジニ係数は五分位データによる近似値です。個票から算出した公表ジニ係数とは異なります。再配分は階級の平均を動かす仮想の比較です。",
    links: [
      [
        "厚生労働省「国民生活基礎調査」表44（e-Stat）",
        "https://www.e-stat.go.jp/dbview?sid=0004021276",
      ],
    ],
  },
};
export function publicDatasetInfo(id) {
  return info[id] ? structuredClone(info[id]) : null;
}
export function renderSources(dataset, changed = false) {
  if (!dataset) return "";
  return `<section class="data-provenance" aria-label="データの出典と読み取り"><h2>データの出典と読み取り</h2><p>${esc(dataset.scope)}</p><p>${esc(dataset.interpretation)}</p>${changed ? '<p class="annotation">現在は公開データを元に値や人数を変更した比較です。元の実測値・公表値ではありません。「公開データを使用」で元の値に戻せます。</p>' : ""}<p>出典：${dataset.links
    .filter(([, href]) => /^https:\/\//.test(href))
    .map(
      ([name, href]) =>
        `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(name)}</a>`,
    )
    .join(
      " ／ ",
    )}。<a href="../shared/datasets/README.md" target="_blank" rel="noopener">収録範囲・加工方法</a></p></section>`;
}
