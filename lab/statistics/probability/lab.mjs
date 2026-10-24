import {
  chartKey,
  range,
  number,
  metrics,
  table,
  svg,
  axes,
  line,
  bind,
} from "../shared/ui.mjs?v=20261024-simpson-theme";
import { academicExplanation } from "../shared/reading.mjs?v=20261024-simpson-theme";
import { fmt, sd } from "../shared/math.mjs";

import {
  coinExperiment,
  binomialExperiment,
  normalInterval,
  normalDensity,
  normalizeState,
  observationValues,
  observedCoin,
  observedBinomial,
} from "./model.mjs";

const measurement = (value, digits = 1) =>
  value !== 0 && Math.abs(value) < 0.1
    ? Number(value.toPrecision(3)).toString()
    : fmt(value, digits);

function coinView(state) {
  const result =
    state.observed?.mode === "coin"
      ? observedCoin(state.observed.values)
      : coinExperiment(state.p, state.tossCount, state.seed);
  const shown = state.early ? result.path.slice(0, 50) : result.path;
  const xmax = Math.max(10, shown.length);
  const a = axes({
    xmin: 0,
    xmax,
    ymin: 0,
    ymax: 1,
    w: 720,
    h: 350,
    xlabel: "コインを投げた回数",
    ylabel: "表の相対度数",
  });
  const target = `<line x1="${a.x(0)}" x2="${a.x(xmax)}" y1="${a.y(state.p)}" y2="${a.y(state.p)}" stroke="var(--chart-reference)" stroke-width="2" stroke-dasharray="6 4"/><text x="${a.x(xmax) - 4}" y="${Math.max(23, a.y(state.p) - 9)}" fill="var(--chart-reference)" text-anchor="end" font-size="12">設定した確率 p = ${fmt(state.p, 2)}</text>`;
  const last = shown.at(-1);
  const endpoint = last
    ? `<circle class="point" cx="${a.x(last.x)}" cy="${a.y(last.y)}" r="4"><title>${last.x}回時点：${fmt(last.y, 4)}</title></circle>`
    : "";
  const recent = result.tosses
    .slice(-40)
    .map(
      (success, i) =>
        `<span title="第${Math.max(0, result.tosses.length - 40) + i + 1}回：${success ? "表" : "裏"}" style="display:inline-block;width:1.7em;height:1.7em;line-height:1.7;text-align:center;border-radius:50%;margin:3px;background:${success ? "var(--chart-primary)" : "var(--chart-context)"};color:${success ? "white" : "var(--chart-text)"}">${success ? "表" : "裏"}</span>`,
    )
    .join("");
  return `<div class="stat-grid"><section class="panel chart-panel"><h2>1回ずつの偶然を、相対度数で追う</h2>
    <p class="muted">各回は独立です。次に表が出る確率は、これまでの結果によらず p です。</p>
    ${svg(a.markup + target + line(shown, a.x, a.y) + endpoint, "表の相対度数の推移。破線は設定した表の確率。", 720, 350)}
    ${metrics([
      ["投げた回数", `${state.tossCount}回`],
      ["表の回数", `${result.successes}回`],
      [
        "表の相対度数",
        state.tossCount ? fmt(result.successes / state.tossCount, 4) : "未試行",
        state.tossCount
          ? `${result.successes} ÷ ${state.tossCount}`
          : "まず試行を追加しよう",
      ],
      [
        "設定した確率との差",
        state.tossCount
          ? fmt(result.successes / state.tossCount - state.p, 4)
          : "—",
      ],
    ])}
    <p>直近40回まで：<span class="muted">${state.tossCount > 40 ? "左から古い順。前の結果は折れ線に含まれています。" : "左から実験の順。"}</span></p><div aria-label="直近のコイン投げの結果">${recent || '<p class="hint">まだコインを投げていません。</p>'}</div>
    </section><aside class="panel controls"><h2>コインの実験</h2>${range("prob-p", "表が出る確率 p", state.p, 0, 1, 0.01)}
    <div class="actions"><button id="coin-10" class="primary" ${state.tossCount >= 10000 ? "disabled" : ""}>10回追加</button><button id="coin-100" ${state.tossCount >= 10000 ? "disabled" : ""}>100回追加</button><button id="coin-1000" ${state.tossCount >= 10000 ? "disabled" : ""}>1000回追加</button><button id="coin-clear">0回から始める</button></div>
    <label><input id="prob-early" type="checkbox" ${state.early ? "checked" : ""}> 最初の50回を拡大する</label>
    ${number("prob-seed", "再現用の乱数の種", state.seed, 0, 4294967295, 1)}
    <button id="prob-new-seed">別の偶然を試す</button>
    <p class="hint">最大10000回。${state.observed?.mode === "coin" ? "読込データは固定され、pは比較する理論の確率だけを変えます。" : "同じ種なら同じ乱数列で再現します。pを変えると、その乱数列を新しい確率で判定し直すので、同じ条件の偶然を使って比較できます。"}</p>
    <p class="annotation">${state.p === 0 || state.p === 1 ? "p = 0 または 1 では結果は確定しています。偶然によるばらつきはありません。" : "回数を増やし、相対度数と確率pを比べましょう。"}</p></aside></div>`;
}

