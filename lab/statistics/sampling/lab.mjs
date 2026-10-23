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
  finiteSE,
  newExperiment,
  normalizeExperiment,
  addTrials,
  samplingDomain,
  experimentSummary,
} from "./model.mjs?v=20261023-sampling-inference";

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
    selected = new Set(state.last);
  const full = document.querySelector("#statistics-fullscreen")?.open;
  const available = Math.min(
    1000,
    window.innerWidth - (full && window.innerWidth >= 900 ? 330 : 80),
  );
  const columns = Math.max(6, Math.min(20, Math.floor(available / 36)));
  const width = columns * 36 + 18,
    height = Math.ceil(people.length / columns) * 36 + 18;
  const drawing = people
    .map((person, i) => {
      const chosen = selected.has(person.id),
        x = 27 + (i % columns) * 36,
        y = 27 + Math.floor(i / columns) * 36;
      const fill = chosen
        ? person.frequent
          ? "#763c17"
          : "#0d514f"
        : person.frequent
          ? "#f2e5d4"
          : "#e0ece7";
      return `<g data-population-id="${person.id}" data-selected="${chosen}"><circle cx="${x}" cy="${y}" r="${chosen ? 14 : 8}" fill="${fill}" stroke="${chosen ? "#172f35" : "#b7c8bd"}" stroke-width="${chosen ? 2 : 1}" ${person.frequent ? 'stroke-dasharray="3 2"' : ""}><title>${person.id + 1}番：${person.value}${unitOf(state)}・集団${person.frequent ? "B" : "A"}${chosen ? "（今回の標本）" : ""}</title></circle>${chosen ? `<text class="sampling-value" x="${x}" y="${y}" dominant-baseline="central" fill="white" font-size="12" font-weight="700" text-anchor="middle" pointer-events="none">${esc(person.value)}</text>` : ""}</g>`;
    })
    .join("");
  return svg(
    drawing,
    `${people.length}件の母集団。大きく濃い丸が今回の標本。白い数字は各人の値。`,
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
    return "全数調査または母集団の値が全て同じため、区間の幅は0です。母平均を捉える割合は100%となり、95%の近似を確かめる実験とは区別します。";
  const difference = summary.coverage * 100 - 95;
  const observed = `今回の${summary.count}回では、母平均を捉えた区間は${summary.covered}回（${fmt(summary.coverage * 100, 1)}%）、捉えなかった区間は${summary.missed}回（${fmt((1 - summary.coverage) * 100, 1)}%）です。`;
  if (state.method === "biased")
    return (
      observed +
      "偏った抽出にSRS用の式を当てはめた帯なので、95%の包含率は保証されません。標本数を増やすだけでなく、集め方を点検しましょう。"
    );
  return (
    observed +
    `${difference === 0 ? "名目の95%と同じ割合です。" : `名目の95%より${fmt(Math.abs(difference), 1)}ポイント${difference < 0 ? "低い" : "高い"}結果です。`}有限回の偶然や正規近似によって、実験の割合は95%に一致するとは限りません。`
  );
}

