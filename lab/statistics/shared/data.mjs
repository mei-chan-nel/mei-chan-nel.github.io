import { monthlyTemperatures } from "./public-data.mjs?v=20261025-clear-test";
import { householdSeries } from "../time-series/data.mjs?v=20261025-clear-test";
import { publicDatasetInfo } from "./sources.mjs?v=20261025-clear-test";
export const studyData = () =>
  householdSeries.values.map((y, i) => ({
    id: i + 1,
    x: monthlyTemperatures[i],
    y,
    group: i < 60 ? "2016〜2020年" : "2021〜2025年",
  }));
export const defaultDataset = () => ({
  name: "月平均気温とアイスクリームへの支出（2016〜2025年）",
  origin: "sample",
  xLabel: "東京の月平均気温（℃）",
  yLabel: "全国の月別支出金額（円）",
  rows: studyData(),
  publicDataset: publicDatasetInfo("correlation"),
});
export function validateDataset(d) {
  if (
    !d ||
    typeof d.name !== "string" ||
    !Array.isArray(d.rows) ||
    d.rows.length < 2 ||
    d.rows.length > 300
  )
    throw Error("データは2〜300行で指定してください。");
  if (
    !d.rows.every(
      (r) =>
        Number.isFinite(r.x) &&
        Number.isFinite(r.y) &&
        Math.abs(r.x) <= 1e6 &&
        Math.abs(r.y) <= 1e6,
    )
  )
    throw Error("x・yには有限の数値を入力してください。");
  return {
    name: d.name.slice(0, 120),
    origin:
      d.origin === "user" ? "user" : d.origin === "sample" ? "sample" : "saved",
    publicDataset:
      d.origin === "sample" ? publicDatasetInfo("correlation") : undefined,
    xLabel: String(d.xLabel || "x").slice(0, 100),
    yLabel: String(d.yLabel || "y").slice(0, 100),
    rows: d.rows.map((r, i) => ({
      id: i + 1,
      x: r.x,
      y: r.y,
      group: String(r.group || "全体").slice(0, 40),
    })),
  };
}
export function readDataset() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("study-atlas-statistics-dataset-v1"),
    );
    return saved?.origin === "sample"
      ? defaultDataset()
      : validateDataset(saved);
  } catch {
    const data = defaultDataset();
    try {
      return saveDataset(data);
    } catch {
      return data;
    }
  }
}
export function saveDataset(d) {
  const safe = validateDataset(d);
  localStorage.setItem(
    "study-atlas-statistics-dataset-v1",
    JSON.stringify(safe),
  );
  return safe;
}
export const selectedValues = (d, field = "y") => d.rows.map((r) => r[field]);
