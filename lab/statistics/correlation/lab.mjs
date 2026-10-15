import { regression, mean, fmt, clamp } from "../shared/math.mjs";
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
  drag,
} from "../shared/ui.mjs";
import { readDataset } from "../shared/data.mjs";

const basePoints = () =>
  [
    [15, 40],
    [25, 48],
    [32, 44],
    [40, 59],
    [48, 54],
    [55, 66],
    [65, 62],
    [72, 76],
    [80, 73],
    [90, 86],
    [98, 81],
    [108, 94],
  ].map(([x, y], i) => ({ id: `p${i + 1}`, x, y }));

function baseState() {
  return {
    points: basePoints(),
    selectedId: "p12",
    mode: "move",
    manual: false,
    manualSlope: 0.35,
    manualIntercept: 35,
    showResiduals: true,
    showSquares: false,
    excludeSelected: false,
    predictionX: 75,
    xMin: 0,
    yMin: 0,
    xMax: 120,
    yMax: 110,
    xLabel: "1週間の復習時間（分）",
    yLabel: "確認テスト（点）",
    source: "架空の12人の学習記録",
  };
}

function initial() {
  const state = baseState();
  if (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("dataset") === "project"
  ) {
    const data = readDataset();
    if (data.rows.length) {
      state.points = data.rows.map((p, i) => ({
        id: String(p.id ?? `project${i}`),
        x: Number(p.x),
        y: Number(p.y),
        group: p.group,
      }));
      state.selectedId = state.points.at(-1).id;
      state.xLabel = data.xLabel;
      state.yLabel = data.yLabel;
      state.source = data.name;
      state.xMin = Math.min(
        0,
        Math.floor((Math.min(...state.points.map((p) => p.x)) * 1.15) / 10) *
          10,
      );
      state.yMin = Math.min(
        0,
        Math.floor((Math.min(...state.points.map((p) => p.y)) * 1.15) / 10) *
          10,
      );
      state.xMax = Math.max(
        10,
        Math.ceil((Math.max(...state.points.map((p) => p.x)) * 1.15) / 10) * 10,
      );
      state.yMax = Math.max(
        10,
        Math.ceil((Math.max(...state.points.map((p) => p.y)) * 1.15) / 10) * 10,
      );
      state.predictionX = mean(state.points.map((p) => p.x));
    }
  }
  return state;
}

/** The inspected observation is kept out of fitting when testing a prediction. */
export function trainingPoints(state) {
  return state.points.filter(
    (p) => !state.excludeSelected || p.id !== state.selectedId,
  );
}

export function residualSummary(points, slope, intercept) {
  const residuals = points.map((p) => ({
    ...p,
    predicted: slope * p.x + intercept,
    residual: p.y - (slope * p.x + intercept),
  }));
  const sse = residuals.reduce((total, p) => total + p.residual ** 2, 0);
  return {
    residuals,
    sse,
    rmse: points.length ? Math.sqrt(sse / points.length) : NaN,
  };
}

function validFit(fit) {
  return Number.isFinite(fit.slope) && Number.isFinite(fit.intercept);
}
function equation(a, b) {
  return `ŷ = ${fmt(a, 3)}x ${b < 0 ? "−" : "+"} ${fmt(Math.abs(b), 2)}`;
}

