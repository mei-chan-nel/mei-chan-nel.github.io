import {
  monthlyTemperatures,
  dailyTemperatures,
  admissions,
  incomeQuintiles,
} from "./public-data.mjs?v=20261024-ts-axis";
import { householdSeries } from "../time-series/data.mjs?v=20261024-ts-axis";
import { publicDatasetInfo } from "./sources.mjs?v=20261024-ts-axis";
import { applyData, currentData } from "./data-model.mjs?v=20261024-ts-axis";
export function freshSeed() {
  const bytes = new Uint32Array(1);
  globalThis.crypto.getRandomValues(bytes);
  return bytes[0];
}
// Published observations stay fixed; seeds change only the simulated draws.
export function sampleState(id, initial, seed = freshSeed()) {
  const base = { ...initial, dataInfo: null };
  let headers,
    rows,
    name,
    selection = {};
  if (id === "correlation") {
    headers = ["東京の月平均気温（℃）", "全国の月別支出金額（円）"];
    rows = householdSeries.values.map((v, i) => [monthlyTemperatures[i], v]);
    name = "月平均気温とアイスクリームへの支出（2016〜2025年）";
  } else if (id === "summary") {
    headers = ["東京の日最高気温（℃）"];
    rows = dailyTemperatures[1].map((v) => [v]);
    name = "東京の日最高気温（2025年7月）";
  } else if (id === "histogram") {
    headers = ["東京の日最高気温（℃）", "観測月"];
    rows = dailyTemperatures.flatMap((values, i) =>
      values.map((v) => [v, `2025年${i + 6}月`]),
    );
    selection = { group: 1 };
    name = "東京の日最高気温（2025年6月・7月）";
  } else if (id === "sampling") {
    headers = ["東京の月平均気温（℃）"];
    rows = monthlyTemperatures.map((v) => [v]);
    name = "東京の月平均気温120か月（2016〜2025年）";
    base.seed = seed;
  } else if (id === "crosstab") {
    headers = ["学科", "性別", "合否"];
    rows = admissions.flatMap((matrix, g) =>
      matrix.flatMap((counts, r) =>
        counts.flatMap((count, c) =>
          Array.from({ length: count }, () => [
            ["学科A", "学科F"][g],
            ["男性", "女性"][r],
            ["合格", "不合格"][c],
          ]),
        ),
      ),
    );
    name = "UCバークレー大学大学院の志願者（1973年・学科AとF）";
  } else if (id === "lorenz") {
    headers = ["1世帯当たり平均所得金額（万円）"];
    rows = incomeQuintiles.map((v) => [v]);
    name = "日本の所得五分位階級別の平均所得（2022年分）";
  } else if (id === "hypothesis-test") {
    headers = ["性別", "志願者数", "合格者数"];
    rows = [
      ["男性", 373, 22],
      ["女性", 341, 24],
    ];
    name = "UCバークレー大学大学院・学科Fの合格者（1973年）";
    base.seed = seed;
  } else if (id === "time-series") {
    const next = { ...base };
    const data = currentData(id, next);
    next.dataInfo = {
      name: data.name,
      origin: "sample",
      columns: data.headers,
      baseline: data.rows,
      publicDataset: publicDatasetInfo(id),
    };
    return next;
  } else if (id === "probability") {
    return { ...base, seed, observed: undefined };
  } else throw Error("このラボのサンプルはありません。");
  const next = applyData(id, base, { headers, rows, name, ...selection });
  next.dataInfo = {
    ...next.dataInfo,
    origin: "sample",
    seed,
    publicDataset: publicDatasetInfo(id),
  };
  if (id === "histogram") next.width = 2;
  if (id === "summary") {
    next.min = 0;
    next.max = 45;
  }
  return next;
}
