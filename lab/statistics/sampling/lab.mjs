import { mean, sd, sum, histogram, fmt } from "../shared/math.mjs";
import {
  esc,
  range,
  number,
  select,
  metrics,
  table,
  svg,
  axes,
  bind,
} from "../shared/ui.mjs";
import {
  population,
  finiteSE,
  newExperiment,
  normalizeExperiment,
  addTrials,
} from "./model.mjs";

function populationChart(state) {
  const people = population(state.customPopulation);
  const selected = new Set(state.last);
  const circles = people
    .map((person, index) => {
      const x = 27 + (index % 20) * 35;
      const y = 28 + Math.floor(index / 20) * 34;
      return `<g><circle cx="${x}" cy="${y}" r="${selected.has(person.id) ? 12 : 9}" fill="${person.frequent ? "#bb731e" : "#247b77"}" opacity="${selected.has(person.id) ? 1 : 0.28}" stroke="${selected.has(person.id) ? "#142a36" : "none"}" stroke-width="2"><title>${person.id + 1}番：${person.value}${state.customPopulation ? "" : "分"}・集団${person.frequent ? "B" : "A"}${selected.has(person.id) ? "（今回の標本）" : ""}</title></circle>${selected.has(person.id) ? `<text x="${x}" y="${y + 3}" fill="white" font-size="9" text-anchor="middle" pointer-events="none">${person.value}</text>` : ""}</g>`;
    })
    .join("");
  return svg(
    circles,
    `${people.length}件の母集団。濃い丸が今回抽出した標本。数字は各人の値。`,
    720,
    Math.ceil(people.length / 20) * 34 + 14,
  );
}

function distributionChart(state) {
  const unit = state.customPopulation ? "" : "分";
  const truth = mean(population(state.customPopulation).map((p) => p.value));
  const estimates = state.history.map((result) => result.mean);
  const xmin = Math.floor(Math.min(truth, ...estimates) - 5);
  const xmax = Math.ceil(Math.max(truth, ...estimates) + 5);
  const width = Math.max(0.5, Math.ceil(((xmax - xmin) / 22) * 2) / 2);
  const bins = histogram(estimates, width, xmin);
  const ymax = Math.max(2, ...bins.map((bin) => bin.count)) * 1.18;
  const a = axes({
    xmin,
    xmax,
    ymin: 0,
    ymax,
    w: 720,
    h: 290,
    xlabel: state.customPopulation
      ? state.dataInfo?.columns?.[0] || "標本平均"
      : "標本平均（分）",
    ylabel: "回数",
  });
  const bars = bins
    .filter((bin) => bin.lo < xmax)
    .map(
      (bin) =>
        `<rect class="bar" x="${a.x(bin.lo) + 1}" y="${a.y(bin.count)}" width="${Math.max(1, a.x(Math.min(bin.hi, xmax)) - a.x(bin.lo) - 2)}" height="${a.y(0) - a.y(bin.count)}"><title>${fmt(bin.lo, 1)}以上${fmt(bin.hi, 1)}未満：${bin.count}回</title></rect>`,
    )
    .join("");
  const truthLine = `<line x1="${a.x(truth)}" x2="${a.x(truth)}" y1="${a.y(0)}" y2="${a.y(ymax)}" stroke="#bb731e" stroke-width="2" stroke-dasharray="6 4"/><text x="${a.x(truth) + 5}" y="${a.y(ymax) + 16}" fill="#985d16" font-size="12">母平均 ${fmt(truth)}${unit}</text>`;
  return svg(
    a.markup + bars + truthLine,
    `${state.trials}回の標本平均の分布。破線は母平均。`,
    720,
    290,
  );
}

function intervalChart(state) {
  const unit = state.customPopulation ? "" : "分";
  const truth = mean(population(state.customPopulation).map((p) => p.value));
  const shown = state.history.slice(-20);
  const xmin = Math.min(truth - 3, ...shown.map((result) => result.low)) - 2;
  const xmax = Math.max(truth + 3, ...shown.map((result) => result.high)) + 2;
  const a = axes({
    xmin,
    xmax,
    ymin: 0,
    ymax: shown.length + 1,
    w: 720,
    h: 290,
    xlabel: state.customPopulation ? "平均の推定範囲" : "平均の推定範囲（分）",
    ylabel: "直近の抽出",
  });
  const intervals = shown
    .map((result, index) => {
      const y = a.y(shown.length - index);
      const color = result.covers ? "#247b77" : "#b84b4b";
      return `<g><line x1="${a.x(result.low)}" x2="${a.x(result.high)}" y1="${y}" y2="${y}" stroke="${color}" stroke-width="3"/><circle cx="${a.x(result.mean)}" cy="${y}" r="3.5" fill="${color}"/><title>第${state.trials - shown.length + index + 1}回：${fmt(result.low)}〜${fmt(result.high)}${unit}・母平均を${result.covers ? "含む" : "含まない"}</title></g>`;
    })
    .join("");
  return svg(
    a.markup +
      `<line x1="${a.x(truth)}" x2="${a.x(truth)}" y1="${a.y(0)}" y2="${a.y(shown.length + 1)}" stroke="#bb731e" stroke-width="2" stroke-dasharray="5 4"/>` +
      intervals,
    "直近20回までの推定区間。赤い区間は固定された母平均を含まない。",
    720,
    290,
  );
}

