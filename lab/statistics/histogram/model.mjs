import { histogram } from "../shared/math.mjs";
export function parseRows(text) {
  const lines = text
    .trim()
    .split(/\n/)
    .filter((x) => x.trim());
  if (!lines.length) throw new Error("データを1行以上入力してください。");
  if (lines.length > 300)
    throw new Error("操作しやすいよう300件まで入力できます。");
  return lines.map((s, i) => {
    const parts = s.trim().split(/[,、\t ]+/),
      value = Number(parts[0]);
    if (parts[0] === "" || !Number.isFinite(value) || Math.abs(value) > 1000000)
      throw new Error(
        `${i + 1}行目の数値を確認してください（±1,000,000以内）。`,
      );
    const group = (parts[1] || "A").toUpperCase();
    if (!["A", "B"].includes(group))
      throw new Error(`${i + 1}行目の集団は A または B にしてください。`);
    return { id: `row-${i}`, value, group };
  });
}
export function displayedRows(state) {
  return state.rows.map((r) => ({
    ...r,
    value: r.value + (r.group === "B" ? Number(state.shiftB || 0) : 0),
  }));
}
export function binIndex(value, width, start) {
  const q = (value - start) / width;
  return Math.floor(q + 8 * Number.EPSILON * Math.max(1, Math.abs(q)));
}
export function distribution(rows, width, start) {
  const bins = histogram(
    rows.map((r) => r.value),
    width,
    start,
  );
  return bins.map((b) => ({
    ...b,
    a: rows.filter(
      (r) =>
        r.group === "A" &&
        binIndex(r.value, width, start) === binIndex(b.lo, width, start),
    ).length,
    b: rows.filter(
      (r) =>
        r.group === "B" &&
        binIndex(r.value, width, start) === binIndex(b.lo, width, start),
    ).length,
  }));
}

export function niceWidth(span) {
  const rough = span > 0 ? span / 8 : 1;
  const base = 10 ** Math.floor(Math.log10(rough));
  return [1, 2, 5, 10].map((n) => n * base).find((n) => n >= rough);
}

// Old saved experiments stored a separate B offset. Preserve their displayed
// observations once, then use a single source of values in the editable table.
export function normalizeHistogram(state) {
  const rows = displayedRows(state),
    values = rows.map((r) => r.value);
  const span = Math.max(...values) - Math.min(...values);
  const width = Math.max(
    0.1,
    Number(state.width) || niceWidth(span),
    span / 120,
  );
  return {
    ...state,
    rows,
    shiftB: 0,
    width,
    mode:
      state.mode === "split" && rows.some((row) => row.group === "B")
        ? "split"
        : "combined",
    start: Number.isFinite(state.start) ? state.start : 0,
    measure: state.measure === "relative" ? "relative" : "count",
    selected: Number.isInteger(state.selected) ? state.selected : -1,
  };
}

export function stackedBars(bins, n, mode, measure) {
  const divisor = measure === "relative" ? n : 1;
  return bins.flatMap((b, index) => {
    const parts =
      mode === "split"
        ? [
            ["A", b.a],
            ["B", b.b],
          ]
        : [["all", b.count]];
    let cumulativeCount = 0;
    return parts.map(([group, count]) => {
      const bottom = cumulativeCount / divisor;
      cumulativeCount += count;
      const bar = {
        index,
        group,
        count,
        lo: b.lo,
        hi: b.hi,
        bottom,
        top: cumulativeCount / divisor,
      };
      return bar;
    });
  });
}
