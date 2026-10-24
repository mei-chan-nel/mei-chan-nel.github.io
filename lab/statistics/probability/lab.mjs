import {
  chartKey,
  esc,
  number,
  metrics,
  table,
  svg,
  axes,
  line,
} from "../shared/ui.mjs?v=20261024-probability-flow";
import { fmt } from "../shared/math.mjs?v=20261024-probability-flow";
import { academicExplanation } from "../shared/reading.mjs?v=20261024-probability-flow";
import { normalDensity } from "./model.mjs?v=20261024-probability-flow";
import {
  normalizeLabState,
  activeExperiment,
  startExperiment,
  experimentSummary,
  intervalComparison,
  MAX_TOSSES,
} from "./experiment.mjs?v=20261024-probability-flow";
import { downloadCSV } from "../data-editor.mjs?v=20261024-probability-flow";
const percent = (v) => `${fmt(v * 100, 2)}%`;
const key = (label, color, kind = "line") =>
  chartKey(label, `var(--chart-${color})`, kind);
const detail = (title, body) =>
  `<section class="prob-detail" data-screen-nav-section="${esc(title)}"><h3>${title}</h3>${body}</section>`;
const context = (e) =>
  `実験${e.id}：表の確率 ${fmt(e.p, 2)} ／ 1セット${e.n}回 × ${e.repetitions}セット（計${e.n * e.repetitions}回）`;
