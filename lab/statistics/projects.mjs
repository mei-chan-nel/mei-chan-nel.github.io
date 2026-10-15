import { readDataset, saveDataset, defaultDataset } from "./shared/data.mjs";
import { esc, table, metrics } from "./shared/ui.mjs";
import { mean, median, sd, regression, fmt } from "./shared/math.mjs";
import { renderDataTab } from "./data-tab.mjs";
import correlation from "./correlation/lab.mjs";
const root = document.querySelector("#project-root");
let dataset = readDataset();
if (dataset.origin !== "user") dataset = saveDataset(defaultDataset());
let active =
  new URLSearchParams(location.search).get("start") === "data"
    ? "data"
    : "analysis";
const ui = { dataPage: 0 };
function draw() {
  document.querySelector(".workspace-intro").textContent =
    dataset.origin === "sample"
      ? "学習時間が長い人ほど高得点でしょうか。架空の24人のデータを、分布・代表値・相関から眺めてみましょう。自分の2列の数値データでも、同じように見比べられます。"
      : `「${dataset.xLabel}」と「${dataset.yLabel}」には、どんな特徴や関係があるでしょうか。同じデータを各ラボへ持ち込み、分布・代表値・相関から見える違いを試せます。`;
  root.innerHTML = `<nav class="view-tabs project-tabs" aria-label="横断分析の表示">${[
    ["data", "データ"],
    ["analysis", "分析方法を選ぶ"],
    ["results", "特徴を見比べる"],
  ]
    .map(
      ([id, label]) =>
        `<button type="button" data-project-tab="${id}" aria-pressed="${active === id}">${label}</button>`,
    )
    .join("")}</nav><div id="project-view"></div>`;
  root.querySelectorAll("[data-project-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        active = b.dataset.projectTab;
        draw();
      }),
  );
  const view = root.querySelector("#project-view");
  if (active === "data") {
    const state = {
      ...correlation.initial(),
      points: dataset.rows.map((r, i) => ({ ...r, id: "p" + i })),
      xLabel: dataset.xLabel,
      yLabel: dataset.yLabel,
      source: dataset.name,
    };
    renderDataTab(view, {
      id: "correlation",
      state,
      ui,
      allowGroup: true,
      dataOverride: {
        ...dataset,
        headers: [dataset.xLabel, dataset.yLabel, "集団"],
        rows: dataset.rows.map((r) => [r.x, r.y, r.group]),
        operation: "同じ2列を、分布・代表値・散布図で分析",
      },
      sample: () => {
        dataset = saveDataset(defaultDataset());
        draw();
      },
      apply: (next) => {
        dataset = saveDataset({
          name: next.dataInfo.name,
          origin: "user",
          xLabel: next.xLabel,
          yLabel: next.yLabel,
          rows: next.points.map((r) => ({ ...r, group: r.group || "全体" })),
        });
        draw();
      },
      analyze: () => {
        active = "analysis";
        draw();
      },
      update: () => {},
    });
  } else if (active === "analysis") {
    view.innerHTML = `<p class="project-context">${esc(dataset.name)} · ${dataset.rows.length}件。気になる見方を選んでみよう。</p><div class="archive-field-grid lab-content-grid">${[
      [
        "histogram",
        "分布を見る",
        "どの値に集まっている？ 山は1つ？",
        "histogram",
      ],
      [
        "summary",
        "代表値とばらつきを見る",
        "平均と中央値は同じ？ 個人差は大きい？",
        "summary",
      ],
      [
        "correlation",
        "2つの量の関係を見る",
        "点はどんな並び？ 1点を動かすと直線は？",
        "correlation",
      ],
    ]
      .map(
        ([id, title, question, slug], i) =>
          `<article class="project-method"><a class="archive-field-card" href="../${slug}/?dataset=project${id === "correlation" ? "" : "&field=y"}"><span aria-hidden="true">0${i + 1}</span><div><h2>${title}</h2><p>${question}</p><small>${id === "correlation" ? esc(dataset.xLabel) + " × " : ""}${esc(dataset.yLabel)}</small></div><b aria-hidden="true">→</b></a>${id !== "correlation" ? `<a class="text-link" href="../${slug}/?dataset=project&field=x">${esc(dataset.xLabel)}で調べる →</a>` : ""}</article>`,
      )
      .join(
        "",
      )}</div><p class="project-caution">各ラボへ、同じ元データと列名を引き継ぎます。ラボ内で点を動かしても、ここにある元データは変わりません。</p>`;
  } else {
    const values = dataset.rows.map((r) => r.y),
      r = regression(dataset.rows);
    view.innerHTML = `<section class="project-surface"><h2>同じ元データでも、見方でわかることが変わる</h2><p>${esc(dataset.name)} · ${dataset.rows.length}件。各ラボで操作する前の共通データの特徴です。</p>${table(
      ["見る項目", dataset.xLabel, dataset.yLabel],
      [
        ["平均", fmt(mean(dataset.rows.map((r) => r.x))), fmt(mean(values))],
        [
          "中央値",
          fmt(median(dataset.rows.map((r) => r.x))),
          fmt(median(values)),
        ],
        ["標準偏差", fmt(sd(dataset.rows.map((r) => r.x))), fmt(sd(values))],
      ],
    )}${metrics([
      ["2列の相関係数 r", fmt(r.r, 3), "直線的な関係の強さ"],
      [
        "得点側の最小〜最大",
        `${fmt(Math.min(...values))}〜${fmt(Math.max(...values))}`,
        dataset.yLabel,
      ],
    ])}<p class="experiment-insight">${Number.isFinite(r.r) ? (Math.abs(r.r) > 0.5 ? "2つの量には直線的な関連が見られます。ただし、同じ学習時間でも値はばらつきます。散布図で、直線から外れる点にも注目してみましょう。" : "直線的な関係は強くありません。分布の形や集団別の違いも見てみましょう。") : "一方の値がすべて同じため、相関係数は定義できません。"}</p><p>平均や相関係数だけでは、山の数や外れ値はわかりません。<a class="text-link" href="../histogram/?dataset=project&field=y">分布</a>・<a class="text-link" href="../summary/?dataset=project&field=y">代表値</a>・<a class="text-link" href="../correlation/?dataset=project">散布図</a>を行き来して確かめられます。</p></section>`;
  }
}
document.querySelector("#lab-picker").onchange = (e) =>
  (location.href = `../${e.target.value}/`);
draw();
