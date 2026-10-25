import { mean, median, sd, sum, regression, gini, fmt } from "./math.mjs";
import { currentData } from "./data-model.mjs?v=20261025-clear-test";
import {
  population,
  samplingSE,
} from "../sampling/model.mjs?v=20261025-clear-test";
import {
  matrixFor,
  successRate,
} from "../crosstab/lab.mjs?v=20261025-clear-test";
import { autocorrelations } from "../time-series/model.mjs?v=20261025-clear-test";
import { observationValues, normalInterval } from "../probability/model.mjs";
export function insight(id, state) {
  const data = currentData(id, state),
    before = state.dataInfo?.baseline;
  if (id === "correlation") {
    const train = state.points.filter(
      (p) => !state.excludeSelected || p.id !== state.selectedId,
    );
    if (train.length < 2)
      return "検証用の点を外した後も、学習用にxの異なる2組以上が必要です。元データを3組以上にして確かめましょう。";
    const r = regression(train),
      prior = before ? regression(before.map(([x, y]) => ({ x, y }))) : r;
    if (!Number.isFinite(r.r))
      return "値がすべて同じ列があるため、相関係数は定義できません。点を動かして、散らばりを作ってみましょう。";
    const change = state.excludeSelected
      ? `学習用 ${train.length}組の r=${fmt(r.r, 3)}。`
      : Number.isFinite(prior.r)
        ? `読み込み直後の r=${fmt(prior.r, 3)} → 現在 ${fmt(r.r, 3)}。`
        : `現在の r=${fmt(r.r, 3)}。`;
    return (
      change +
      (state.excludeSelected
        ? "選んだ点は直線の計算に含めず、予測を確かめるために使っています。"
        : Math.abs(r.r) < 0.3
          ? "直線的な関係は弱めです。曲線の関係や、集団の混在がないかも散布図で確かめましょう。"
          : "係数だけでなく、点の広がりと外れた1点にも注目。点を動かすと、直線も一緒に変わります。")
    );
  }
  if (id === "summary") {
    const values = state.points.map((p) => p.value),
      center = mean(values),
      spread = sd(values, state.sample);
    if (
      before &&
      Math.abs(center - mean(before.map((r) => r[0]))) < 1e-7 &&
      data.edits
    )
      return `平均は ${fmt(center)} のまま、標準偏差は ${fmt(
        sd(
          before.map((r) => r[0]),
          state.sample,
        ),
      )} → ${fmt(spread)}。平均だけでは、点の広がりの違いは伝わりません。`;
    return `平均 ${fmt(center)}・中央値 ${fmt(median(values))}・標準偏差 ${fmt(spread)}。端の点を動かすと、平均と中央値の反応の違いが見えてきます。`;
  }
  if (id === "histogram")
    return `元のデータは ${data.rows.length}件。${state.shiftB ? `集団Bを ${fmt(state.shiftB, 1)} 移動しています。` : "階級幅や開始位置だけを変えても、元の値は変わりません。"}棒の山の数や位置は、区切り方によっても変わります。`;
  if (id === "sampling") {
    const values = population(state.customPopulation).map((p) => p.value),
      truth = mean(values),
      estimates = state.history.map((r) => r.mean);
    return `${state.trials}組の標本平均の中心は ${fmt(mean(estimates))}、母平均は ${fmt(truth)}。${state.method === "without" && state.n === values.length ? "重複なしで全員を1回ずつ選ぶ全数調査なので、毎回母平均に一致します。" : `抽出方法は${state.method === "with" ? "重複あり" : "重複なし"}、理論上の標準誤差は ${fmt(samplingSE(values, state.n, state.method))}です。同じ標本数で2つの方法を比べてみましょう。`}`;
  }
  if (id === "crosstab") {
    const names = state.dataInfo?.labels?.methods || ["A", "B"];
    const overall = [0, 1].map((i) =>
      successRate(matrixFor(state.strata, "all"), i),
    );
    const within = state.strata.map((_, i) =>
      [0, 1].map((j) => successRate(matrixFor(state.strata, String(i)), j)),
    );
    const winner = [0, 1].find((i) =>
      within.every(
        (r) => r[i] !== null && r[1 - i] !== null && r[i] > r[1 - i],
      ),
    );
    return winner !== undefined && overall[winner] < overall[1 - winner]
      ? `合計では${names[1 - winner]}の率が高いのに、区分別では${names[winner]}の率が高くなります。区分ごとの人数の偏りに注目しましょう。`
      : "合計の率は、区分ごとの率と人数の内訳で決まります。区分をそろえた比較も確かめましょう。";
  }
  if (id === "time-series") {
    const values = data.rows.map((r) => r[1]),
      acf = autocorrelations(values);
    return `${state.period}か月の中心移動平均で、前後の月の変動をならします。12か月ずらした自己相関は ${acf[12] === null ? "計算できません" : fmt(acf[12], 2)}。季節調整後の動きと、比較する月を確かめましょう。`;
  }
  if (id === "probability") {
    const values = observationValues(state);
    if (state.mode === "normal") {
      const observed = values.filter(
        (v) => v >= state.low && v <= state.high,
      ).length;
      return `区間内は ${observed}/${values.length}件（${fmt((observed / values.length) * 100, 1)}%）。正規分布モデルの面積は ${fmt(normalInterval(state.mu, state.sigma, state.low, state.high).probability * 100, 1)}%。実際の割合と理論の確率を区別して読みます。`;
    }
    return state.mode === "coin"
      ? `${values.length}回のうち表は ${sum(values)}回。割合は揺れながら変わります。独立な試行のモデルでは、これまでの表・裏の並びが次の1回の確率を変えるわけではありません。`
      : `${values.length}セットの平均成功回数は ${fmt(mean(values))}、理論平均は ${fmt(state.n * state.p)}。反復数を増やす操作と、1セットの回数を変える操作は、別のものを変えています。`;
  }
  if (id === "hypothesis-test") {
    const average = mean(state.participants.map(p => p.correct / p.trials));
    return `${state.participants.length}人の平均正答率は${fmt(average * 100, 2)}%。1人を1つの標本として、基準${fmt((state.reference ?? .5)*100,2)}%との差を調べます。p値とともに差の方向と大きさを読み、見分ける精度として十分かを考えます。`;
  }
  if (id === "lorenz") {
    const total = sum(state.incomes),
      coeff = gini(state.incomes);
    return total
      ? `総額 ${fmt(total)}、ジニ係数 ${fmt(coeff, 3)}。${state.locked ? "総額を固定して動かすと、変わるのは分け方です。" : "全員を同じ正の倍率で増やしても、所得の割合とジニ係数は変わりません。"}全員に等分した場合や、1人に集中した場合も試せます。`
      : "総額が0なので、所得比率とジニ係数は定義できません。1人の所得を増やして、曲線が描かれる条件を確かめましょう。";
  }
  return "";
}