function render(root, ctx) {
  const s = ctx.state;
  const points = s.points;
  const selected = points.find((p) => p.id === s.selectedId) || points[0];
  const train = trainingPoints(s);
  const fit = regression(train);
  const fitOK = validFit(fit);
  const slope = s.manual ? Number(s.manualSlope) : fit.slope;
  const intercept = s.manual ? Number(s.manualIntercept) : fit.intercept;
  const lineOK = Number.isFinite(slope) && Number.isFinite(intercept);
  const residuals = lineOK
    ? residualSummary(train, slope, intercept)
    : { residuals: [], sse: NaN, rmse: NaN };
  const xSpan = s.xMax - s.xMin,
    ySpan = s.yMax - s.yMin;
  const a = axes({
    xmin: s.xMin,
    xmax: s.xMax,
    ymin: s.yMin,
    ymax: s.yMax,
    w: 720,
    h: 420,
    xlabel: s.xLabel,
    ylabel: s.yLabel,
  });
  let drawing = a.markup
    .replace(/>(-?[\d,]+)\.0<\/text>/g, ">$1</text>")
    .replace('y="16"', 'y="23"');
  if (lineOK) {
    // Clip the regression to the coordinate area, including residual squares.
    const top = Math.min(a.y(s.yMin), a.y(s.yMax)),
      left = a.x(s.xMin);
    drawing += `<defs><clipPath id="corr-clip"><rect x="${left}" y="${top}" width="${a.x(s.xMax) - left}" height="${Math.abs(a.y(s.yMin) - a.y(s.yMax))}"/></clipPath></defs><g clip-path="url(#corr-clip)">`;
    if (s.showResiduals)
      residuals.residuals.forEach((p) => {
        const py = a.y(p.predicted),
          yy = a.y(p.y),
          px = a.x(p.x),
          size = Math.abs(yy - py);
        if (s.showSquares)
          drawing += `<rect x="${px}" y="${Math.min(py, yy)}" width="${size}" height="${size}" fill="#d9873218" stroke="#d9873266"><title>残差 ${fmt(p.residual)}、残差の二乗 ${fmt(p.residual ** 2)}。面積は残差の二乗に比例</title></rect>`;
        drawing += `<line x1="${px}" x2="${px}" y1="${yy}" y2="${py}" stroke="#cc7435" stroke-width="2" stroke-dasharray="4 3"/>`;
      });
    drawing += `<line class="series" x1="${a.x(s.xMin)}" y1="${a.y(slope * s.xMin + intercept)}" x2="${a.x(s.xMax)}" y2="${a.y(slope * s.xMax + intercept)}" stroke-width="3"/>`;
    if (s.manual && fitOK)
      drawing += `<line x1="${a.x(s.xMin)}" y1="${a.y(fit.slope * s.xMin + fit.intercept)}" x2="${a.x(s.xMax)}" y2="${a.y(fit.slope * s.xMax + fit.intercept)}" stroke="#819090" stroke-width="2" stroke-dasharray="6 5"/>`;
    const predicted = slope * s.predictionX + intercept;
    drawing += `<line x1="${a.x(s.predictionX)}" x2="${a.x(s.predictionX)}" y1="${a.y(s.yMin)}" y2="${a.y(predicted)}" stroke="#815dab" stroke-dasharray="5 3"/><circle cx="${a.x(s.predictionX)}" cy="${a.y(predicted)}" r="6" fill="#815dab"><title>予測 ${fmt(predicted)}</title></circle></g>`;
  }
  points.forEach((p, i) => {
    const chosen = p.id === selected?.id;
    const held = s.excludeSelected && chosen;
    drawing += `<circle class="point" data-id="${esc(p.id)}" cx="${a.x(p.x)}" cy="${a.y(p.y)}" r="${chosen ? 9 : 7}" style="fill:${held ? "#fff" : chosen ? "#d98732" : "#207d79"};stroke:${chosen ? "#9d4c15" : "#fff"};stroke-width:${chosen ? 3 : 2};${s.mode === "add" ? "pointer-events:none" : ""}" tabindex="${s.mode === "add" ? -1 : 0}" role="button" aria-label="データ${i + 1}、${esc(s.xLabel)} ${fmt(p.x)}、${esc(s.yLabel)} ${fmt(p.y)}。選択して数値でも編集可能"><title>データ${i + 1}: (${fmt(p.x)}, ${fmt(p.y)})${held ? "・予測検証用" : ""}</title></circle>`;
  });
  const forecast = lineOK ? slope * s.predictionX + intercept : NaN;
  const heldPred = selected && lineOK ? slope * selected.x + intercept : NaN;
  const extrapolation =
    train.length &&
    (s.predictionX < Math.min(...train.map((p) => p.x)) ||
      s.predictionX > Math.max(...train.map((p) => p.x)));
  const message = !fitOK
    ? "x がすべて同じ、または点が足りないため、回帰直線を一意に求められません。x の異なる点を2つ以上置いてください。"
    : !Number.isFinite(fit.r)
      ? "y の値がすべて同じため、相関係数は定義できません。傾き0の回帰直線は求められます。"
      : `点は ${points.length} 個。${s.manual ? "実線は手動の直線、灰色の破線は最小二乗直線です。" : "実線は残差平方和を最小にする回帰直線です。"}`;
  root.innerHTML = `
    ${metrics([
      [
        "相関係数 r",
        Number.isFinite(fit.r) ? fmt(fit.r, 3) : "定義できない",
        "直線的な関係の強さ",
      ],
      [
        "使用中の直線の残差平方和",
        lineOK ? fmt(residuals.sse, 1) : "—",
        "縦方向の誤差を二乗して合計",
      ],
      [
        "最小の残差平方和",
        fitOK ? fmt(fit.sse, 1) : "—",
        `学習用 ${train.length} 点`,
      ],
      [
        "学習データのRMSE",
        lineOK ? fmt(residuals.rmse, 2) : "—",
        "誤差の典型的な大きさ・得点の単位",
      ],
    ])}
    <div class="stat-grid"><section class="panel chart-panel"><h2>点を動かして、関係を変える</h2><p class="muted">${esc(s.source)}。点をドラッグ／タップして選択できます。${s.mode === "add" ? "図の空いている場所を押すと点を追加します。" : s.mode === "delete" ? "点を押すと削除します。" : "数値での編集もできます。"}</p>
      ${svg(drawing, "直接編集できる散布図と回帰直線", 720, 420).replace("<svg", '<svg id="corr-chart" style="touch-action:none"')}
      <p class="hint" role="status">${esc(message)}</p><p class="legend">● 青緑：学習用　● 橙：選択中　◯ 橙：検証用　● 紫：指定したxの予測</p>
    </section><section class="panel controls"><h2>実験の操作</h2>
      ${select(
        "point-mode",
        "図の操作",
        [
          ["move", "点を選択・移動"],
          ["add", "空白に点を追加"],
          ["delete", "押した点を削除"],
        ],
        s.mode,
      )}
      ${select(
        "point-choice",
        "選択するデータ",
        points.map((p, i) => [
          p.id,
          `データ${i + 1} (${fmt(p.x, 1)}, ${fmt(p.y, 1)})`,
        ]),
        selected?.id || "",
      )}
      ${selected ? number("point-x", s.xLabel, selected.x, s.xMin, s.xMax, 0.5) + number("point-y", s.yLabel, selected.y, s.yMin, s.yMax, 0.5) : ""}
      <div class="actions"><button id="corr-outlier" type="button" ${!selected ? "disabled" : ""}>選択点を右下の外れ値へ</button><button id="corr-delete" type="button" ${points.length <= 2 ? "disabled" : ""}>選択点を削除</button></div>
      <label><input type="checkbox" id="corr-manual" ${s.manual ? "checked" : ""}> 直線を手で調整する</label>
      ${s.manual ? range("line-slope", "傾き", s.manualSlope, (-2 * ySpan) / xSpan, (2 * ySpan) / xSpan, 0.01) + range("line-intercept", "切片", s.manualIntercept, s.yMin - ySpan / 2, s.yMax + ySpan / 2, 0.5) + '<button id="corr-best" type="button">最小二乗直線と重ねる</button>' : ""}
      <label><input type="checkbox" id="corr-residuals" ${s.showResiduals ? "checked" : ""}> 残差を縦線で表示</label>
      <label><input type="checkbox" id="corr-squares" ${s.showSquares ? "checked" : ""}> 残差の二乗を正方形で表示</label>
      <p class="annotation">${lineOK ? esc(equation(slope, intercept)) : "回帰直線は計算できません"}</p>
    </section></div>
    <div class="stat-grid"><section class="panel controls"><h2>予測を、実測で確かめる</h2>
      ${range("prediction-x", `予測したい ${s.xLabel}`, s.predictionX, s.xMin, s.xMax, 0.5)}
      <p class="annotation">予測値：<strong>${Number.isFinite(forecast) ? fmt(forecast, 2) : "—"}</strong> ${esc(s.yLabel)}${extrapolation ? "　⚠ 学習したxの範囲外（外挿）です。" : ""}</p>
      <label><input type="checkbox" id="corr-holdout" ${s.excludeSelected ? "checked" : ""}> 選択中の1点を学習から外し、未知のデータとして検証する</label>
      ${selected ? `<p>選択点の実測値 <strong>${fmt(selected.y)}</strong> ／ 直線の予測 <strong>${Number.isFinite(heldPred) ? fmt(heldPred) : "—"}</strong> ／ 実測−予測 <strong>${Number.isFinite(heldPred) ? fmt(selected.y - heldPred) : "—"}</strong></p>` : ""}
      <p class="hint">${s.excludeSelected ? "選択点を変えると、学習に使う点と直線も変わります。複数の点を順に検証して、予測のずれを比較しましょう。" : "同じデータで直線を作り精度を測ると、予測をよく見積もりがちです。チェックを入れて確かめましょう。"} 学習用RMSEは将来の誤差を保証しません。</p>
    </section><section class="panel"><h2>計算を見てみる</h2><details><summary>実測値・予測値・残差の一覧</summary>
      ${table(
        ["データ", "x", "実測 y", "予測 ŷ", "残差 y−ŷ", "残差²"],
        residuals.residuals.map((p) => [
          points.findIndex((q) => q.id === p.id) + 1,
          fmt(p.x),
          fmt(p.y),
          fmt(p.predicted),
          fmt(p.residual),
          fmt(p.residual ** 2),
        ]),
      )}
      <p>残差平方和 SSE = Σ(yᵢ − ŷᵢ)² = ${fmt(residuals.sse)}。RMSE = √(SSE ÷ ${train.length})。正方形の面積は残差²に比例します。図の縦横の単位は異なるので、点から直線への最短距離を測っているわけではありません。</p></details>
      <p>r が同じでも、点の並び方や外れ値の影響は異なります。相関係数を見る前に、散布図の形を確かめてください。</p>
    </section></div>`;

  const updateSelected = (patch) => {
    if (selected)
      ctx.update({
        points: points.map((p) =>
          p.id === selected.id ? { ...p, ...patch } : p,
        ),
      });
  };
  bind(root, "point-mode", (mode) => ctx.update({ mode }), "change");
  bind(
    root,
    "point-choice",
    (selectedId) => ctx.update({ selectedId }),
    "change",
  );
  bind(root, "point-x", (x) => updateSelected({ x: clamp(x, s.xMin, s.xMax) }));
  bind(root, "point-y", (y) => updateSelected({ y: clamp(y, s.yMin, s.yMax) }));
  bind(root, "line-slope", (manualSlope) => ctx.update({ manualSlope }));
  bind(root, "line-intercept", (manualIntercept) =>
    ctx.update({ manualIntercept }),
  );
  bind(root, "prediction-x", (predictionX) => ctx.update({ predictionX }));
  for (const [id, key] of [
    ["corr-manual", "manual"],
    ["corr-residuals", "showResiduals"],
    ["corr-squares", "showSquares"],
    ["corr-holdout", "excludeSelected"],
  ])
    root
      .querySelector(`#${id}`)
      .addEventListener("change", (e) =>
        ctx.update({ [key]: e.target.checked }),
      );
  root.querySelector("#corr-best")?.addEventListener("click", () => {
    if (fitOK)
      ctx.update({ manualSlope: fit.slope, manualIntercept: fit.intercept });
  });
  root
    .querySelector("#corr-outlier")
    .addEventListener("click", () =>
      updateSelected({ x: s.xMin + xSpan * 0.94, y: s.yMin + ySpan * 0.12 }),
    );
  const remove = (id) => {
    if (points.length > 2)
      ctx.update({
        points: points.filter((p) => p.id !== id),
        selectedId: points.find((p) => p.id !== id)?.id,
      });
  };
  root
    .querySelector("#corr-delete")
    .addEventListener("click", () => remove(selected?.id));
  const addOption = root.querySelector('#point-mode option[value="add"]');
  if (addOption) {
    addOption.disabled = points.length >= 300;
    if (points.length >= 300) addOption.textContent = "追加は300点までです";
  }
  const chart = root.querySelector("#corr-chart");
  chart.querySelectorAll("[data-id]").forEach((el) => {
    el.addEventListener("click", () =>
      s.mode === "delete"
        ? remove(el.dataset.id)
        : ctx.update({ selectedId: el.dataset.id }),
    );
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        ctx.update({ selectedId: el.dataset.id });
      }
    });
  });
  drag(chart, "[data-id]", (target, sx, sy) => {
    if (s.mode !== "move") return;
    const id = target.dataset.id;
    ctx.update({
      selectedId: id,
      points: points.map((p) =>
        p.id === id
          ? {
              ...p,
              x: Math.round(clamp(a.ix(sx), s.xMin, s.xMax) * 2) / 2,
              y: Math.round(clamp(a.iy(sy), s.yMin, s.yMax) * 2) / 2,
            }
          : p,
      ),
    });
  });
  chart.addEventListener("click", (e) => {
    if (
      s.mode !== "add" ||
      points.length >= 300 ||
      e.target.closest("[data-id]")
    )
      return;
    const pos = chart.createSVGPoint();
    pos.x = e.clientX;
    pos.y = e.clientY;
    const local = pos.matrixTransform(chart.getScreenCTM().inverse());
    const x = a.ix(local.x / Number(chart.dataset.scaleX || 1)),
      y = a.iy(local.y / Number(chart.dataset.scaleY || 1));
    if (x < s.xMin || x > s.xMax || y < s.yMin || y > s.yMax) return;
    const id = `new-${Date.now()}-${points.length}`;
    ctx.update({
      points: [
        ...points,
        { id, x: Math.round(x * 2) / 2, y: Math.round(y * 2) / 2 },
      ],
      selectedId: id,
    });
  });
}

