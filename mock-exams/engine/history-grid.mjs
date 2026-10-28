import { elapsed } from "./attempt.mjs";
import { catalogSections, isInterrupted } from "./catalog.mjs";
const sectionTitle = (id) =>
  catalogSections.find((s) => s[0] === id)?.[1] || id;
export const emptyGridState = () => ({
  sort: { key: "date", direction: "desc" },
  filters: {},
});
export function sliceResult(result, sectionId) {
  if (!sectionId || !result) return result;
  const sections = result.sections.filter((s) => s.id === sectionId),
    units = result.units.filter((u) => u.sectionId === sectionId);
  return {
    ...result,
    sections,
    units,
    points: units.reduce((n, u) => n + u.points, 0),
    maxPoints: units.reduce((n, u) => n + u.maxPoints, 0),
  };
}
export function historyRows(attempts, mode = "all", now = Date.now()) {
  return attempts
    .filter((a) => !a.discardedAt && (mode !== "full" || a.mode !== "section"))
    .flatMap((a) => {
      const ids = mode === "section" ? a.sectionIds : [null];
      return ids.map((id) => {
        const section = id && a.result?.sections?.find((s) => s.id === id),
          result = id ? section : a.result;
        const derived = !!id && a.mode !== "section";
        const fullMode =
          a.mode === "timed" ? "回ごと・60分" : "回ごと・時間制限なし";
        const title = id
          ? section?.title || sectionTitle(id)
          : a.mode === "section"
            ? sectionTitle(a.sectionIds[0])
            : fullMode;
        return {
          key: a.id + ":" + (id || "all"),
          attempt: a,
          sectionId: id,
          derived,
          date: a.createdAt,
          exam: a.examId,
          scope:
            title + (id ? (derived ? `（${fullMode}）` : "（大問別）") : ""),
          fullMode: a.mode === "section" ? null : fullMode,
          status: isInterrupted(a)
            ? a.result
              ? "途中採点・中断中"
              : "中断中"
            : "採点済み",
          points: result ? result.points : null,
          maxPoints: result ? result.maxPoints : null,
          rate: result ? (result.points / result.maxPoints) * 100 : null,
          duration: derived ? null : Math.floor(elapsed(a, now) / 1000),
        };
      });
    });
}
const day = (value) => {
  const d = new Date(value);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};
const clock = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
export const historyColumns = [
  {
    key: "date",
    label: "受験日時",
    kind: "date",
    filterValue: (r) => day(r.date),
    labelValue: (r) => day(r.date).replaceAll("-", "/"),
  },
  {
    key: "exam",
    label: "模試No.",
    kind: "text",
    labelValue: (r) => "No." + r.exam,
  },
  { key: "scope", label: "受験方式・大問", kind: "text" },
  { key: "status", label: "状態", kind: "text" },
  {
    key: "points",
    label: "得点",
    kind: "number",
    labelValue: (r) =>
      r.points === null ? "—" : `${r.points} / ${r.maxPoints}点`,
  },
  {
    key: "rate",
    label: "得点率",
    kind: "number",
    unit: "%",
    labelValue: (r) => (r.rate === null ? "—" : r.rate.toFixed(1) + "%"),
  },
  {
    key: "duration",
    label: "解答時間",
    kind: "number",
    unit: "秒",
    labelValue: (r) => (r.duration === null ? "—" : clock(r.duration)),
  },
];
export const filterKey = (column, row) =>
  JSON.stringify(
    column.filterValue
      ? column.filterValue(row)
      : column.key === "points"
        ? row.points === null
          ? null
          : `${row.points}/${row.maxPoints}`
        : row[column.key],
  );
// Older navigation state used one shared "通し受験" checkbox for both time modes.
// Expand that selection without altering the learner's stored attempts.
export function migrateHistoryScopeFilter(state, rows) {
  const values = state.filters?.scope?.values;
  if (!values) return;
  state.filters.scope.values = [
    ...new Set(
      values.flatMap((key) => {
        let old;
        try {
          old = JSON.parse(key);
        } catch {
          return [key];
        }
        if (typeof old !== "string" || !old.endsWith("（通し受験）"))
          return [key];
        const title = old.slice(0, -"（通し受験）".length);
        const matches = rows.filter(
          (r) => r.derived && r.scope.startsWith(title + "（"),
        );
        return matches.length
          ? matches.map((r) => JSON.stringify(r.scope))
          : [key];
      }),
    ),
  ];
}
export function columnValues(rows, column) {
  const seen = new Map();
  for (const row of rows) {
    const key = filterKey(column, row);
    if (!seen.has(key))
      seen.set(key, {
        key,
        label: column.labelValue
          ? column.labelValue(row)
          : String(row[column.key] ?? "—"),
        value: row[column.key],
      });
  }
  return [...seen.values()].sort((a, b) =>
    compareValue(a.value, b.value, "asc"),
  );
}
function compareValue(a, b, direction) {
  if (a === null || a === undefined)
    return b === null || b === undefined ? 0 : 1;
  if (b === null || b === undefined) return -1;
  const compared =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b), "ja", { numeric: true });
  return direction === "desc" ? -compared : compared;
}
export function applyHistoryGrid(rows, state = emptyGridState()) {
  const filters = state.filters || {};
  const filtered = rows.filter((row) =>
    historyColumns.every((column) => {
      const f = filters[column.key];
      if (!f) return true;
      if (Array.isArray(f.values) && !f.values.includes(filterKey(column, row)))
        return false;
      const value = column.kind === "date" ? day(row.date) : row[column.key];
      if (
        f.min !== undefined &&
        f.min !== "" &&
        (value === null ||
          value < (column.kind === "date" ? f.min : Number(f.min)))
      )
        return false;
      if (
        f.max !== undefined &&
        f.max !== "" &&
        (value === null ||
          value > (column.kind === "date" ? f.max : Number(f.max)))
      )
        return false;
      return true;
    }),
  );
  const sort =
    historyColumns.find((c) => c.key === state.sort?.key) || historyColumns[0];
  return filtered.sort(
    (a, b) =>
      compareValue(a[sort.key], b[sort.key], state.sort?.direction || "desc") ||
      b.date - a.date ||
      a.key.localeCompare(b.key),
  );
}