function binomialView(state) {
  const result =
    state.observed?.mode === "binomial"
      ? observedBinomial(state.n, state.p, state.observed.values)
      : binomialExperiment(state.n, state.p, state.repetitions, state.seed);
  const relative = result.counts.map((count) =>
    state.repetitions ? count / state.repetitions : 0,
  );
  const ymax = Math.min(
    1.15,
    Math.max(0.1, ...relative, ...result.theory) * 1.18,
  );
  const a = axes({
    xmin: -0.6,
    xmax: state.n + 0.6,
    ymin: 0,
    ymax,
    w: 720,
    h: 350,
    xlabel: `1セット${state.n}回のうち、表が出た回数 k`,
    ylabel: "相対度数・理論確率",
  });
  const bars = result.counts
    .map(
      (count, k) =>
        `<rect class="bar" x="${a.x(k - 0.34)}" y="${a.y(relative[k])}" width="${a.x(k + 0.34) - a.x(k - 0.34)}" height="${a.y(0) - a.y(relative[k])}" opacity="0.7"><title>表${k}回：実験${count}セット、相対度数${fmt(relative[k], 4)}、理論確率${fmt(result.theory[k], 4)}</title></rect>`,
    )
    .join("");
  const points = result.theory.map((probability, k) => ({
    x: k,
    y: probability,
  }));
  const theory =
    line(points, a.x, a.y, "series warm") +
    points
      .map(
        (point) =>
          `<circle cx="${a.x(point.x)}" cy="${a.y(point.y)}" r="3" fill="var(--chart-secondary)"/>`,
      )
      .join("");
  return `<div class="stat-grid"><section class="panel chart-panel"><h2>「${state.n}回投げる」を1セットとして繰り返す</h2>
    <p class="muted">たとえば表が${Math.round(state.n * state.p)}回出たセットを、棒の1か所に積み上げます。セットごとの表の回数が二項分布を作ります。</p>
    ${svg(a.markup + bars + theory, "二項分布。棒は反復実験の相対度数、橙の点と線は理論確率。", 720, 350)}
    <p class="legend">${chartKey("実験の相対度数", "var(--chart-primary)", "bar")}${chartKey("理論上の確率", "var(--chart-secondary)", "point")}（離散値の点を読みやすく結んでいます）</p>
    ${metrics([
      [
        "実験したセット数",
        `${state.repetitions}セット`,
        `コイン投げ計${state.n * state.repetitions}回`,
      ],
      [
        "表の回数の実験平均",
        state.repetitions ? `${fmt(result.observedMean)}回` : "未試行",
      ],
      ["理論上の平均 np", `${fmt(state.n * state.p)}回`],
      [
        "理論上の標準偏差",
        `${fmt(Math.sqrt(state.n * state.p * (1 - state.p)))}回`,
        "√(np(1−p))",
      ],
    ])}
    </section><aside class="panel controls"><h2>二項分布の実験</h2>
    ${range("prob-p", "1回で表が出る確率 p", state.p, 0, 1, 0.01)}
    ${range("prob-n", "1セットの試行回数 n", state.n, 1, 40, 1, "回")}
    <div class="actions"><button id="binomial-100" class="primary" ${state.repetitions >= 10000 ? "disabled" : ""}>100セット追加</button><button id="binomial-1000" ${state.repetitions >= 10000 ? "disabled" : ""}>1000セット追加</button><button id="binomial-clear">0セットに戻す</button></div>
    ${number("prob-seed", "再現用の乱数の種", state.seed, 0, 4294967295, 1)}<button id="prob-new-seed">別の偶然を試す</button>
    <p class="hint">${state.observed?.mode === "binomial" ? "読込データの成功回数は固定。pやnで変わるのは比較する理論です。nは観測した最大成功回数以上に保ちます。" : "pとnを変えると、同じセット数を新しい条件で実験し直します。最大10000セット。pと各回の独立性は全セットで一定と仮定しています。"}</p>
    <p class="annotation">${state.p === 0 || state.p === 1 ? `p = ${state.p}なので、表の回数は必ず${state.p * state.n}回です。標準偏差は0になります。` : "nは1セットの試行回数です。反復セット数を増やし、棒と理論確率を比べましょう。"}</p>
    </aside></div><details class="panel"><summary>表・計算式で確かめる</summary>
    <p>表がk回出る確率は、P(X = k) = C(n, k) p<sup>k</sup>(1 − p)<sup>n − k</sup>。実験の相対度数は「そのkが出たセット数 ÷ 全セット数」です。p = 0, 1 は端点にすべての確率が集まる分布として処理します。</p>
    ${table(
      ["表の回数 k", "実験の度数", "実験の相対度数", "理論確率"],
      result.counts.map((count, k) => [
        k,
        count,
        state.repetitions ? fmt(relative[k], 4) : "—",
        fmt(result.theory[k], 4),
      ]),
    )}</details>`;
}