function reflection(state, people, summary, se, frequent, groupB) {
  const truth = mean(people.map((p) => p.value)),
    unit = unitOf(state),
    n2 = Math.min(people.length, state.n * 2),
    nextSE = finiteSE(
      people.map((p) => p.value),
      n2,
    );
  const census = state.n === people.length,
    biased = state.method === "biased";
  return `<section class="panel sampling-reflection"><h2>この調査から何がわかるか</h2>${metrics(
    [
      [
        "繰り返した推定の中心",
        `${fmt(summary.center)}${unit}`,
        `母平均との差 ${fmt(summary.error)}${unit}`,
      ],
      [
        "推定の誤差の大きさ（RMSE）",
        `${fmt(summary.rmse)}${unit}`,
        "母平均との差を二乗して平均し、平方根を取る",
      ],
    ],
  )}<div class="sampling-reading-cards"><section><h3>母集団の平均を、標本から推定する</h3><p>目標は${people.length}件全体の平均${fmt(truth)}${unit}を知ることです。${state.n}件ずつ、同じ条件で${summary.count}回抽出しました。${summary.count < 2 ? "まだ1回だけなので、推定のぶれや中心の傾向は判断できません。100回繰り返して比較しましょう。" : `推定値の平均は${fmt(summary.center)}${unit}、反復による標準偏差は${fmt(summary.spread)}${unit}です。中心のずれと毎回のぶれを分けて読みます。`}</p></section><section><h3>集め方は、人数と同じくらい大切</h3><p>母集団での集団Bは${fmt((groupB / people.length) * 100, 1)}%、今回の標本では${fmt((frequent / state.n) * 100, 1)}%でした。${census ? "今回は全員を含むので、選ぶ順序に偏りがあっても平均は母平均に一致します。" : biased ? "集団Bを選びやすくする方法では、母集団と違う構成になりやすく、推定の中心もずれることがあります。回数を増やして偏りそのものを消すことはできません。" : "無作為抽出でも、1回だけの構成や平均は偶然ずれます。その1回のずれだけで、抽出方法に偏りがあると結論づけません。"}</p>${biased && !census ? '<button type="button" id="sampling-try-random">同じ標本数で無作為抽出を試す</button>' : ""}</section><section><h3>次の調査をどう設計するか</h3><p>${census ? "全数調査のため標本誤差は0です。ただし、回答の誤りや測定方法の問題までなくなるわけではありません。" : `重複なしの無作為抽出なら、標本数を${state.n}件から${n2}件にすると、理論上の標準誤差は${fmt(se)}${unit}から${fmt(nextSE)}${unit}になります。人数を増やす費用と、必要な精度を比べます。${biased ? "この計算は無作為抽出の場合の比較です。先に抽出方法を見直す必要があります。" : ""}`}</p>${!census ? `<button type="button" id="sampling-try-larger">${n2}件で新しい実験を始める</button>` : ""}</section><section><h3>区間の数字から言えること</h3><p>${coverageReading(state, summary, se)}</p><p>この教材では母平均を知っているので正解と照合できます。実際の調査では母平均は未知で、得られた1本の区間が母平均を捉えたかは通常わかりません。</p></section></div></section>`;
}

