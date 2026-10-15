export const studyData = () =>
  Array.from({ length: 24 }, (_, i) => ({
    id: i + 1,
    x: [1, 2, 3, 4, 5, 6, 2, 3, 4, 5, 6, 7, 1, 2, 3, 4, 5, 6, 3, 4, 5, 6, 7, 8][
      i
    ],
    y: [
      42, 48, 56, 60, 72, 75, 50, 57, 61, 70, 78, 85, 52, 63, 62, 74, 70, 82,
      62, 73, 68, 86, 80, 92,
    ][i],
    group: i < 12 ? "A組" : "B組",
  }));
export const defaultDataset = () => ({
  name: "学習時間と確認テスト（架空の24人）",
  xLabel: "1週間の学習時間（時間）",
  yLabel: "確認テストの得点（点）",
  rows: studyData(),
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
    return (
      validateDataset(
        JSON.parse(localStorage.getItem("study-atlas-statistics-dataset-v1")),
      ) || defaultDataset()
    );
  } catch {
    return defaultDataset();
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