function normalChart(mu, sigma, low, high, standardized = false, values = []) {
  const xmin = mu - 4 * sigma;
  const xmax = mu + 4 * sigma;
  const ymax = normalDensity(mu, mu, sigma) * 1.2;
  const a = axes({
    xmin,
    xmax,
    ymin: 0,
    ymax,
    w: 720,
    h: standardized ? 270 : 340,
    xlabel: standardized ? "標準化した値 z" : "測定値 x",
    ylabel: "確率密度",
  });
  const curve = Array.from({ length: 241 }, (_, i) => ({
    x: xmin + ((xmax - xmin) * i) / 240,
    y: normalDensity(xmin + ((xmax - xmin) * i) / 240, mu, sigma),
  }));
  const left = Math.max(xmin, low);
  const right = Math.min(xmax, high);
  let area = "";
  if (right > left) {
    const points = Array.from({ length: 161 }, (_, i) => {
      const x = left + ((right - left) * i) / 160;
      return `${a.x(x)},${a.y(normalDensity(x, mu, sigma))}`;
    });
    area = `<polygon points="${a.x(left)},${a.y(0)} ${points.join(" ")} ${a.x(right)},${a.y(0)}" fill="var(--chart-primary)" opacity="0.28"/>`;
  }
  const boundaries = [low, high]
    .filter((value) => value >= xmin && value <= xmax)
    .map(
      (value) =>
        `<line x1="${a.x(value)}" x2="${a.x(value)}" y1="${a.y(0)}" y2="${a.y(normalDensity(value, mu, sigma))}" stroke="var(--chart-primary)" stroke-width="2"/>`,
    )
    .join("");
  const mean = `<line x1="${a.x(mu)}" x2="${a.x(mu)}" y1="${a.y(0)}" y2="${a.y(normalDensity(mu, mu, sigma))}" stroke="var(--chart-reference)" stroke-dasharray="5 4"/><text x="${a.x(mu) + 6}" y="${a.y(ymax) + 16}" font-size="12" fill="var(--chart-reference)">${standardized ? "平均 0" : `平均 μ = ${measurement(mu, 1)}`}</text>`;
  return svg(
    a.markup +
      area +
      line(curve, a.x, a.y) +
      boundaries +
      mean +
      values
        .filter((v) => v >= xmin && v <= xmax)
        .map(
          (v) =>
            `<line x1="${a.x(v)}" x2="${a.x(v)}" y1="${a.y(0)}" y2="${a.y(0) - 9}" stroke="${v >= low && v <= high ? "var(--chart-secondary)" : "var(--chart-axis)"}" opacity=".6"/>`,
        )
        .join(""),
    `${standardized ? "標準正規分布" : "正規分布"}。色の面積は指定した区間の確率。表示は平均の前後4標準偏差。`,
    720,
    standardized ? 270 : 340,
  );
}

