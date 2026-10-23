import { mean, fmt } from "../shared/math.mjs";
import {
  esc,
  range,
  number,
  select,
  metrics,
  svg,
  bind,
} from "../shared/ui.mjs";
import {
  population,
  samplingSE,
  newExperiment,
  normalizeExperiment,
  addTrials,
  samplingDomain,
  experimentSummary,
  comparisonSettings,
  compareSampleSizes,
} from "./model.mjs?v=20261023-sampling-size-comparison";

const positions = new WeakMap();
const unitOf = (state) => (state.customPopulation ? "" : "分");
const axisLabel = (state, prefix) =>
  `${prefix}：${state.dataInfo?.columns?.[0] || (state.customPopulation ? "値" : "読書時間（分）")}`;
const axisValue = (v, tick) =>
  Math.abs(v) >= 1e5 || (v !== 0 && Math.abs(tick) < 0.001)
    ? v.toExponential(1)
    : fmt(v, Math.max(0, -Math.floor(Math.log10(tick))));
const xScale = (domain) => (v) =>
  56 + ((v - domain.xmin) / (domain.xmax - domain.xmin)) * 608;
function xTicks(domain, y, labelsY) {
  const x = xScale(domain);
  const ticks = [];
  for (
    let i = Math.ceil(domain.xmin / domain.tick);
    i * domain.tick <= domain.xmax + domain.tick * 1e-8;
    i++
  ) {
    const v = i * domain.tick || 0;
    ticks.push(
      `<line x1="${x(v)}" x2="${x(v)}" y1="${y}" y2="${y + 5}" stroke="#6b8279"/><text x="${x(v)}" y="${labelsY}" text-anchor="middle">${axisValue(v, domain.tick)}</text>`,
    );
  }
  return ticks.join("");
}
const chartAttributes = (markup, domain, attributes = "") =>
  markup.replace(
    "<svg",
    `<svg data-sampling-domain-min="${domain.xmin}" data-sampling-domain-max="${domain.xmax}" ${attributes}`,
  );

function populationChart(state) {
  const people = population(state.customPopulation),
    counts = new Map();
  state.last.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
  const full = document.querySelector("#statistics-fullscreen")?.open;
  const available = Math.min(
    1000,
    window.innerWidth - (full && window.innerWidth >= 900 ? 330 : 80),
  );
  const columns = Math.max(6, Math.min(20, Math.floor(available / 36))),
    width = columns * 36 + 18,
    height = Math.ceil(people.length / columns) * 36 + 18;
  const drawing = people
    .map((person, i) => {
      const count = counts.get(person.id) || 0,
        x = 27 + (i % columns) * 36,
        y = 27 + Math.floor(i / columns) * 36;
      return `<g data-population-id="${person.id}" data-selected="${count > 0}" data-draw-count="${count}"><circle cx="${x}" cy="${y}" r="${count > 1 ? 16 : count ? 14 : 8}" fill="${count ? "#0d514f" : "#e0ece7"}" stroke="${count ? "#172f35" : "#b7c8bd"}" stroke-width="${count ? 2 : 1}"><title>${person.id + 1}番：${person.value}${unitOf(state)}・今回${count}回選択</title></circle>${count ? `<text class="sampling-value" x="${x}" y="${y + (count > 1 ? -5 : 0)}" ${count > 1 ? 'data-label-offset="-5"' : ""} dominant-baseline="central" fill="white" font-size="12" font-weight="700" text-anchor="middle">${esc(person.value)}</text>${count > 1 ? `<text class="sampling-repeat-count" x="${x}" y="${y + 8}" data-label-offset="8" dominant-baseline="central" text-anchor="middle">×${count}</text>` : ""}` : ""}</g>`;
    })
    .join("");
  return svg(
    drawing,
    `${people.length}人の母集団。濃い丸が今回選ばれた人。白い数字は値、×の数字は選ばれた回数。`,
    width,
    height,
  ).replace("<svg", "<svg data-sampling-population");
}