export default {
  id: "correlation",
  title: "散布図と相関・回帰",
  description: "点を動かし、関係の強さ・外れ値・予測の限界を調べる。",
  lead: "復習時間が長い人ほど得点は高い？ まず点を1つ動かしてみましょう。相関の強さと予測の確かさは、同じ意味ではありません。",
  initial,
  render,
  missions: [
    {
      title: "1点で結論は変わる？",
      body: "まず元の相関係数と直線を比較用に保存。右端の点を選び「右下の外れ値へ」を試そう。その点を削除した結果とも比べ、全体の傾向が1人にどれだけ左右されるか説明しよう。",
      preset: baseState(),
    },
    {
      title: "いちばんよい直線を探す",
      body: "直線を手で調整し、残差の正方形を表示。大きな正方形を減らすと、ほかの正方形はどうなる？ 傾き・切片を動かし、SSEを下げてから「最小二乗直線と重ねる」で確かめよう。小さなずれを多数残す場合と大きなずれを1つ残す場合を比べよう。",
      preset: { ...baseState(), manual: true, showSquares: true },
    },
    {
      title: "まだ見ていない人を予測する",
      body: "右端の1人を学習から外す前に得点を予想。検証に切り替えて予測と実測を比べよう。中央の人でも試し、予測するxを学習範囲の外へ移した場合も調べよう。復習時間を増やせば必ずこの直線どおりに得点が伸びると言えるだろうか。",
      preset: { ...baseState(), excludeSelected: true, predictionX: 118 },
    },
  ],
  explanation: `<h2>相関と回帰で、何がわかる？</h2><p>散布図は2つの量の組を1点で表します。右上がりなら正の相関、右下がりなら負の相関。相関係数 r は −1〜1で、直線的な関係を測ります。r ≈ 0でも曲線の関係があることがあり、因果関係がないことを意味しません。</p><h3>残差を二乗する理由</h3><p>回帰直線 ŷ = ax + b の残差は y − ŷ。正負の残差を足すだけでは打ち消し合います。最小二乗法は二乗の合計を最小にします。傾き a = Σ(x−x̄)(y−ȳ) / Σ(x−x̄)²、切片 b = ȳ − ax̄ です。二乗は大きな誤差を強く重視するため、外れ値、とくにxの端にある点が直線を大きく動かす場合があります。</p><h3>予測と限界</h3><p>回帰は集団としての傾向です。同じ復習時間でも得点が違い、既習知識や睡眠など、この図にない要因もあります。学習に使わなかった点で誤差を確かめることが大切です。1点だけの検証で性能を判断せず、複数の点・別の時期でも比較しましょう。学習した範囲外への外挿や、得点の上限を超える予測には特に注意します。</p><h3>相関があっても、原因とは限らない</h3><p>「復習時間が長い人ほど高得点」は、「時間を増やしたから得点が上がった」という証明ではありません。学習意欲が両方に影響する、苦手な人が長く復習する、といった別の説明があります。原因を調べるには条件をそろえた比較や無作為化などが必要です。この教材は独自に作った架空データで、効果を主張する調査結果ではありません。</p><p>点が2つ未満、またはxがすべて同じなら傾きは定まりません。xかyの標準偏差が0ならrは未定義です。この教材のRMSEは記述用の √(SSE/n) で、回帰誤差の標準偏差の推定に使う √(SSE/(n−2)) とは区別します。</p>`,
  related: ["histogram", "summary", "projects", "hypothesis-test"],
};
