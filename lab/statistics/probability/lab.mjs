import { fmt } from "../shared/math.mjs";
import {
  range,
  number,
  metrics,
  table,
  svg,
  axes,
  line,
  bind,
} from "../shared/ui.mjs";
import {
  coinExperiment,
  binomialExperiment,
  normalInterval,
  normalDensity,
  normalizeState,
} from "./model.mjs";

function coinView(state) {
  const result = coinExperiment(state.p, state.tossCount, state.seed);
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
  const target = `<line x1="${a.x(0)}" x2="${a.x(xmax)}" y1="${a.y(state.p)}" y2="${a.y(state.p)}" stroke="#bb731e" stroke-width="2" stroke-dasharray="6 4"/><text x="${a.x(xmax) - 4}" y="${Math.max(23, a.y(state.p) - 9)}" fill="#985d16" text-anchor="end" font-size="12">設定した確率 p = ${fmt(state.p, 2)}</text>`;
  const last = shown.at(-1);
  const endpoint = last
    ? `<circle class="point" cx="${a.x(last.x)}" cy="${a.y(last.y)}" r="4"><title>${last.x}回時点：${fmt(last.y, 4)}</title></circle>`
    : "";
  const recent = result.tosses
    .slice(-40)
    .map(
      (success, i) =>
        `<span title="第${Math.max(0, result.tosses.length - 40) + i + 1}回：${success ? "表" : "裏"}" style="display:inline-block;width:1.7em;height:1.7em;line-height:1.7;text-align:center;border-radius:50%;margin:3px;background:${success ? "#247b77" : "#e4e8eb"};color:${success ? "white" : "#334553"}">${success ? "表" : "裏"}</span>`,
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
    <p class="hint">最大10000回。同じ種なら同じ乱数列で再現します。pを変えると、その乱数列を新しい確率で判定し直すので、同じ条件の偶然を使って比較できます。</p>
    <p class="annotation">${state.p === 0 || state.p === 1 ? "p = 0 または 1 では結果は確定しています。偶然によるばらつきはありません。" : "回数を増やすと割合はpの近くに安定する傾向がありますが、毎回必ず近づくわけではありません。次に裏が「出やすくなる」こともありません。"}</p></aside></div>`;
}

function binomialView(state) {
  const result = binomialExperiment(
    state.n,
    state.p,
    state.repetitions,
    state.seed,
  );
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
          `<circle cx="${a.x(point.x)}" cy="${a.y(point.y)}" r="3" fill="#bb731e"/>`,
      )
      .join("");
  return `<div class="stat-grid"><section class="panel chart-panel"><h2>「${state.n}回投げる」を1セットとして繰り返す</h2>
    <p class="muted">たとえば表が${Math.round(state.n * state.p)}回出たセットを、棒の1か所に積み上げます。セットごとの表の回数が二項分布を作ります。</p>
    ${svg(a.markup + bars + theory, "二項分布。棒は反復実験の相対度数、橙の点と線は理論確率。", 720, 350)}
    <p class="legend"><span style="color:#247b77">■ 実験の相対度数</span>　<span style="color:#bb731e">● 理論上の確率</span>（離散値の点を読みやすく結んでいます）</p>
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
    <p class="hint">pとnを変えると、同じセット数を新しい条件で実験し直します。最大10000セット。pと各回の独立性は全セットで一定と仮定しています。</p>
    <p class="annotation">${state.p === 0 || state.p === 1 ? `p = ${state.p}なので、表の回数は必ず${state.p * state.n}回です。標準偏差は0になります。` : "反復セット数は、実験の棒が理論確率に近づく精度を変えます。1セットのnを変えると、分布そのものが変わります。2つの回数を区別してみましょう。"}</p>
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

function normalChart(mu, sigma, low, high, standardized = false) {
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
    area = `<polygon points="${a.x(left)},${a.y(0)} ${points.join(" ")} ${a.x(right)},${a.y(0)}" fill="#247b77" opacity="0.28"/>`;
  }
  const boundaries = [low, high]
    .filter((value) => value >= xmin && value <= xmax)
    .map(
      (value) =>
        `<line x1="${a.x(value)}" x2="${a.x(value)}" y1="${a.y(0)}" y2="${a.y(normalDensity(value, mu, sigma))}" stroke="#247b77" stroke-width="2"/>`,
    )
    .join("");
  const mean = `<line x1="${a.x(mu)}" x2="${a.x(mu)}" y1="${a.y(0)}" y2="${a.y(normalDensity(mu, mu, sigma))}" stroke="#bb731e" stroke-dasharray="5 4"/><text x="${a.x(mu) + 6}" y="${a.y(ymax) + 16}" font-size="12" fill="#985d16">${standardized ? "平均 0" : `平均 μ = ${fmt(mu, 1)}`}</text>`;
  return svg(
    a.markup + area + line(curve, a.x, a.y) + boundaries + mean,
    `${standardized ? "標準正規分布" : "正規分布"}。色の面積は指定した区間の確率。表示は平均の前後4標準偏差。`,
    720,
    standardized ? 270 : 340,
  );
}

function normalView(state) {
  const interval = normalInterval(state.mu, state.sigma, state.low, state.high);
  return `<div class="stat-grid"><section class="panel chart-panel"><h2>区間に入る確率は「面積」</h2>
    <p class="muted">架空の測定値 X が正規分布に従うモデルです。平均と標準偏差を動かし、同じ区間に入る確率を比べましょう。</p>
    ${normalChart(state.mu, state.sigma, state.low, state.high)}
    ${metrics([
      ["区間", `${fmt(state.low, 1)} ≤ X ≤ ${fmt(state.high, 1)}`],
      [
        "区間に入る確率",
        `${fmt(interval.probability * 100, 2)}%`,
        `P(${fmt(state.low, 1)} ≤ X ≤ ${fmt(state.high, 1)})`,
      ],
      [
        "左端の標準化",
        `z = ${fmt(interval.zLow)}`,
        `(${fmt(state.low, 1)} − ${fmt(state.mu, 1)}) ÷ ${fmt(state.sigma, 1)}`,
      ],
      [
        "右端の標準化",
        `z = ${fmt(interval.zHigh)}`,
        `(${fmt(state.high, 1)} − ${fmt(state.mu, 1)}) ÷ ${fmt(state.sigma, 1)}`,
      ],
    ])}
    <p class="hint">曲線の高さは確率密度です。高さそのものを確率と読まず、区間の面積を読みます。図は μ ± 4σ までを表示し、数値は図の外の裾も含めて計算します。</p>
    </section><aside class="panel controls"><h2>正規分布のモデル</h2>
    ${range("normal-mu", "平均 μ", state.mu, -50, 100, 1)}
    ${range("normal-sigma", "標準偏差 σ", state.sigma, 1, 30, 1)}
    ${number("normal-low", "区間の左端 a", state.low, -200, state.high, 0.5)}
    ${number("normal-high", "区間の右端 b", state.high, state.low, 200, 0.5)}
    <div class="actions"><button id="normal-one" class="primary">区間を μ ± σ に</button><button id="normal-two">区間を μ ± 2σ に</button><button id="normal-center">区間を μ−4σ 〜 μ に</button></div>
    <p class="annotation">μは分布の位置、σは散らばりの尺度です。μ ± σ の区間に合わせ直すと、μやσが違っても約68.27%になります。区間を固定してσだけ動かした場合も同じですか？</p>
    </aside></div><section class="panel chart-panel"><h2>同じ面積を、標準正規分布で読む</h2>
    <p><strong>Z = (X − μ) / σ</strong> と変換すると、平均0・標準偏差1になります。${fmt(state.low, 1)} ≤ X ≤ ${fmt(state.high, 1)} は、${fmt(interval.zLow)} ≤ Z ≤ ${fmt(interval.zHigh)} に対応します。</p>
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
      bind(root, "prob-n", (value) => update({ n: value }));
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
  missions: [
    {
      title: "表が続いたら、次は裏が出やすい？",
      body: "公平なコインを10回ずつ追加し、表が続いた場所を探しましょう。その後1000回まで増やし、最初の50回とも比較します。割合が安定することと、次の1回で帳尻が合うことの違いを説明してください。「別の偶然」でも確認しましょう。",
      preset: {
        mode: "coin",
        p: 0.5,
        tossCount: 10,
        seed: 20261015,
        early: false,
      },
    },
    {
      title: "2種類の「回数」を区別しよう",
      body: "p = 0.3、1セット12回から始めます。反復を100→1000→10000セットにしたとき、分布の形と実験の誤差はどう変わりますか？ 次に反復数を固定して1セットのnを変え、何を調べるための設定かを説明してください。",
      preset: {
        mode: "binomial",
        p: 0.3,
        n: 12,
        repetitions: 100,
        seed: 20261015,
      },
    },
    {
      title: "同じ区間？ 同じ「標準偏差の何倍」？",
      body: "40〜60の区間を固定して標準偏差を変え、確率を比べます。次に毎回「μ ± σ」に合わせ直すと、なぜ確率が同じになるでしょう。下の標準化した区間と面積を使って説明してください。",
      preset: { mode: "normal", mu: 50, sigma: 10, low: 40, high: 60 },
    },
  ],
  explanation: `<h2>結果を予言するのではなく、偶然の規則性を知る</h2><p>表の確率pを固定し、独立にコインを投げます。表の相対度数は「表の回数 ÷ 投げた回数」です。試行を多数繰り返すと相対度数がpの近くにある確率は高くなりますが、毎回単調に近づくわけではありません。表が連続しても次に裏が出る確率が増えることはありません。表と裏の回数の差そのものが必ず小さくなる、という法則でもありません。</p><h3>二項分布では、何を1回と数える？</h3><p>独立なn回の試行を1セットにして、成功回数Xを数えると二項分布になります。1セットの試行回数nと、セットを繰り返す回数は別です。nやpは理論分布を変えますが、反復セット数は実験による近似の精度を変えます。成功確率が途中で変わる場合や、前の結果に依存する場合には、そのまま二項分布を使えません。点を結んだ理論線は見やすくするためのもので、成功回数に小数の値が生じるわけではありません。</p><h3>正規分布と標準化</h3><p>正規分布は平均μを中心とする左右対称の連続分布です。標準偏差σを大きくすると横に広がり、全体の面積が1のままなので山は低くなります。確率は高さではなく面積です。Z = (X − μ) / σ と標準化すれば、元の単位を外して「平均から標準偏差の何倍離れているか」で比較できます。μ ± σには約68.27%、μ ± 2σには約95.45%が入ります。</p><p>すべての実測データが正規分布になるわけではありません。非対称な分布や複数集団が混ざった分布では、モデルの妥当性を先に調べましょう。二項分布の正規近似も、nが大きいだけで十分とは限らず、npやn(1−p)の大きさなどに注意が必要です。</p><h3>この実験の再現性</h3><p>乱数の種が同じなら、同じ条件では同じ試行列を生成します。追加した試行はそれまでの列を保ちます。「別の偶然を試す」で種を変えると別の実験になります。pを変えたときは同じ一様乱数列を新しいpで判定し直すため、既存の回数を新しい条件で再実験した表示になります。実験結果と理論値を区別して比較してください。</p>`,
  related: ["sampling", "histogram", "hypothesis-test"],
};