function distributionChart(state, domain) {
  const x = xScale(domain),
    top = 36,
    bottom = 252,
    width = (domain.xmax - domain.xmin) / 32;
  const bins = Array.from({ length: 32 }, (_, i) => ({
    lo: domain.xmin + i * width,
    hi: domain.xmin + (i + 1) * width,
    count: 0,
  }));
  for (const result of state.history)
    bins[
      Math.max(0, Math.min(31, Math.floor((result.mean - domain.xmin) / width)))
    ].count++;
  const peak = Math.max(1, ...bins.map((b) => b.count)),
    ystep = Math.max(1, Math.ceil(peak / 4)),
    ymax = ystep * 4;
  const y = (v) => bottom - (v / ymax) * (bottom - top);
  let drawing = "";
  for (let i = 0; i <= 4; i++)
    drawing += `<line class="gridline" x1="56" x2="664" y1="${y(i * ystep)}" y2="${y(i * ystep)}"/><text x="47" y="${y(i * ystep) + 4}" text-anchor="end">${i * ystep}</text>`;
  drawing += bins
    .filter((b) => b.count)
    .map(
      (b) =>
        `<rect class="bar" x="${x(b.lo) + 0.5}" y="${y(b.count)}" width="${Math.max(0.5, x(b.hi) - x(b.lo) - 1)}" height="${bottom - y(b.count)}"><title>${fmt(b.lo)}以上${fmt(b.hi)}未満：${b.count}回</title></rect>`,
    )
    .join("");
  drawing += `<path class="axis" d="M56,36V252H664"/>${xTicks(domain, 252, 273)}<text x="360" y="297" text-anchor="middle">${esc(axisLabel(state, "標本平均"))}</text><text x="56" y="17">回数</text><line data-sampling-truth x1="360" x2="360" y1="36" y2="252" stroke="#995b10" stroke-width="2" stroke-dasharray="6 4"/><text x="360" y="20" text-anchor="middle">母平均 ${fmt(domain.truth)}${unitOf(state)}</text>`;
  return chartAttributes(
    svg(
      drawing,
      `${state.trials}回の標本平均の分布。中央の破線は固定された母平均。`,
      720,
      305,
    ),
    domain,
  );
}

function sizeComparisonChart(state, comparison) {
  const { domain, series } = comparison,
    x = xScale(domain),
    binWidth = (domain.xmax - domain.xmin) / 32;
  const counts = series.map(({ history }) => {
    const bins = Array(32).fill(0);
    for (const result of history)
      bins[
        Math.max(
          0,
          Math.min(31, Math.floor((result.mean - domain.xmin) / binWidth)),
        )
      ]++;
    return bins;
  });
  const step = Math.max(1, Math.ceil(Math.max(...counts.flat()) / 4)),
    ymax = step * 4;
  let drawing = "";
  series.forEach(({ n }, index) => {
    const top = 35 + index * 180,
      bottom = top + 122,
      y = (count) => bottom - (count / ymax) * (bottom - top),
      color = index ? "#9b5417" : "#176660";
    drawing += `<g data-comparison-series="${index}" data-sample-size="${n}" data-y-max="${ymax}"><text x="56" y="${top - 13}" fill="${color}" font-weight="700">${index ? "◇" : "●"} 標本数 ${n} ・ ${comparison.trials}回</text>`;
    for (let i = 0; i <= 4; i++)
      drawing += `<line class="gridline" x1="56" x2="664" y1="${y(i * step)}" y2="${y(i * step)}"/><text x="47" y="${y(i * step) + 4}" text-anchor="end">${i * step}</text>`;
    counts[index].forEach((count, bin) => {
      if (!count) return;
      const lo = domain.xmin + bin * binWidth,
        hi = lo + binWidth;
      drawing += `<rect data-bin-count="${count}" x="${x(lo) + 0.5}" y="${y(count)}" width="${Math.max(0.5, x(hi) - x(lo) - 1)}" height="${bottom - y(count)}" fill="${index ? "#fffaf1" : color}" stroke="${color}" stroke-width="1.5" ${index ? 'stroke-dasharray="4 2"' : ""}><title>標本数${n}：${fmt(lo)}以上${fmt(hi)}未満 ${count}回</title></rect>`;
    });
    drawing += `<path class="axis" d="M56,${top}V${bottom}H664"/>${xTicks(domain, bottom, bottom + 21)}<line data-sampling-truth x1="360" x2="360" y1="${top}" y2="${bottom}" stroke="#995b10" stroke-width="2" stroke-dasharray="6 4"/></g>`;
  });
  drawing += `<text x="360" y="391" text-anchor="middle">${esc(axisLabel(state, "標本平均（共通の目盛り）"))}</text>`;
  return chartAttributes(
    svg(
      drawing,
      `標本数${series[0].n}と${series[1].n}で各${comparison.trials}回の平均を比較。横軸、階級、縦軸の目盛りは共通。上は塗り棒、下は破線の白抜き棒。`,
      720,
      400,
    ),
    domain,
    "data-sampling-comparison",
  );
}