export default {
  id: "sampling",
  title: "標本調査と推定",
  description:
    "120人から誰を何人選ぶか。推定のぶれと、集め方による偏りを切り分けよう。",
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
    const groupNames = state.groupNames || [
      "図書室の利用が少ない層",
      "図書室の利用が多い層",
    ];
    const groupB = people.filter((p) => p.frequent).length,
      last = people.filter((p) => state.last.includes(p.id)),
      frequent = last.filter((p) => p.frequent).length;
    const latest = state.history.at(-1),
      se = finiteSE(values, state.n),
      summary = experimentSummary(state.history, truth),
      domain = samplingDomain(values, state.n),
      biased = state.method === "biased";
    root.innerHTML = `<div class="stat-grid"><section class="panel chart-panel"><h2>母集団から、今回の${state.n}件へ</h2><p class="muted">丸1つが1件。大きく濃い丸が今回の標本で、白い数字はその値です。</p>${(ctx.view || 0) === 0 ? populationChart(state) : ""}<p class="legend"><span>● A：${esc(groupNames[0])}（実線の輪） ${people.length - groupB}件</span><span>● B：${esc(groupNames[1])}（破線の輪） ${groupB}件</span><span>大きい濃色の丸・白い数字：今回の標本</span></p>${metrics(
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
          "標本に含まれる集団Bの割合",
          `${fmt((frequent / state.n) * 100, 1)}%`,
          `母集団では${fmt((groupB / people.length) * 100, 1)}%`,
        ],
      ],
    )}</section><aside class="panel controls"><h2>調査を設計する</h2>${range("sample-n", "標本数 n", state.n, 1, people.length, 1, "件")}${select(
      "sample-method",
      "抽出方法",
      [
        ["random", "単純無作為抽出（重複なし）"],
        ["biased", "集団Bを選びやすくする（偏った抽出）"],
      ],
      state.method,
    )}<p class="hint">${biased ? "集団Bを、1回の選択で7倍選びやすくします。同じデータは2度選びません。" : "残っているどのデータも、次に選ばれる確率が等しい抽出です。同じデータは2度選びません。"}</p>${number("sample-seed", "再現用の乱数の種", state.seed, 0, 4294967295, 1)}<div class="actions"><button id="sample-one" class="primary" ${state.trials >= 2000 ? "disabled" : ""}>1回抽出する</button><button id="sample-many" ${state.trials >= 2000 ? "disabled" : ""}>100回繰り返す</button><button id="sample-replay">同じ実験を再現</button></div><p class="muted">条件を変えると、新しい条件で1回目から開始します。種と条件が同じなら、抽出の順序も結果も再現できます。最大2000回。</p></aside></div>
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
          biased ? "SRSなら標準誤差" : "理論上の標準誤差",
          `${fmt(se)}${unit}`,
          "有限母集団の補正を含む",
        ],
      ],
    )}<p class="hint">横軸は区間の図と共通で、母平均を中央に固定しています。${biased ? "偏った抽出では、SRS用の標準誤差はこの実験のばらつきを表しません。推定の中心のずれにも注目します。" : "標準誤差は標本平均のぶれの大きさです。個々の値の標準偏差とは異なります。"}</p></section>
    <section class="panel chart-panel sampling-interval-panel"><h2>${biased ? "SRSの式を当てはめた帯" : "95%信頼区間"}を繰り返す</h2>${metrics(
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
    )}<div class="legend sampling-interval-legend"><span>実線・塗り丸：母平均を捉えた</span><span>破線・白丸：母平均を捉えなかった</span><span>橙の縦破線：母平均</span><span>新しい順。スクロールして過去の区間へ。</span></div>${ctx.view === 2 ? intervalChart(state, domain) : ""}<p class="annotation" data-coverage-reading>${coverageReading(state, summary, se)}</p><p class="hint">95%信頼区間とは、同じ方法で標本抽出と区間作成を繰り返したとき、約95%の区間が固定された母平均を捉えるという意味です。得られた1本の区間に母平均が入る確率を95%とする意味ではありません。</p><p class="hint">ここでは既知の母標準偏差を使い、標本平均 ± 1.96 × SRSの標準誤差で作る正規近似です。小標本では近似が粗くなる場合があります。${biased ? "偏った抽出への95%の保証はありません。" : "実際に母標準偏差が未知なら、推定方法や前提を別に確認します。"}</p></section>
    ${reflection(state, people, summary, se, frequent, groupB)}`;
    bind(root, "sample-n", (n) => ctx.replace(newExperiment({ ...state, n })));
    bind(root, "sample-method", (method) =>
      ctx.replace(newExperiment({ ...state, method })),
    );
    bind(root, "sample-seed", (seed) =>
      ctx.replace(newExperiment({ ...state, seed })),
    );
    root.querySelector("#sample-one").onclick = () =>
      ctx.replace(addTrials(state, 1));
    root.querySelector("#sample-many").onclick = () =>
      ctx.replace(addTrials(state, 100));
    root.querySelector("#sample-replay").onclick = () =>
      ctx.replace(addTrials(state, state.trials, true));
    root
      .querySelector("#sampling-try-random")
      ?.addEventListener("click", () =>
        ctx.replace(newExperiment({ ...state, method: "random" })),
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
  explanation: `<h2>偶然のぶれと、集め方の偏り</h2><p>調べたい120人全員が母集団で、実際に選んだ一部が標本です。単純無作為抽出では、同じ人数の組合せはすべて同じ確率で選ばれます。個々の標本平均は母平均からずれますが、繰り返した平均は母平均を中心に分布します。この1回ごとのずれが標本誤差です。</p><p>一方、図書室にいる人だけに声をかけると、読書時間の長い層を集めやすくなります。この偏りは、標本数を増やして偶然のぶれを小さくすることとは別の問題です。この有限母集団では全員を含めれば偏りもなくなりますが、一部の大きな標本だから公平だとはいえません。無回答や質問文による偏りも、実際の調査では確認が必要です。</p><h3>標準偏差と標準誤差</h3><p>母標準偏差は、生徒ごとの読書時間の散らばりです。標準誤差は、標本平均を繰り返し作ったときの散らばりです。重複なしの抽出では、母集団の多くを調べるほど不確実性が減るため、有限母集団の補正を入れます。重複を許す独立な抽出や、非常に大きな母集団からの抽出とは式が異なります。</p><h3>信頼区間の読み方</h3><p>ここでは母標準偏差が既知という学習用の設定で、標本平均 ± 1.96 × 標準誤差という正規近似を使います。条件が整った同じ手続きを何度も行うと、作られた区間の約95%が固定された母平均を含む、という意味です。有限回の割合が必ず95%になるわけではなく、小標本や偏った抽出ではこの近似を正当化できません。区間が狭いことと、調査が偏りなく正しいことを分けて考えましょう。</p>`,
  related: ["summary", "probability", "hypothesis-test"],
};
