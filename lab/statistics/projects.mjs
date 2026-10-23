import { readDataset, saveDataset, defaultDataset } from "./shared/data.mjs";
import { esc, table, metrics } from "./shared/ui.mjs";
import { mean, median, sd, regression, fmt } from "./shared/math.mjs";
import { renderDataTab } from "./data-tab.mjs";
import { renderStepNavigation } from "./learning.mjs";
import correlation from "./correlation/lab.mjs";
import { setupFullscreen } from "./fullscreen.mjs?v=20261023-distribution-reading";
const root = document.querySelector("#project-root");
let dataset = readDataset();
let active = "data";
const steps = [
  { title: "データ" },
  { title: "分析方法を選ぶ" },
  { title: "特徴を見比べる" },
];
const ui = { dataPage: 0 };
setupFullscreen(document.querySelector("#statistics-workspace"), draw);
function draw() {
  document.querySelector(".workspace-intro").textContent =
    dataset.origin === "sample"
      ? "学習時間が長い人ほど高得点でしょうか。架空の24人のデータを、分布・代表値・相関から眺めてみましょう。自分の2列の数値データでも、同じように見比べられます。"
      : `「${dataset.xLabel}」と「${dataset.yLabel}」には、どんな特徴や関係があるでしょうか。同じデータを各ラボへ持ち込み、分布・代表値・相関から見える違いを試せます。`;
  const tabs = document.querySelector("#project-tabs");
  tabs.innerHTML = `${[
    ["data", "データ"],
    ["analysis", "分析方法を選ぶ"],
    ["results", "特徴を見比べる"],
  ]
    .map(
      ([id, label]) =>
        `<button type="button" data-project-tab="${id}" aria-pressed="${active === id}">${label}</button>`,
    )
    .join("")}`;
  root.innerHTML = `<p class="tab-progress">${["data", "analysis", "results"].indexOf(active) + 1} / 3 · ${active === "data" ? "同じ行の対応と項目名・単位を確かめてから分析へ進みます。" : active === "analysis" ? "調べたいことに合うラボを選びます。どのラボもデータの確認から始まります。" : "同じ元データについて、複数の見方を組み合わせます。"}</p><div id="project-view"></div><nav id="project-step-navigation" class="step-navigation" aria-label="分析課題の順路"></nav>`;
  tabs.querySelectorAll("[data-project-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        if (
          active === "data" &&
          b.dataset.projectTab !== "data" &&
          ui.commitData &&
          !ui.commitData()
        )
          return;
        active = b.dataset.projectTab;
        draw();
      }),
  );
  const view = root.querySelector("#project-view");
  const navigation = root.querySelector("#project-step-navigation");
  navigation.hidden = active === "data";
  if (active !== "data")
    renderStepNavigation(
      navigation,
      steps,
      ["data", "analysis", "results"].indexOf(active),
      (index) => {
        active = ["data", "analysis", "results"][index];
        draw();
        root.scrollIntoView({ behavior: "smooth", block: "start" });
      },
    );

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
        "分布・代表値を見る",
        "山・外れ値・平均やばらつきを同じデータで調べる。",
        "histogram",
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
        "分析する列の最小〜最大",
        `${fmt(Math.min(...values))}〜${fmt(Math.max(...values))}`,
        dataset.yLabel,
      ],
    ])}<p class="experiment-insight">${Number.isFinite(r.r) ? `このデータの相関係数は r = ${fmt(r.r, 3)}。係数だけでなく、点が1本の直線からどれだけ散らばるかや、集団別の違いにも注目しましょう。相関は因果関係を証明するものではありません。` : "一方の値がすべて同じため、相関係数は定義できません。"}</p><p>平均や相関係数だけでは、山の数や外れ値はわかりません。<a class="text-link" href="../histogram/?dataset=project&field=y">分布・代表値</a>・<a class="text-link" href="../correlation/?dataset=project">散布図</a>を行き来して確かめられます。</p></section>`;
  }
}
document.querySelector("#lab-picker").onchange = (e) =>
  (location.href = `../${e.target.value}/`);
draw();
