import { compatibleVersion } from "./attempt.mjs";

export const catalogSections = [
  ["q1", "第1問"],
  ["q2a", "第2問A"],
  ["q2b", "第2問B"],
  ["q3", "第3問"],
  ["q4", "第4問"],
];
export const isInterrupted = (a) =>
  a.status !== "graded" || !a.result || a.gradingKind === "interim";

// Timed and untimed full exams share a status. Section practice has its own
// status for each section, while using the very same exam ID and manifest.
export function catalogProgress(entry, history, mode, sectionId) {
  const runs = history
    .filter(
      (a) =>
        !a.discardedAt &&
        a.examId === entry.id &&
        compatibleVersion(a.examId, a.examVersion) === entry.version &&
        (mode === "section"
          ? a.mode === "section" &&
            a.sectionIds.length === 1 &&
            a.sectionIds[0] === sectionId
          : a.mode === "timed" || a.mode === "untimed"),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt);
  const unfinished = runs.find(isInterrupted);
  return {
    status: unfinished ? "中断中" : runs.length ? "採点済み" : "未受験",
    resume: unfinished || null,
    latest: runs[0] || null,
  };
}

export function sortCatalog(entries, history, mode, sectionId, order) {
  const numberOrder = (a, b) =>
    a.id.localeCompare(b.id, "en", { numeric: true });
  const newest = (a, b) =>
    (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0) ||
    numberOrder(b, a);
  const rank = { 未受験: 0, 中断中: 1, 採点済み: 2 };
  return [...entries].sort((a, b) => {
    if (order === "number") return numberOrder(a, b);
    if (order === "newest") return newest(a, b);
    return (
      rank[catalogProgress(a, history, mode, sectionId).status] -
        rank[catalogProgress(b, history, mode, sectionId).status] ||
      numberOrder(b, a)
    );
  });
}