function normalView(state) {
  const interval = normalInterval(state.mu, state.sigma, state.low, state.high);
  const observations = observationValues(state);
  const loaded = state.observed?.mode === "normal";
  const scale = loaded ? sd(observations) || 1 : 10;
  const inside = observations.filter(
    (v) => v >= state.low && v <= state.high,
  ).length;
  const outside = observations.filter(
    (v) => Math.abs(v - state.mu) > 4 * state.sigma,
  ).length;
  return `<div class="stat-grid"><section class="panel chart-panel"><h2>区間に入る確率は「面積」</h2>
    <p class="muted">架空の測定値 X が正規分布に従うモデルです。平均と標準偏差を動かし、同じ区間に入る確率を比べましょう。</p>
    ${normalChart(state.mu, state.sigma, state.low, state.high, false, observations)}
    <p class="hint">下端の短い線は${state.observed?.mode === "normal" ? "読み込んだ測定値" : "モデルから生成した200件"}。区間内は ${inside}/${observations.length}件（${fmt((inside / observations.length) * 100, 1)}%）です。${outside ? `図の範囲外にも${outside}件あり、割合の計算には含めています。` : ""}</p>
    ${metrics([
      [
        "区間",
        `${measurement(state.low, 1)} ≤ X ≤ ${measurement(state.high, 1)}`,
      ],
      [
        "区間に入る確率",
        `${fmt(interval.probability * 100, 2)}%`,
        `P(${measurement(state.low, 1)} ≤ X ≤ ${measurement(state.high, 1)})`,
      ],
      [
        "左端の標準化",
        `z = ${fmt(interval.zLow)}`,
        `(${measurement(state.low, 1)} − ${measurement(state.mu, 1)}) ÷ ${measurement(state.sigma, 1)}`,
      ],
      [
        "右端の標準化",
        `z = ${fmt(interval.zHigh)}`,
        `(${measurement(state.high, 1)} − ${measurement(state.mu, 1)}) ÷ ${measurement(state.sigma, 1)}`,
      ],
    ])}
    <p class="hint">曲線の高さは確率密度です。高さそのものを確率と読まず、区間の面積を読みます。図は μ ± 4σ までを表示し、数値は図の外の裾も含めて計算します。</p>
    </section><aside class="panel controls"><h2>正規分布のモデル</h2>
    ${range("normal-mu", "平均 μ", state.mu, loaded ? Math.min(...observations) - scale * 2 : -50, loaded ? Math.max(...observations) + scale * 2 : 100, loaded ? Math.max(scale / 20, 1e-8) : 1)}
    ${range("normal-sigma", "標準偏差 σ", state.sigma, loaded ? Math.max(scale / 100, 1e-8) : 1, loaded ? Math.max(scale * 4, state.sigma) : 30, loaded ? Math.max(scale / 20, 1e-8) : 1)}
    ${number("normal-low", "区間の左端 a", state.low, loaded ? -1e7 : -200, state.high, loaded ? Math.max(scale / 20, 1e-8) : 0.5)}
    ${number("normal-high", "区間の右端 b", state.high, state.low, loaded ? 1e7 : 200, loaded ? Math.max(scale / 20, 1e-8) : 0.5)}
    <div class="actions"><button id="normal-one" class="primary">区間を μ ± σ に</button><button id="normal-two">区間を μ ± 2σ に</button><button id="normal-center">区間を μ−4σ 〜 μ に</button></div>
    <p class="annotation">μは中心、σは広がりです。μ±σの区間の面積は約68%です。</p>
    </aside></div><section class="panel chart-panel"><h2>同じ面積を、標準正規分布で読む</h2>
    <p><strong>Z = (X − μ) / σ</strong> と変換すると、平均0・標準偏差1になります。${measurement(state.low, 1)} ≤ X ≤ ${measurement(state.high, 1)} は、${fmt(interval.zLow)} ≤ Z ≤ ${fmt(interval.zHigh)} に対応します。</p>
    ${normalChart(0, 1, interval.zLow, interval.zHigh, true)}
    <p>確率 = Φ(${fmt(interval.zHigh)}) − Φ(${fmt(interval.zLow)}) = <strong>${fmt(interval.probability, 5)}</strong>。Φは標準正規分布の累積分布関数です。連続分布なので端点を含むかどうかで確率は変わらず、1点だけの確率は0です。</p></section>`;
}

