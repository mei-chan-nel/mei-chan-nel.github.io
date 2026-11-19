import { compatibleVersion } from "./attempt.mjs";

export const catalogSections = [
  ["q1", "第1問"],
  ["q2a", "第2問A"],
  ["q2b", "第2問B"],
  ["q3", "第3問"],
  ["q4", "第4問"],
];
export const examLabel = (entry) => {
  const id = typeof entry === "string" ? entry : entry.id;
  if (typeof entry === "object" && entry.shortTitle) return entry.shortTitle;
  const past = /^(\d{4})(Honshi|Tuishi)$/.exec(id);
  return past ? `${past[1]}年度 ${past[2] === "Honshi" ? "本試験" : "追・再試験"}` : `No.${id}`;
};
export const isPastExam = entry => entry.kind === "past" || /^\d{4}(Honshi|Tuishi)$/.test(entry.id);
export const filterExams = (entries, type = "all") => entries.filter(e => type === "all" || (type === "past" ? isPastExam(e) : !isPastExam(e)));

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
    latestResult: runs.find((run) => run.result) || null,
  };
}

export function sortCatalog(entries, history, mode, sectionId, order) {
  const numberOrder = (a, b) =>
    a.id.localeCompare(b.id, "en", { numeric: true });
  const newest = (a, b) =>
    (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0) ||
    numberOrder(b, a);
  const rank = { 中断中: 0, 未受験: 1, 採点済み: 2 };
  return [...entries].sort((a, b) => {
    if (order === "number") return Number(isPastExam(a))-Number(isPastExam(b)) || numberOrder(a, b);
    if (order === "newest") return Number(isPastExam(a))-Number(isPastExam(b)) || newest(a, b);
    return (
      rank[catalogProgress(a, history, mode, sectionId).status] -
        rank[catalogProgress(b, history, mode, sectionId).status] ||
      Number(isPastExam(a))-Number(isPastExam(b)) ||
      numberOrder(b, a)
    );
  });
}