function sizeComparisonPanel(state) {
  const comparison = compareSampleSizes(state),
    [first, second] = comparison.series,
    unit = unitOf(state),
    ratio =
      first.summary.spread > 0
        ? second.summary.spread / first.summary.spread
        : null,
    theoryRatio = first.se > 0 ? second.se / first.se : null;
  const observed =
    ratio === null
      ? first.summary.spread === 0 && second.summary.spread === 0
        ? "どちらも標本平均は動かず、ぶれは0です。"
        : "①のぶれが0なので、倍率は計算しません。"
      : `②のぶれは①の${fmt(ratio, 2)}倍でした。${ratio < 1 ? `約${fmt((1 - ratio) * 100, 1)}%小さくなっています。` : ratio > 1 ? "今回は②の方が大きくなっています。" : "今回は同じ大きさです。"}`;
  return `<section class="panel chart-panel sampling-comparison-panel"><h2>標本数${first.n}と${second.n}を、各${comparison.trials}回で比べる</h2>${metrics(
    comparison.series.map((s, i) => [
      `${i ? "◇ ②" : "● ①"} 標本数${s.n}：平均の標準偏差`,
      `${fmt(s.summary.spread)}${unit}`,
      `理論上の標準誤差 ${fmt(s.se)}${unit} ・ 各${comparison.trials}回`,
    ]),
  )}${sizeComparisonChart(state, comparison)}<div class="legend sampling-comparison-legend"><span>● ①：塗り棒・実線 ／ 標本数${first.n}</span><span>◇ ②：白抜き棒・破線 ／ 標本数${second.n}</span><span>橙の縦破線：母平均 ${fmt(comparison.domain.truth)}${unit}</span><span>縦軸：回数</span><span>横軸・階級幅・縦軸をそろえて比較</span></div><p class="annotation" data-size-comparison-reading>${observed}</p><p class="hint">比べるのは、個々の人の値のばらつきではなく、繰り返し作った「標本平均のばらつき」です。同じ母集団・抽出方法・乱数の種で、両方を同じ回数ずつ抽出しています。各回の抽出順を共通にし、人数だけを変えます。この比較用の反復は、他のタブの抽出履歴とは別です。</p><p class="hint">${first.n === second.n ? "標本数が同じなので、2つの結果は一致します。片方の標本数を変えてみましょう。" : `標本数を増やすと、理論上の標準誤差は小さくなります。${theoryRatio === null ? "" : `この条件では、②は①の${fmt(theoryRatio, 2)}倍です。`}実験で求めた標準偏差は偶然で変わるため、少ない反復では大小が逆になることもあります。`}</p><p class="hint">重複ありなら標準誤差は σ/√n。20人から40人に増やすと1/√2（約0.71倍）です。重複なしでは、全体の人数による補正も加わります。</p></section>`;
}

