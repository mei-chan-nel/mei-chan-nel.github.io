import { rng, normal, clamp } from "./math.mjs";
import { applyData, currentData } from "./data-model.mjs?v=20261023-sampling-size-comparison";
export function freshSeed() {
  const bytes = new Uint32Array(1);
  globalThis.crypto.getRandomValues(bytes);
  return bytes[0];
}
// Seeded generators keep examples meaningful while producing a fresh dataset on each visit.
export function sampleState(id, initial, seed = freshSeed()) {
  const random = rng(seed);
  const integer = (lo, hi) => Math.floor(lo + random() * (hi - lo + 1));
  const bell = (center, spread) => Math.round(center + normal(random) * spread);
  const base = { ...initial, dataInfo: null };
  let headers,
    rows,
    name,
    selection = {};
  if (id === "correlation") {
    headers = ["1週間の復習時間（分）", "確認テスト（点）"];
    rows = Array.from({ length: 18 }, () => {
      const x = integer(8, 110);
      return [x, clamp(bell(30 + 0.52 * x, 9), 5, 100)];
    });
    name = "18人の復習時間と確認テスト";
  } else if (id === "summary") {
    headers = ["確認テスト（点）"];
    rows = Array.from({ length: 14 }, () => [
      clamp(bell(integer(56, 65), 13), 5, 95),
    ]);
    name = "14人の確認テスト";
  } else if (id === "histogram") {
    headers = ["クイズの所要時間（秒）", "集団"];
    // Rounded normal-score offsets keep two recognisable, overlapping hills
    // in this small teaching sample. These are constructed, fictional records.
    const offsets = [
      -12, -10, -9, -8, -7, -6, -5, -4, -4, -3, -2, -2, -1, -1, 0, 0, 1, 1, 2,
      2, 3, 4, 4, 5, 6, 7, 8, 9, 10, 12,
    ];
    const centerA = integer(43, 45),
      centerB = centerA + integer(18, 19);
    const a = offsets.map(
      (v) => centerA + v + (Math.abs(v) > 10 ? 0 : integer(-1, 1)),
    );
    const b = offsets
      .filter((_, i) => i !== 14)
      .map((v) => centerB + Math.round(v * 0.8));
    // A very fast pupil in B falls inside A's hill, below B's lower IQR fence.
    // Neither group receives an artificial high-side outlier.
    b.push(centerA - 2);
    const shuffle = (values) => {
      for (let i = values.length - 1; i > 0; i--) {
        const j = integer(0, i);
        [values[i], values[j]] = [values[j], values[i]];
      }
      return values;
    };
    rows = [
      ...shuffle(a).map((v) => [v, "A"]),
      ...shuffle(b).map((v) => [v, "B"]),
    ];
    selection = { group: 1 };
    name = "速いB群の生徒を含む60人のクイズ所要時間";
  } else if (id === "sampling") {
    headers = ["読書時間（分）"];
    rows = Array.from({ length: 120 }, () => [Math.max(0, bell(34, 13))]);
    name = "生徒120人の読書時間";
    base.seed = seed;
  } else if (id === "crosstab") {
    headers = ["集団", "方式", "到達", "未到達"];
    const total = integer(90, 150),
      easy = integer(76, 86),
      hard = integer(18, 28),
      advantage = integer(7, 12);
    rows = [];
    for (const [g, label] of ["初級課題", "応用課題"].entries()) {
      for (const [j, method] of ["A方式", "B方式"].entries()) {
        const count = Math.round(total * (g === j ? 0.22 : 0.78));
        const success = Math.round(
          (count * ((g ? hard : easy) + (j ? 0 : advantage))) / 100,
        );
        rows.push([label, method, success, count - success]);
      }
    }
    name = "課題難易度別の学習方法と到達人数";
  } else if (id === "lorenz") {
    headers = ["所得（万円）"];
    rows = Array.from({ length: 10 }, () => [
      Math.round(6 + Math.exp(random() * 3) * 5),
    ]);
    name = "10人の月の所得";
  } else if (id === "hypothesis-test") {
    headers = ["群", "対象数", "成功数"];
    const n = integer(6, 14) * 10,
      p = integer(30, 45) / 100,
      difference = integer(6, 16) / 100;
    rows = [
      ["A", n, Math.round(n * p)],
      ["B", n, Math.round(n * (p + difference))],
    ];
    name = "学習アプリ案内A/Bの登録人数";
    base.seed = integer(1, 999999);
  } else if (id === "time-series") {
    const next = {
      ...base,
      seed,
      trend: integer(1, 6) / 2,
      seasonal: integer(10, 25) * 2,
      noise: integer(6, 20),
    };
    const data = currentData(id, next);
    next.dataInfo = {
      name: data.name,
      origin: "sample",
      columns: data.headers,
      baseline: data.rows,
      seed,
    };
    return next;
  } else if (id === "probability") {
    return { ...base, seed, observed: undefined };
  } else throw Error("このラボのサンプルはありません。");
  const next = applyData(id, base, { headers, rows, name, ...selection });
  next.dataInfo = { ...next.dataInfo, origin: "sample", seed };
  if (id === "histogram") next.width = base.width;
  if (id === "summary") {
    next.min = 0;
    next.max = 100;
  }
  return next;
}