export default {
  id: "sampling",
  title: "標本調査と推定",
  description:
    "120人から誰を何人選ぶか。推定のぶれと、集め方による偏りを切り分けよう。",
  lead: "架空の学校で、平日の読書時間を調べます。120人の母集団から一部を選び、平均を推定してみましょう。",
  initial: () => newExperiment(),
  render(root, ctx) {
    const state = normalizeExperiment(ctx.state);
    const people = population(state.customPopulation),
      values = people.map((p) => p.value),
      truth = mean(values);
    const unit = state.customPopulation ? "" : "分";
    const groupNames = state.groupNames || [
      "図書室の利用が少ない層",
      "図書室の利用が多い層",
    ];
    const groupB = people.filter((p) => p.frequent).length;
    const last = people.filter((person) => state.last.includes(person.id));
    const latest = state.history.at(-1);
    const frequent = last.filter((person) => person.frequent).length;
    const referenceSE = finiteSE(values, state.n);
    const coverage = state.history.filter((result) => result.covers).length;
    const observedSD =
      state.history.length > 1
        ? sd(
            state.history.map((result) => result.mean),
            true,
          )
        : NaN;
    const biased = state.method === "biased";
    root.innerHTML = `<div class="stat-grid"><section class="panel chart-panel"><h2>母集団から、今回の${state.n}件へ</h2>
      <p class="muted">丸1つが1件。濃い丸が今回の標本で、数字はその値です。</p>
      ${populationChart(state)}<p class="legend"><span style="color:#247b77">● ${esc(groupNames[0])} ${people.length - groupB}件</span>　<span style="color:#bb731e">● ${esc(groupNames[1])} ${groupB}件</span>　黒い輪：今回の標本</p>
      ${metrics([
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
          `母集団では${fmt((groupB / people.length) * 100, 1)}%（${groupB} / ${people.length}件）`,
        ],
      ])}
      </section><aside class="panel controls"><h2>調査を設計する</h2>
      ${range("sample-n", "標本数 n", state.n, 1, people.length, 1, "件")}
      ${select(
        "sample-method",
        "抽出方法",
        [
          ["random", "単純無作為抽出（重複なし）"],
          ["biased", "集団Bを選びやすくする（偏った抽出）"],
        ],
        state.method,
      )}
      <p class="hint">${biased ? "集団Bを、1回の選択で7倍選びやすくします。同じデータは2度選びません。" : "残っているどのデータも、次に選ばれる確率が等しい抽出です。同じデータは2度選びません。"}</p>
      ${number("sample-seed", "再現用の乱数の種", state.seed, 0, 4294967295, 1)}
      <div class="actions"><button id="sample-one" class="primary" ${state.trials >= 2000 ? "disabled" : ""}>1回抽出する</button><button id="sample-many" ${state.trials >= 2000 ? "disabled" : ""}>100回繰り返す</button><button id="sample-replay">同じ実験を再現</button></div>
      <p class="muted">条件を変えると、新しい条件で1回目から開始します。種と条件が同じなら、抽出の順序も結果も再現できます。最大2000回。</p>
      <p class="annotation">${state.n === people.length ? "全数調査です。抽出順序が変わっても、平均は必ず母平均に一致します。" : biased ? "人数を増やすだけでは、集め方の偏りは保証なく解消しません。無作為抽出に切り替えて、分布の中心を比較してみましょう。" : "1回の標本誤差は偶然変わります。繰り返して、推定値の分布と中心を調べましょう。"}</p>
      </aside></div>
      <section class="panel chart-panel"><h2>${state.trials}回の推定を重ねる</h2>${distributionChart(state)}
      ${metrics([
        [
          "推定値の平均",
          `${fmt(mean(state.history.map((result) => result.mean)))}${unit}`,
          `母平均との差 ${fmt(mean(state.history.map((result) => result.mean)) - truth)}${unit}`,
        ],
        [
          "推定値の標準偏差",
          Number.isFinite(observedSD)
            ? `${fmt(observedSD)}${unit}`
            : "2回以上で表示",
          "反復結果から計算・分母は回数−1",
        ],
        [
          biased ? "SRSなら標準誤差" : "理論上の標準誤差",
          `${fmt(referenceSE)}${unit}`,
          "有限母集団の補正を含む",
        ],
      ])}
      <p class="hint">${biased ? "偏った抽出では、単純無作為抽出（SRS）用の標準誤差はこの実験のばらつきを表しません。母平均からのずれにも注目してください。" : "標準誤差は標本平均のぶれの大きさです。標本の中の個々の読書時間の標準偏差とは異なります。"}</p></section>
      <details class="panel"><summary>発展：95%区間を繰り返し作る</summary><p>${biased ? "以下はSRS用の幅を機械的に当てはめた「便宜的な帯」です。偏った抽出の95%信頼区間とは解釈できません。" : "既知の母標準偏差を使った正規近似の95%信頼区間です。未知の母平均が動くのではなく、標本ごとに区間が動きます。"}</p>
      ${intervalChart(state)}${metrics([
        [
          biased ? "母平均を含んだ帯" : "母平均を含んだ区間",
          `${coverage} / ${state.trials}回`,
          `${fmt((coverage / state.trials) * 100, 1)}%（近似・有限回なので95%に一致するとは限らない）`,
        ],
        [
          "区間の半幅",
          `${fmt(1.96 * referenceSE)}${unit}`,
          "1.96 × SRSの標準誤差",
        ],
      ])}
      <p class="hint">標本数が小さいと正規近似が粗くなります。この母集団は全員の値が見えるため母標準偏差も既知ですが、実際の調査では通常未知です。標本から推定する場合は、別の区間推定法と条件の確認が必要です。</p></details>
      <details class="panel"><summary>今回の標本と計算過程</summary>
      <p>標本平均 = 数値の合計 ${sum(last.map((person) => person.value))} ÷ ${state.n} = ${fmt(latest.mean)}${unit}。</p>
      <p>母標準偏差 σ = ${fmt(sd(values))}${unit}（分散の分母は N = ${people.length}）。単純無作為抽出・重複なしの場合、標準誤差は <strong>σ / √n × √((N − n) / (N − 1))</strong> = ${fmt(referenceSE)}${unit}。n = N なら0です。</p>
      ${table(
        ["番号", "集団", state.dataInfo?.columns?.[0] || "読書時間（分）"],
        last.map((person) => [
          person.id + 1,
          groupNames[person.frequent ? 1 : 0],
          person.value,
        ]),
      )}</details>`;
    bind(root, "sample-n", (value) =>
      ctx.replace(newExperiment({ ...state, n: value })),
    );
    bind(root, "sample-method", (value) =>
      ctx.replace(newExperiment({ ...state, method: value })),
    );
    bind(root, "sample-seed", (value) =>
      ctx.replace(newExperiment({ ...state, seed: value })),
    );
    root.querySelector("#sample-one").onclick = () =>
      ctx.replace(addTrials(state, 1));
    root.querySelector("#sample-many").onclick = () =>
      ctx.replace(addTrials(state, 100));
    root.querySelector("#sample-replay").onclick = () =>
      ctx.replace(addTrials(state, state.trials, true));
  },
  explanation: `<h2>偶然のぶれと、集め方の偏り</h2><p>調べたい120人全員が母集団で、実際に選んだ一部が標本です。単純無作為抽出では、同じ人数の組合せはすべて同じ確率で選ばれます。個々の標本平均は母平均からずれますが、繰り返した平均は母平均を中心に分布します。この1回ごとのずれが標本誤差です。</p><p>一方、図書室にいる人だけに声をかけると、読書時間の長い層を集めやすくなります。この偏りは、標本数を増やして偶然のぶれを小さくすることとは別の問題です。この有限母集団では全員を含めれば偏りもなくなりますが、一部の大きな標本だから公平だとはいえません。無回答や質問文による偏りも、実際の調査では確認が必要です。</p><h3>標準偏差と標準誤差</h3><p>母標準偏差は、生徒ごとの読書時間の散らばりです。標準誤差は、標本平均を繰り返し作ったときの散らばりです。重複なしの抽出では、母集団の多くを調べるほど不確実性が減るため、有限母集団の補正を入れます。重複を許す独立な抽出や、非常に大きな母集団からの抽出とは式が異なります。</p><h3>信頼区間の読み方</h3><p>ここでは母標準偏差が既知という学習用の設定で、標本平均 ± 1.96 × 標準誤差という正規近似を使います。条件が整った同じ手続きを何度も行うと、作られた区間の約95%が固定された母平均を含む、という意味です。有限回の割合が必ず95%になるわけではなく、小標本や偏った抽出ではこの近似を正当化できません。区間が狭いことと、調査が偏りなく正しいことを分けて考えましょう。</p>`,
  related: ["summary", "probability", "hypothesis-test"],
};