function intervalChart(state, domain) {
  const x = xScale(domain),
    height = Math.max(286, state.history.length * 26);
  const axis = `<text x="360" y="16" text-anchor="middle">母平均 ${fmt(domain.truth)}${unitOf(state)}</text><line data-sampling-truth x1="360" x2="360" y1="24" y2="36" stroke="#995b10" stroke-width="2" stroke-dasharray="5 3"/><path class="axis" d="M56,36H664"/>${xTicks(domain, 36, 55)}<text x="360" y="74" text-anchor="middle">${esc(axisLabel(state, "平均の推定範囲"))}</text>`;
  const rows = state.history
    .map((result, index) => ({ result, trial: index + 1 }))
    .reverse()
    .map(({ result, trial }, i) => {
      const y = 14 + i * 26,
        covers = result.low <= domain.truth && domain.truth <= result.high;
      const color = covers ? "#176660" : "#a63c42";
      return `<g data-sampling-trial="${trial}" data-covers="${covers}"><text class="sampling-trial-label" x="47" y="${y + 4}" text-anchor="end">${trial}</text><line x1="${x(result.low)}" x2="${x(result.high)}" y1="${y}" y2="${y}" stroke="${color}" stroke-width="3" ${covers ? "" : 'stroke-dasharray="5 3"'}/><line x1="${x(result.low)}" x2="${x(result.low)}" y1="${y - 5}" y2="${y + 5}" stroke="${color}"/><line x1="${x(result.high)}" x2="${x(result.high)}" y1="${y - 5}" y2="${y + 5}" stroke="${color}"/><circle cx="${x(result.mean)}" cy="${y}" r="4" fill="${covers ? color : "white"}" stroke="${color}" stroke-width="2"/><title>第${trial}回：${fmt(result.low)}〜${fmt(result.high)}${unitOf(state)}・母平均を${covers ? "捉えた" : "捉えなかった"}</title></g>`;
    })
    .join("");
  const truthLine = `<line data-sampling-truth x1="360" x2="360" y1="0" y2="${height}" stroke="#995b10" stroke-width="2" stroke-dasharray="5 4"/>`;
  return `<div class="sampling-intervals">${chartAttributes(svg(axis, "全履歴で共通の横軸。中央は母平均。", 720, 80), domain, "data-sampling-axis data-fixed-row-chart")}<div class="sampling-history-scroll" tabindex="0" role="region" aria-label="抽出ごとの区間。新しい順。スクロールまたは矢印キーで過去の区間を確認。" data-history-signature="${esc(state.signature)}" data-history-trials="${state.trials}">${chartAttributes(svg(truthLine + rows, `${state.history.length}回全ての推定区間。実線と塗り丸は母平均を捉えた区間、破線と白丸は捉えなかった区間。`, 720, height), domain, `data-scroll-chart data-fixed-row-chart style="--sampling-history-height:${height}px"`)}</div></div>`;
}

function coverageReading(state, summary, se) {
  if (se === 0)
    return state.n === population(state.customPopulation).length &&
      state.method === "without"
      ? "重複なしで全員を1回ずつ選んだので、平均は毎回同じです。区間は母平均の1点になり、捉えた割合は100%です。"
      : "全員の値が同じなので、どの人を選んでも平均は変わりません。区間は1点になり、捉えた割合は100%です。";
  return `今回は${summary.count}本のうち${summary.covered}本（${fmt(summary.coverage * 100, 1)}%）が母平均を捉え、${summary.missed}本（${fmt((1 - summary.coverage) * 100, 1)}%）が外れました。100本作ればおよそ95本が捉える、というのが95%の目安です。毎回ぴったり95%になるわけではありません。`;
}