function countAxes(options, n, standardized = false) {
  const a = axes(options);
  const rough = Math.max(1, (options.xmax - options.xmin) / 6);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10]
    .map((v) => v * magnitude)
    .reduce((best, v) =>
      Math.abs(Math.log(v / rough)) < Math.abs(Math.log(best / rough))
        ? v
        : best,
    );
  const start = Math.ceil(options.xmin / step) * step;
  const ticks = standardized
    ? [-4, -3, -2, -1, 0, 1, 2, 3, 4]
    : Array.from(
        { length: Math.max(0, Math.floor((options.xmax - start) / step) + 1) },
        (_, i) => start + i * step,
      );
  a.markup = a.markup.replace(
    /<text x="[^"]+" y="[^"]+" text-anchor="middle">[^<]*<\/text>/g,
    "",
  );
  a.markup +=
    ticks
      .filter((v) => v >= options.xmin && v <= options.xmax)
      .map(
        (v) =>
          `<text x="${a.x(v)}" y="${options.h - 29}" text-anchor="middle">${v}</text>`,
      )
      .join("") +
    `<text x="${(58 + options.w - 24) / 2}" y="${options.h - 5}" text-anchor="middle">${esc(options.xlabel)}</text>`;
  return a;
}
function intervalControls(s, e) {
  return `<fieldset class="prob-interval"><legend>調べる範囲：表が何回から何回まで？</legend>${number("prob-low", "下限（回）", s.intervalLow, 0, s.intervalHigh, 1)}${number("prob-high", "上限（回）", s.intervalHigh, s.intervalLow, e.n, 1)}<button type="button" id="prob-center">平均付近を見る</button></fieldset>`;
}
function comparison(e, c) {
  return detail(
    "同じ範囲を比べる",
    `<p><strong>表が${c.a}〜${c.b}回出る確率・割合</strong></p>${metrics([
      [
        "実験の割合",
        percent(c.observed),
        `${c.count} / ${e.repetitions}セット`,
      ],
      ["二項分布の理論確率", percent(c.exact)],
      ...(c.normal
        ? [["正規近似による確率", percent(c.normal.probability)]]
        : []),
    ])}<p>実験の割合は実際に得た結果、理論確率は実験条件から求めた値です。</p>`,
  );
}
function coinView(s, e, d) {
  const shown = s.early ? d.path.slice(0, 50) : d.path;
  const a = axes({
    xmin: 0,
    xmax: Math.max(10, shown.length),
    ymin: 0,
    ymax: 1,
    w: 760,
    h: 360,
    xlabel: "実際に投げた順番（回）",
    ylabel: "表の相対度数",
  });
  // Preserve every observation for calculations; thin only the drawn polyline.
  const stride = Math.max(1, Math.ceil(shown.length / 1500));
  const points = shown.filter(
    (_, i) => i % stride === 0 || i === shown.length - 1,
  );
  const target = `<line x1="58" x2="736" y1="${a.y(e.p)}" y2="${a.y(e.p)}" stroke="var(--chart-reference)" stroke-width="2" stroke-dasharray="6 4"/><text x="730" y="${Math.max(24, a.y(e.p) - 9)}" text-anchor="end">設定した確率 p＝${fmt(e.p, 2)}</text>`;
  return `<div class="analysis-toolbar"><label><input type="checkbox" id="prob-early" ${s.early ? "checked" : ""}>最初の50回を拡大</label></div><section class="panel chart-panel"><h2>1回ずつの結果から、表の割合を追う</h2><p>実験の全セットを投げた順につなげています。折れ線は、その時点までの表の回数 ÷ 投げた回数です。</p>${svg(a.markup + target + line(points, a.x, a.y), "同じ実験の表の相対度数。破線は設定した確率。", 760, 360)}<div class="legend">${key("実験の相対度数", "primary")}${key("設定した確率", "reference", "line-dashed")}</div>${detail(
    "実験結果と確率",
    `${metrics([
      ["全投数", `${d.tosses.length}回`],
      ["表の回数", `${d.successes}回`],
      ["全体の相対度数", fmt(d.successes / d.tosses.length, 4)],
      ["設定した確率 p", fmt(e.p, 2)],
    ])}<p>表示範囲を変えても、結果は変わりません。独立な試行なので、表が続いても次の表の確率はpのままです。</p><p>相対度数は確率の近くに安定する傾向がありますが、毎回近づくとは限りません。</p>`,
  )}</section>`;
}
function binomialView(s, e, d, c) {
  const relative = d.counts.map((k) => k / e.repetitions),
    max = Math.max(...relative, ...d.theory) * 1.2;
  const a = countAxes(
    {
      xmin: -0.6,
      xmax: e.n + 0.6,
      ymin: 0,
      ymax: Math.max(0.1, max),
      w: 760,
      h: 360,
      xlabel: "1セットで表が出た回数 k",
      ylabel: "相対度数・理論確率",
    },
    e.n,
  );
  const bars = d.counts
    .map(
      (v, k) =>
        `<rect data-prob-count="${k}" role="button" tabindex="0" aria-label="表${k}回の範囲を選ぶ。実験${v}セット" x="${a.x(k - 0.35)}" y="${a.y(relative[k])}" width="${a.x(k + 0.35) - a.x(k - 0.35)}" height="${a.y(0) - a.y(relative[k])}" fill="var(--chart-primary)" opacity="${k >= c.a && k <= c.b ? 1 : 0.35}" stroke="var(--chart-primary)"><title>表${k}回：${v}セット、相対度数${fmt(relative[k], 4)}</title></rect>`,
    )
    .join("");
  const theory = d.theory.map((p, k) => ({ x: k, y: p }));
  const dots = theory
    .map(
      (p) =>
        `<circle cx="${a.x(p.x)}" cy="${a.y(p.y)}" r="3" fill="var(--chart-secondary)"><title>表${p.x}回の理論確率 ${percent(p.y)}</title></circle>`,
    )
    .join("");
  return `<div class="analysis-toolbar">${intervalControls(s, e)}</div><section class="panel chart-panel"><h2>セットごとの「表の回数」を集計する</h2><p>1つの棒は、表が同じ回数出たセットの割合です。橙の点は、同じn・pから計算した二項分布の理論確率です。</p>${svg(a.markup + bars + line(theory, a.x, a.y, "series warm") + dots, "セットごとの成功回数の分布。棒は実験、橙の点は理論確率。", 760, 360)}<div class="legend">${key("実験の相対度数", "primary", "bar")}${key("二項分布の理論確率", "secondary", "point")}</div>${comparison(e, c)}${detail("分布の中心と広がり", `<p>理論上の平均 np＝${fmt(d.mu, 2)}回。標準偏差 √(np(1−p))＝${fmt(d.sigma, 2)}回。</p><p>実験の平均は${fmt(d.mean, 2)}回。セット数を増やす実験と、1セットの投数nを変える実験では、変えているものが異なります。</p>`)}<details class="prob-table"><summary>回数ごとの度数・理論確率</summary>${table(
    ["表の回数 k", "実験の度数（セット）", "実験の相対度数", "理論確率"],
    d.counts.map((v, k) => [k, v, fmt(relative[k], 4), fmt(d.theory[k], 4)]),
  )}<p>P(K=k)＝C(n,k)pᵏ(1−p)ⁿ⁻ᵏ。橙の点を結ぶ線は読み取りの補助です。</p></details></section>`;
}
function normalChart(e, d, c, standardized) {
  const mu = standardized ? 0 : d.mu,
    sigma = standardized ? 1 : d.sigma;
  const low = standardized ? c.normal.zLow : c.low,
    high = standardized ? c.normal.zHigh : c.high;
  const xmin = mu - 4 * sigma,
    xmax = mu + 4 * sigma,
    ymax = normalDensity(mu, mu, sigma) * 1.22;
  const a = countAxes(
    {
      xmin,
      xmax,
      ymin: 0,
      ymax,
      w: 760,
      h: 360,
      xlabel: standardized ? "標準化した値 z" : "表の回数に対応する値 x",
      ylabel: "確率密度",
    },
    e.n,
    standardized,
  );
  const curve = Array.from({ length: 301 }, (_, i) => ({
    x: xmin + ((xmax - xmin) * i) / 300,
    y: normalDensity(xmin + ((xmax - xmin) * i) / 300, mu, sigma),
  }));
  const shownLow = Math.max(xmin, low),
    shownHigh = Math.min(xmax, high);
  const area =
    shownHigh > shownLow
      ? Array.from({ length: 121 }, (_, i) => {
          const x = shownLow + ((shownHigh - shownLow) * i) / 120;
          return `${a.x(x)},${a.y(normalDensity(x, mu, sigma))}`;
        })
      : [];
  const bars = standardized
    ? ""
    : d.theory
        .map((p, k) =>
          k + 0.5 > xmin && k - 0.5 < xmax
            ? `<rect x="${a.x(Math.max(xmin, k - 0.5))}" y="${a.y(p)}" width="${a.x(Math.min(xmax, k + 0.5)) - a.x(Math.max(xmin, k - 0.5))}" height="${a.y(0) - a.y(p)}" fill="var(--chart-secondary)" opacity=".22" stroke="var(--chart-secondary)"/>`
            : "",
        )
        .join("");
  const bounds = [low, high]
    .filter((v) => v >= xmin && v <= xmax)
    .map(
      (v) =>
        `<line x1="${a.x(v)}" x2="${a.x(v)}" y1="${a.y(0)}" y2="${a.y(normalDensity(v, mu, sigma))}" stroke="var(--chart-purple)" stroke-width="2"/>`,
    )
    .join("");
  return svg(
    a.markup +
      bars +
      `<g data-prob-normal-area="${c.normal.probability}">${area.length ? `<polygon points="${a.x(shownLow)},${a.y(0)} ${area.join(" ")} ${a.x(shownHigh)},${a.y(0)}" fill="var(--chart-purple)" opacity=".25"/>` : ""}</g>` +
      line(curve, a.x, a.y, "prob-normal-curve") +
      bounds +
      `<line x1="${a.x(mu)}" x2="${a.x(mu)}" y1="30" y2="${a.y(0)}" stroke="var(--chart-reference)" stroke-dasharray="5 4"/><text x="${a.x(mu) + 5}" y="47">平均 ${standardized ? "0" : fmt(d.mu, 2)}</text>`,
    standardized
      ? "同じ区間を標準化した正規分布。色の面積は変わらない。"
      : "二項分布の棒と正規近似の曲線。色の面積は選択区間の近似確率。",
    760,
    360,
  );
}
function normalView(s, e, d, c, standardized) {
  const toolbar = `<div class="analysis-toolbar">${intervalControls(s, e)}</div>`;
  if (d.sigma === 0)
    return `${toolbar}<section class="panel chart-panel"><h2>${standardized ? "標準化" : "正規分布で近似する"}</h2><p class="annotation">p＝${e.p}では、表の回数は必ず${d.mu}回です。標準偏差が0のため、正規分布の曲線や、標準偏差で割る標準化は使えません。</p>${comparison(e, c)}</section>`;
  const warning = c.adequate
    ? "この条件では、二項分布の山を正規分布で近似する目安を満たしています。"
    : "この条件では、正規近似が合いにくくなります。二項分布の理論確率と近似値の差を確認してください。";
  return `${toolbar}<section class="panel chart-panel"><h2>${standardized ? "同じ区間を、zの尺度に置き換える" : "同じ回数の分布を、正規分布で近似する"}</h2><p>${standardized ? "元の値とzの対応を確かめます。選んだ範囲と、その正規分布の面積は同じです。" : "橙の棒は二項分布、紫の曲線は平均と標準偏差をそろえた正規分布です。曲線の高さではなく、選んだ区間の面積で確率を読みます。"}</p>${normalChart(e, d, c, standardized)}<div class="legend">${!standardized ? key("二項分布（幅1の棒）", "secondary", "bar") : ""}${key(standardized ? "標準正規分布" : "正規近似", "purple")}${key("区間の面積", "purple", "bar")}</div>${comparison(e, c)}${detail(standardized ? "元の区間とzの対応" : "整数の回数を面積に対応させる", `<p>表が${c.a}〜${c.b}回という範囲を、正規近似では${fmt(c.low, 1)}〜${fmt(c.high, 1)}の面積で表します。整数1つを幅1の範囲に対応させるため、両端を0.5回ずつ広げます。</p><p>μ＝np＝${fmt(d.mu, 2)}、σ＝√(np(1−p))＝${fmt(d.sigma, 3)}。</p>${standardized ? `<p><strong>Z＝(X−μ)÷σ</strong></p><p>左端：(${fmt(c.low, 1)}−${fmt(d.mu, 2)})÷${fmt(d.sigma, 3)}＝${fmt(c.normal.zLow, 3)}</p><p>右端：(${fmt(c.high, 1)}−${fmt(d.mu, 2)})÷${fmt(d.sigma, 3)}＝${fmt(c.normal.zHigh, 3)}</p><p>正規分布の区間を標準化すると、平均0・標準偏差1の分布で同じ面積${percent(c.normal.probability)}を読めます。観測データ自体が正規分布に変わるわけではありません。</p>` : ""}<p class="annotation">${warning}</p><p>近似の目安はnpとn(1−p)がともに5以上です。確率の計算は図の外の裾も含めます。図は平均の前後4標準偏差までです。端の棒や裾が範囲外に続く場合もあります。二項分布の理論確率と、正規分布による近似値は別の値です。</p>`)}</section>`;
}
export function renderPreparation(root, ctx) {
  const s = normalizeLabState(ctx.state),
    e = activeExperiment(s),
    d = e ? experimentSummary(e) : null;
  root.innerHTML = `<section class="panel prob-preparation"><h2>コインのモデル実験を準備する</h2><p>表が出る確率が一定で、1回ずつ独立に結果が決まるコインを使います。1セットごとに表の回数を記録し、同じ結果を4つのタブで読み解きます。</p><form id="prob-setup"><div class="prob-setup-fields">${number("setup-p", "表が出る確率 p", s.p, 0, 1, 0.01)}${number("setup-n", "1セットの投数 n（回）", s.n, 1, 200, 1)}${number("setup-sets", "実験するセット数", s.repetitions, 1, 1000, 1)}</div><p class="hint">例：20回投げることを200セット行うと、記録は200行、投数は計4,000回です。合計${MAX_TOSSES.toLocaleString("ja-JP")}回まで実験できます。</p><p><output id="prob-setup-total" aria-live="polite">合計${s.n * s.repetitions}回投げます</output></p><button id="prob-run" type="submit" class="primary">${e ? "この条件で新しい実験をする" : "この条件で実験する"}</button><p id="prob-setup-error" role="status" aria-live="polite"></p></form>${
    e
      ? `<section class="prob-current"><h3>${context(e)}</h3><p>表は${d.successes}回、裏は${d.tosses.length - d.successes}回。下の各行が1セットです。表＝1、裏＝0で、左から投げた順です。</p><div class="actions"><button id="prob-analyze" class="primary">相対度数を見る →</button><button id="prob-download">この実験をCSVで保存</button></div>${table(
          ["セット", "1回ずつの結果（1＝表・0＝裏）", "表の回数"],
          e.sets
            .slice(0, 30)
            .map((row, i) => [i + 1, row.join(" "), d.outcomes[i]]),
        )}${e.repetitions > 30 ? `<p class="hint">最初の30セットを表示。計算とCSVには全${e.repetitions}セットを含みます。</p>` : ""}</section>`
      : '<p class="prob-empty">条件を決めて「実験する」を押すと、結果と4つの分析タブを見られます。</p>'
  }${s.experiments.length ? `<details class="prob-history"><summary>実験の履歴（${s.experiments.length}件）</summary><p>新しい条件でも、過去の結果は書き換えません。実験を選ぶと、その記録を読み返せます。</p><div class="prob-history-list">${s.experiments.map((exp) => `<button type="button" data-prob-history="${exp.id}" aria-pressed="${exp.id === s.activeId}">${context(exp)}</button>`).join("")}</div></details>` : ""}${s.legacyData ? '<details><summary>以前このページで保存したデータ</summary><p>以前のデータは保管されています。このモデル実験とは別に、CSVで取り出せます。</p><button id="prob-legacy-download">以前のデータをCSVで保存</button></details>' : ""}</section>`;
  for (const id of ["setup-n", "setup-sets"])
    root.querySelector("#" + id).addEventListener("input", () => {
      const total =
        Number(root.querySelector("#setup-n").value) *
        Number(root.querySelector("#setup-sets").value);
      root.querySelector("#prob-setup-total").textContent = Number.isFinite(
        total,
      )
        ? `合計${total.toLocaleString("ja-JP")}回投げます`
        : "投数とセット数を入力してください。";
    });
  root.querySelector("#prob-setup").onsubmit = (event) => {
    event.preventDefault();
    try {
      const p = Number(root.querySelector("#setup-p").value),
        n = Number(root.querySelector("#setup-n").value),
        sets = Number(root.querySelector("#setup-sets").value);
      if (
        ["#setup-p", "#setup-n", "#setup-sets"].some(
          (id) => root.querySelector(id).value.trim() === "",
        )
      )
        throw Error("3つの実験条件を入力してください。");
      const seed = globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
      ctx.replace(startExperiment(s, p, n, sets, seed));
    } catch (error) {
      root.querySelector("#prob-setup-error").textContent = error.message;
    }
  };
  root.querySelector("#prob-analyze")?.addEventListener("click", ctx.analyze);
  root.querySelector("#prob-download")?.addEventListener("click", () =>
    downloadCSV(
      `コイン実験${e.id}.csv`,
      [
        "セット",
        ...Array.from({ length: e.n }, (_, i) => `第${i + 1}投（表=1・裏=0）`),
        "表の回数",
      ],
      e.sets.map((row, i) => [i + 1, ...row, d.outcomes[i]]),
    ),
  );
  root.querySelector("#prob-legacy-download")?.addEventListener("click", () =>
    downloadCSV(
      "以前の確率データ.csv",
      [s.legacyData.label],
      s.legacyData.values.map((v) => [v]),
    ),
  );
  root.querySelectorAll("[data-prob-history]").forEach(
    (button) =>
      (button.onclick = () => {
        const e = s.experiments.find(
          (e) => e.id === Number(button.dataset.probHistory),
        );
        ctx.update({
          activeId: e.id,
          p: e.p,
          n: e.n,
          repetitions: e.repetitions,
          intervalLow: 0,
          intervalHigh: e.n,
          dataInfo: {
            name: `コインのモデル実験 ${e.id}`,
            origin: "model",
            columns: ["セット", "表の回数"],
            baseline: e.sets.map((row, i) => [
              i + 1,
              row.reduce((a, b) => a + b, 0),
            ]),
          },
        });
      }),
  );
}
export default {
  id: "probability",
  title: "確率と確率分布",
  description:
    "同じコイン実験から、相対度数・二項分布・正規近似・標準化を読む。",
  initial: () => normalizeLabState({ n: 20, repetitions: 200, tossCount: 0 }),
  normalize: normalizeLabState,
  renderPreparation,
  render(root, ctx) {
    const s = normalizeLabState(ctx.state),
      e = activeExperiment(s),
      view = Math.max(0, Math.min(3, ctx.view || 0));
    if (!e) {
      root.innerHTML =
        '<section class="panel"><h2>まず実験を準備しましょう</h2><p>「実験の準備」で条件を決めて実験すると、同じ結果を順に読み解けます。</p><button id="prob-return">実験の準備へ</button></section>';
      root.querySelector("#prob-return").onclick = () =>
        root.ownerDocument.querySelector("#data-tab").click();
      return;
    }
    const d = experimentSummary(e),
      c = intervalComparison(e, s.intervalLow, s.intervalHigh);
    root.innerHTML = `<p class="prob-context" data-screen-nav-section="実験条件">${context(e)}</p>${view === 0 ? coinView(s, e, d) : view === 1 ? binomialView(s, e, d, c) : normalView(s, e, d, c, view === 3)}<p class="prob-change"><button id="prob-return">条件を変える・別の実験をする</button><span>「実験の準備」に戻ります。</span></p>`;
    root.querySelector("#prob-return").onclick = () =>
      root.ownerDocument.querySelector("#data-tab").click();
    root
      .querySelector("#prob-early")
      ?.addEventListener("change", (ev) =>
        ctx.update({ early: ev.target.checked }),
      );
    for (const [id, key] of [
      ["prob-low", "intervalLow"],
      ["prob-high", "intervalHigh"],
    ])
      root.querySelector("#" + id)?.addEventListener("change", (ev) => {
        const v = Math.round(Number(ev.target.value));
        ctx.update({
          [key]:
            id === "prob-low"
              ? Math.max(0, Math.min(v, s.intervalHigh))
              : Math.min(e.n, Math.max(v, s.intervalLow)),
        });
      });
    root.querySelector("#prob-center")?.addEventListener("click", () =>
      ctx.update({
        intervalLow: Math.max(0, Math.ceil(d.mu - d.sigma)),
        intervalHigh: Math.min(e.n, Math.floor(d.mu + d.sigma)),
      }),
    );
    root.querySelectorAll("[data-prob-count]").forEach((el) => {
      const choose = () =>
        ctx.update({
          intervalLow: +el.dataset.probCount,
          intervalHigh: +el.dataset.probCount,
        });
      el.onclick = choose;
      el.onkeydown = (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          choose();
        }
      };
    });
  },
  explanation: academicExplanation("probability"),
  related: ["sampling", "histogram", "hypothesis-test"],
};