export default {
  id: "probability",
  title: "確率と確率分布",
  description:
    "偶然を繰り返すと、何が安定する？ コインから二項分布、正規分布へ。",
  lead: "次の1回はわからなくても、繰り返した結果には規則性が現れます。相対度数・回数の分布・区間の面積を、それぞれ操作して比べましょう。",
  initial: () => normalizeState({}),
  render(root, ctx) {
    const state = normalizeState(ctx.state);
    root.innerHTML = `<div class="panel actions" role="group" aria-label="確率の実験を選ぶ">${[
      ["coin", "① コインと相対度数"],
      ["binomial", "② 二項分布"],
      ["normal", "③ 正規分布と標準化"],
    ]
      .map(
        ([value, label]) =>
          `<button data-mode="${value}" aria-pressed="${state.mode === value}" class="${state.mode === value ? "primary" : ""}">${label}</button>`,
      )
      .join(
        "",
      )}</div>${state.mode === "coin" ? coinView(state) : state.mode === "binomial" ? binomialView(state) : normalView(state)}`;
    const update = (patch) =>
      ctx.replace(normalizeState({ ...state, ...patch }));
    root.querySelectorAll("[data-mode]").forEach((button) => {
      button.onclick = () => update({ mode: button.dataset.mode });
    });
    const loaded = state.observed?.mode === state.mode;
    if (loaded) {
      root
        .querySelectorAll(
          '[id^="coin-"],[id^="binomial-"],#prob-new-seed,#prob-seed',
        )
        .forEach((el) => (el.disabled = true));
      const note = document.createElement("p");
      note.className = "hint";
      note.textContent =
        "読込データは固定したまま、理論の条件を変えて比べます。新しく試行するにはデータタブで「サンプルを使用」を選びます。";
      root.querySelector("aside").append(note);
    }
    if (state.mode !== "normal") {
      bind(root, "prob-p", (value) => update({ p: value }));
      bind(root, "prob-seed", (value) => update({ seed: value }));
      root.querySelector("#prob-new-seed").onclick = () =>
        update({ seed: (state.seed + 104729) >>> 0 });
    }
    if (state.mode === "coin") {
      for (const count of [10, 100, 1000])
        root.querySelector(`#coin-${count}`).onclick = () =>
          update({ tossCount: Math.min(10000, state.tossCount + count) });
      root.querySelector("#coin-clear").onclick = () =>
        update({ tossCount: 0 });
      root.querySelector("#prob-early").onchange = (event) =>
        update({ early: event.target.checked });
    } else if (state.mode === "binomial") {
      bind(root, "prob-n", (value) =>
        update({
          n: loaded ? Math.max(value, ...state.observed.values) : value,
        }),
      );
      for (const count of [100, 1000])
        root.querySelector(`#binomial-${count}`).onclick = () =>
          update({ repetitions: Math.min(10000, state.repetitions + count) });
      root.querySelector("#binomial-clear").onclick = () =>
        update({ repetitions: 0 });
    } else {
      bind(root, "normal-mu", (value) => update({ mu: value }));
      bind(root, "normal-sigma", (value) => update({ sigma: value }));
      bind(root, "normal-low", (value) =>
        update({ low: Math.min(value, state.high) }),
      );
      bind(root, "normal-high", (value) =>
        update({ high: Math.max(value, state.low) }),
      );
      root.querySelector("#normal-one").onclick = () =>
        update({ low: state.mu - state.sigma, high: state.mu + state.sigma });
      root.querySelector("#normal-two").onclick = () =>
        update({
          low: state.mu - 2 * state.sigma,
          high: state.mu + 2 * state.sigma,
        });
      root.querySelector("#normal-center").onclick = () =>
        update({ low: state.mu - 4 * state.sigma, high: state.mu });
    }
  },
  explanation: academicExplanation("probability"),
  related: ["sampling", "histogram", "hypothesis-test"],
};