function reflection(state, people, summary, se) {
  const values = people.map((p) => p.value),
    truth = mean(values),
    unit = unitOf(state),
    unique = new Set(state.last).size;
  const n2 = Math.min(people.length, state.n * 2),
    nextSE = samplingSE(values, n2, state.method),
    other = state.method === "with" ? "without" : "with";
  const census = state.method === "without" && state.n === people.length;
  return `<section class="panel sampling-reflection"><h2>この調査から何がわかるか</h2>${metrics(
    [
      [
        "繰り返した平均の中心",
        `${fmt(summary.center)}${unit}`,
        `母平均との差 ${fmt(summary.error)}${unit}`,
      ],
      [
        "推定の誤差の大きさ（RMSE）",
        `${fmt(summary.rmse)}${unit}`,
        "母平均との差を二乗して平均し、平方根を取る",
      ],
    ],
  )}<div class="sampling-reading-cards"><section><h3>一部から全体の平均を知りたい</h3><p>知りたいのは${people.length}人全体の平均${fmt(truth)}${unit}です。${state.n}回ずつ選んで標本を作り、${summary.count}組の平均を比べています。${summary.count < 2 ? "まだ1組だけです。100回繰り返して、平均がどれくらい動くか見てみましょう。" : `標本平均の中心は${fmt(summary.center)}${unit}、平均のぶれの大きさは${fmt(summary.spread)}${unit}でした。1回の結果だけでなく、繰り返したときの様子を読み取ります。`}</p></section><section><h3>同じ回数でも、選ばれる人数は違う</h3><p>今回は${state.n}回選び、${unique}人が標本に入りました。${state.method === "with" ? `同じ人の再登場は${state.n - unique}回。同じ人を複数回選んだときは、その値を回数分だけ平均に入れます。${state.n === people.length ? "母集団の人数と同じ回数を引いても、全員を調べたことにはなりません。" : ""}` : "重複なしなので、選ばれた人は全て別の人です。"}</p></section><section><h3>2つの抽出方法で比べよう</h3><p>標本数${state.n}のとき、理論上の平均のぶれ（標準誤差）は、重複なしで${fmt(samplingSE(values, state.n, "without"))}${unit}、重複ありで${fmt(samplingSE(values, state.n, "with"))}${unit}です。どちらも公平に選びます。重複なしでは、選んだ人数が全員に近づくほど、平均のぶれが小さくなります。1人だけ選ぶときは同じです。</p><button type="button" id="sampling-try-other">同じ標本数で${other === "with" ? "重複あり" : "重複なし"}を試す</button></section><section><h3>標本数を増やすとどうなる？</h3><p>${census ? "今回は全員を1回ずつ選んだ全数調査なので、標本誤差は0です。" : n2 > state.n ? `今の抽出方法で標本数を${state.n}から${n2}に増やすと、理論上の標準誤差は${fmt(se)}${unit}から${fmt(nextSE)}${unit}になります。標本数を増やす効果と、抽出方法を変える効果を比べましょう。` : "重複ありでは同じ人が繰り返し選ばれます。重複なしに切り替えた場合と、平均のぶれや区間の幅を比べてみましょう。"}</p>${n2 > state.n ? `<button type="button" id="sampling-try-larger">標本数${n2}で新しい実験を始める</button>` : ""}</section><section><h3>95%の目安と今回の結果</h3><p>${coverageReading(state, summary, se)}</p><p>この教材では正解の母平均を表示しているので、区間が届いたかを確かめられます。実際の調査では正解がわからないため、1本の区間が捉えたかを直接確認することは通常できません。</p></section></div></section>`;
}

