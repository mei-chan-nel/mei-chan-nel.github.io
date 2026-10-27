import { grade } from "./scoring.mjs";
export function createAttempt(exam, mode, sectionId, now = Date.now()) {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    examId: exam.id,
    examVersion: exam.version,
    mode,
    sectionIds:
      mode === "section" ? [sectionId] : exam.sections.map((s) => s.id),
    createdAt: now,
    updatedAt: now,
    answers: {},
    flags: [],
    elapsedMs: 0,
    startedAt: now,
    status: "active",
    revision: 0,
    result: null,
    showCorrectness: false,
    review: null,
  };
}
export function elapsed(a, now = Date.now()) {
  return a.elapsedMs + (a.startedAt ? Math.max(0, now - a.startedAt) : 0);
}
export function pause(a, now = Date.now()) {
  a.elapsedMs = elapsed(a, now);
  a.startedAt = null;
  a.status = "paused";
  a.updatedAt = now;
}
export function resume(a, show = false, now = Date.now()) {
  a.startedAt = now;
  a.status = "active";
  a.showCorrectness = show;
  a.updatedAt = now;
}
export function submit(exam, a, now = Date.now()) {
  pause(a, now);
  a.gradedAnswers = structuredClone(a.answers);
  a.result = grade(exam, a.answers, a.sectionIds);
  a.status = "graded";
  a.revision++;
  a.showCorrectness = true;
  return a.result;
}
export function startReview(exam, a) {
  if (!a.result) throw new Error("Grade before review");
  if (!a.review) {
    a.review = { answers: {}, locked: [], completed: false };
    for (const u of a.result.units)
      if (u.correct) {
        for (const id of u.fields) {
          a.review.answers[id] = a.answers[id];
          a.review.locked.push(id);
        }
      }
  }
  for (const f of exam.fields)
    if (!a.review.locked.includes(f.id)) delete a.review.answers[f.id];
  return a.review;
}
export function gradeReview(exam, a) {
  const r = grade(exam, a.review.answers, a.sectionIds);
  for (const u of r.units)
    if (u.correct)
      for (const id of u.fields)
        if (!a.review.locked.includes(id)) a.review.locked.push(id);
  a.review.completed = r.points === r.maxPoints;
  a.review.result = r;
  return r;
}
const PREFIX = "study-atlas:mock-exams:v1:";
export class AttemptStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
  }
  list() {
    const out = [];
    for (let i = 0; i < this.storage.length; i++) {
      const k = this.storage.key(i);
      if (k.startsWith(PREFIX + "attempt:") && !k.endsWith(":backup")) {
        const a = this.load(k.slice((PREFIX + "attempt:").length));
        if (a) out.push(a);
      }
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  }
  load(id) {
    const key = PREFIX + "attempt:" + id;
    for (const k of [key, key + ":backup"]) {
      const raw = this.storage.getItem(k);
      if (!raw) continue;
      try {
        const a = JSON.parse(raw);
        if (a.schemaVersion === 1 && a.id === id) return a;
      } catch {}
    }
    return null;
  }
  save(a) {
    const key = PREFIX + "attempt:" + a.id;
    const raw = JSON.stringify(a);
    const old = this.storage.getItem(key);
    if (old) this.storage.setItem(key + ":backup", old);
    this.storage.setItem(key, raw);
    if (this.storage.getItem(key) !== raw)
      throw new Error("Storage verification failed");
  }
  export() {
    return JSON.stringify(
      { schemaVersion: 1, exportedAt: Date.now(), attempts: this.list() },
      null,
      2,
    );
  }
}
export function restoreAttempt(exam, raw) {
  const fail = () => {
    throw Error("Invalid history data");
  };
  if (
    raw.schemaVersion !== 1 ||
    !/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.test(
      raw.id,
    ) ||
    raw.examId !== exam.id ||
    raw.examVersion !== exam.version
  )
    fail();
  if (
    !["timed", "untimed", "section"].includes(raw.mode) ||
    !["active", "paused", "graded"].includes(raw.status)
  )
    fail();
  if (
    !Array.isArray(raw.sectionIds) ||
    !raw.sectionIds.length ||
    new Set(raw.sectionIds).size !== raw.sectionIds.length ||
    raw.sectionIds.some((id) => !exam.sections.some((s) => s.id === id))
  )
    fail();
  if (
    ![raw.createdAt, raw.updatedAt, raw.elapsedMs, raw.revision].every(
      (n) => Number.isFinite(n) && n >= 0,
    ) ||
    !Number.isInteger(raw.revision)
  )
    fail();
  if (
    raw.startedAt !== null &&
    (!Number.isFinite(raw.startedAt) || raw.startedAt < 0)
  )
    fail();
  const known = new Set(
    exam.fields
      .filter((f) => raw.sectionIds.includes(f.sectionId))
      .map((f) => f.id),
  );
  const checkAnswers = (values) => {
    if (
      !values ||
      typeof values !== "object" ||
      Array.isArray(values) ||
      Object.keys(values).some((id) => !known.has(id))
    )
      fail();
    grade(exam, values, raw.sectionIds);
    return structuredClone(values);
  };
  const a = {
    schemaVersion: 1,
    id: raw.id,
    examId: exam.id,
    examVersion: exam.version,
    mode: raw.mode,
    sectionIds: [...raw.sectionIds],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    answers: checkAnswers(raw.answers),
    flags: Array.isArray(raw.flags)
      ? raw.flags.filter((id) => known.has(id))
      : [],
    elapsedMs: raw.elapsedMs,
    startedAt: raw.startedAt,
    status: raw.status,
    revision: raw.revision,
    showCorrectness: !!raw.showCorrectness,
    result: null,
    review: null,
  };
  if (raw.result) {
    a.gradedAnswers = checkAnswers(
      raw.gradedAnswers ||
        Object.fromEntries(
          raw.result.units.flatMap((u) =>
            u.fields.map((id, i) => [id, u.answers[i]]),
          ),
        ),
    );
    a.result = grade(exam, a.gradedAnswers, a.sectionIds);
  }
  if (raw.review && a.result) {
    const answers = checkAnswers(raw.review.answers),
      r = grade(exam, answers, a.sectionIds);
    a.review = {
      answers,
      locked: r.units
        .filter(
          (u) =>
            u.correct &&
            u.fields.every((id) => raw.review.locked?.includes(id)),
        )
        .flatMap((u) => u.fields),
      completed: !!raw.review.completed && r.points === r.maxPoints,
      result: raw.review.result ? r : null,
    };
  }
  if (raw.originalMode === "timed") a.originalMode = "timed";
  if (raw.continuedAfterDeadline) a.continuedAfterDeadline = true;
  if (/^[0-9a-f]{64}$/.test(raw.statsToken || "")) {
    a.statsToken = raw.statsToken;
    if (raw.pendingSubmission?.revision === a.revision && a.result)
      a.pendingSubmission = {
        kind: "attempt-grade",
        attemptId: a.id,
        attemptToken: a.statsToken,
        examId: exam.id,
        examVersion: exam.version,
        revision: a.revision,
        sectionIds: a.sectionIds,
        answers: a.gradedAnswers,
      };
  }
  if (
    Number.isInteger(raw.statsAcknowledgedRevision) &&
    raw.statsAcknowledgedRevision > 0
  )
    a.statsAcknowledgedRevision = raw.statsAcknowledgedRevision;
  return a;
}