export default {
  id: "sampling",
  title: "標本調査と推定",
  description:
    "重複なしと重複ありで平均のぶれを比較し、95%信頼区間の意味を確かめよう。",
  lead: "架空の学校で、平日の読書時間を調べます。120人の母集団から一部を選び、平均を推定してみましょう。",
  initial: () => newExperiment(),
  render(root, ctx) {
    const previous = root.querySelector(".sampling-history-scroll");
    if (previous && !previous.closest("[hidden]"))
      positions.set(root, {
        signature: previous.dataset.historySignature,
        trials: Number(previous.dataset.historyTrials),
        offset: previous.scrollTop,
      });
    const state = normalizeExperiment(ctx.state),
      people = population(state.customPopulation),
      values = people.map((p) => p.value),
      truth = mean(values),
      unit = unitOf(state);
    const unique = new Set(state.last).size;
    const latest = state.history.at(-1),
      se = samplingSE(values, state.n, state.method),
      summary = experimentSummary(state.history, truth),
      domain = samplingDomain(values, state.n, state.history, state.method);
    const comparing = ctx.view === 2,
      comparison = comparisonSettings(state);
    root.innerHTML = `<div class="stat-grid"><section class="panel chart-panel"><h2>母集団から、${state.n}回選ぶ</h2><p class="muted">丸1つが1件。大きく濃い丸が今回の標本で、白い数字はその値です。</p>${(ctx.view || 0) === 0 ? populationChart(state) : ""}<p class="legend"><span>淡い丸：今回選ばれていない人</span><span>濃い丸・白い数字：今回選ばれた人と値</span>${state.method === "with" ? "<span>×の数字：同じ人を選んだ回数</span>" : ""}</p>${metrics(
      [
        ["今回の標本平均", `${fmt(latest.mean)}${unit}`],
        [
          "本当の母平均",
          `${fmt(truth)}${unit}`,
          "この教材では答えを見て検証できる",
        ],
        [
          "今回の標本誤差",
          `${latest.mean - truth >= 0 ? "+" : ""}${fmt(latest.mean - truth)}${unit}`,
          "標本平均 − 母平均",
        ],
        [
          "今回選ばれた人数",
          `${unique} / ${people.length}人`,
          `${state.n}回の抽出・同じ人の再登場 ${state.n - unique}回`,
        ],
      ],
    )}</section><aside class="panel controls"><h2>調査を設計する</h2>${comparing ? `${number("sample-compare-first", "● ① 標本数", comparison.sizes[0], 1, people.length)}${number("sample-compare-second", "◇ ② 標本数", comparison.sizes[1], 1, people.length)}` : range("sample-n", "標本数 n", state.n, 1, people.length, 1, "件")}${select(
      "sample-method",
      "抽出方法",
      [
        ["without", "重複なし"],
        ["with", "重複あり"],
      ],
      state.method,
    )}<p class="hint">${state.method === "with" ? "選ぶたびに元へ戻します。同じ人が何度も標本に入ることがあります。" : "1つの標本の中で、同じ人は1度だけ選びます。"}</p>${number("sample-seed", "再現用の乱数の種", state.seed, 0, 4294967295, 1)}<div class="actions">${comparing ? `<button id="sample-compare-many" class="primary" ${comparison.trials >= 2000 ? "disabled" : ""}>両方に100回追加</button><button id="sample-compare-reset">各200回からやり直す</button>` : `<button id="sample-one" class="primary" ${state.trials >= 2000 ? "disabled" : ""}>1回抽出する</button><button id="sample-many" ${state.trials >= 2000 ? "disabled" : ""}>100回繰り返す</button><button id="sample-replay">同じ実験を再現</button>`}</div><p class="muted">${comparing ? "両方の標本数・抽出方法・種を変えても、反復回数をそろえて比較します。初期値は各200回、最大各2000回。比較の標本数と反復回数は他のタブと別に保持します。抽出方法・種・母集団は共通です。" : "条件を変えると、新しい条件で1回目から開始します。種と条件が同じなら、抽出の順序も結果も再現できます。最大2000回。"}</p></aside></div>
    <section class="panel chart-panel"><h2>${state.trials}回の推定を重ねる</h2>${ctx.view === 1 ? distributionChart(state, domain) : ""}${metrics(
      [
        [
          "推定値の平均",
          `${fmt(summary.center)}${unit}`,
          `母平均との差 ${fmt(summary.error)}${unit}`,
        ],
        [
          "推定値の標準偏差",
          summary.spread === null
            ? "2回以上で表示"
            : `${fmt(summary.spread)}${unit}`,
          "反復結果から計算・分母は回数−1",
        ],
        [
          "理論上の標準誤差",
          `${fmt(se)}${unit}`,
          state.method === "with"
            ? "重複あり：母標準偏差 ÷ √n"
            : "重複なし：全体の人数も考慮",
        ],
      ],
    )}<p class="hint">横軸は区間の図と共通です。最初は狭い範囲で始め、結果がはみ出すと左右を同じだけ広げます。母平均はいつも中央です。標準誤差は、標本の平均がどれくらいぶれるかを表します。</p></section>
    ${comparing ? sizeComparisonPanel(state) : '<section class="panel chart-panel sampling-comparison-panel"></section>'}
    <section class="panel chart-panel sampling-interval-panel"><h2>95%信頼区間を繰り返す</h2>${metrics(
      [
        [
          "母平均を捉えた区間",
          `${fmt(summary.coverage * 100, 1)}%`,
          `${summary.covered} / ${summary.count}回`,
        ],
        [
          "母平均を捉えなかった区間",
          `${fmt((1 - summary.coverage) * 100, 1)}%`,
          `${summary.missed} / ${summary.count}回`,
        ],
      ],
    )}<div class="legend sampling-interval-legend"><span>実線・塗り丸：母平均を捉えた</span><span>破線・白丸：母平均を捉えなかった</span><span>橙の縦破線：母平均</span><span>新しい順。スクロールして過去の区間へ。</span></div>${ctx.view === 3 ? intervalChart(state, domain) : ""}<p class="annotation" data-coverage-reading>${coverageReading(state, summary, se)}</p><p class="hint">区間の線が中央の母平均に届けば「捉えた」、届かなければ「捉えなかった」です。母平均は動かず、選ぶ人が変わるたびに区間が動きます。</p><p class="hint">95%は「同じやり方で区間を何本も作ると、そのうち約95%が母平均を捉える」という目安です。「この1本が正しい確率が95%」という意味ではありません。</p><p class="hint">この教材では母集団全員の値を使って区間の幅を計算しています。平均が正規分布に近いとみなす計算なので、標本数が少ないと95%から離れることもあります。</p></section>
    ${reflection(state, people, summary, se)}`;
    bind(root, "sample-n", (n) => ctx.replace(newExperiment({ ...state, n })));
    bind(root, "sample-method", (method) =>
      ctx.replace(newExperiment({ ...state, method })),
    );
    bind(root, "sample-seed", (seed) =>
      ctx.replace(newExperiment({ ...state, seed })),
    );
    root
      .querySelector("#sample-one")
      ?.addEventListener("click", () => ctx.replace(addTrials(state, 1)));
    root
      .querySelector("#sample-many")
      ?.addEventListener("click", () => ctx.replace(addTrials(state, 100)));
    root
      .querySelector("#sample-replay")
      ?.addEventListener("click", () =>
        ctx.replace(addTrials(state, state.trials, true)),
      );
    const updateComparison = (settings) =>
      ctx.replace({ ...state, sizeComparison: { ...comparison, ...settings } });
    ["sample-compare-first", "sample-compare-second"].forEach((id, i) =>
      bind(
        root,
        id,
        (n) => {
          const sizes = [...comparison.sizes];
          sizes[i] = Math.max(1, Math.min(people.length, Math.trunc(n) || 1));
          updateComparison({ sizes });
        },
        "change",
      ),
    );
    root
      .querySelector("#sample-compare-many")
      ?.addEventListener("click", () =>
        updateComparison({ trials: Math.min(2000, comparison.trials + 100) }),
      );
    root
      .querySelector("#sample-compare-reset")
      ?.addEventListener("click", () => updateComparison({ trials: 200 }));
    root.querySelector("#sampling-try-other")?.addEventListener("click", () =>
      ctx.replace(
        newExperiment({
          ...state,
          method: state.method === "with" ? "without" : "with",
        }),
      ),
    );
    root
      .querySelector("#sampling-try-larger")
      ?.addEventListener("click", () =>
        ctx.replace(
          newExperiment({ ...state, n: Math.min(people.length, state.n * 2) }),
        ),
      );
    const viewport = root.querySelector(".sampling-history-scroll"),
      saved = positions.get(root);
    const offset =
      saved?.signature === state.signature && saved?.trials === state.trials
        ? saved.offset
        : 0;
    requestAnimationFrame(() => {
      if (viewport && root.contains(viewport) && !viewport.closest("[hidden]"))
        viewport.scrollTop = offset;
    });
    viewport?.addEventListener(
      "scroll",
      () =>
        positions.set(root, {
          signature: state.signature,
          trials: state.trials,
          offset: viewport.scrollTop,
        }),
      { passive: true },
    );
  },
  explanation: `<h2>重複なしと重複ありで、何が変わる？</h2><p>どちらも母集団の人を公平に選びます。重複なしでは、1つの標本の中に同じ人は2度入りません。重複ありでは、1人選ぶたびに元へ戻して選び直すので、同じ人が何度も入ることがあります。同じ人を2回選んだら、その値を2回分として平均します。</p><h3>標本の平均は、毎回少しずつ変わる</h3><p>標本の平均と母平均の差が標本誤差です。1回の平均が母平均から離れていても、それだけで抽出が間違っているとは言えません。何度も繰り返し、平均の中心と広がりを見ます。平均のぶれの大きさを表すのが標準誤差です。</p><p>母標準偏差をσ、標本数をn、母集団の人数をNとすると、重複ありの標準誤差は σ/√n です。重複なしでは、これに √((N−n)/(N−1)) を掛けます。nがNに近づくほど重複なしのぶれは小さくなり、全員を1回ずつ選ぶと0になります。重複ありでは、N回引いても全員を選ぶとは限りません。</p><h3>95%信頼区間を、たくさん作って確かめる</h3><p>区間は「標本平均 ± 1.96 × 標準誤差」で作っています。平均が正規分布に近いとみなした計算です。この方法を繰り返すと、およそ95%の区間が母平均に届く、というのが95%信頼区間の意味です。100本ならおよそ95本が届き、残りは外れると考えます。少ない回数では、95%からずれることもあります。</p><p>母平均は固定され、抽出する人が変わると区間の位置が動きます。出てきた1本の区間が「95%の確率で正しい」と言う意味ではありません。この教材では母平均を知っているので照合できますが、実際の調査では未知です。母標準偏差がわからない実際の調査では、推定方法や前提を別に確認します。</p>`,
  related: ["histogram", "probability", "hypothesis-test"],
};
