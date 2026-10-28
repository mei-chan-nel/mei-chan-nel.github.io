import { grade } from "./scoring.mjs";
import { mergeDelivery, recoverDelivery } from "./delivery.mjs";
export const compatibleVersion = (id, version) =>
  id === "001" && version === "1.0.0" ? 1 : version;
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
    statsDelivery: {},
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
  a.gradingKind = "final";
  a.review = null;
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
        if (a && !a.discardedAt) out.push(a);
      }
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  }
  load(id) {
    const key = PREFIX + "attempt:" + id;
    const copies = [];
    for (const k of [key, key + ":backup"]) {
      const raw = this.storage.getItem(k);
      if (!raw) continue;
      try {
        const a = JSON.parse(raw);
        if (a.schemaVersion === 1 && a.id === id) copies.push(a);
      } catch {}
    }
    if (!copies.length) return null;
    copies.sort((a, b) => b.updatedAt - a.updatedAt);
    const latest = copies[0];
    if (copies.some((a) => a.isSample)) latest.isSample = true;
    if (copies.some((a) => a.discardedAt))
      latest.discardedAt = Math.max(...copies.map((a) => a.discardedAt || 0));
    latest.statsDelivery = mergeDelivery(...copies.map((a) => a.statsDelivery));
    return latest;
  }
  save(a) {
    const key = PREFIX + "attempt:" + a.id;
    const previous = this.load(a.id);
    if (previous?.isSample) a.isSample = true;
    if (previous?.discardedAt) {
      a.discardedAt = previous.discardedAt;
      a.answers = {};
      a.result = null;
      a.review = null;
      a.flags = [];
      delete a.gradedAnswers;
      a.startedAt = null;
      a.status = "paused";
    }
    a.statsDelivery = mergeDelivery(a.statsDelivery, previous?.statsDelivery);
    const raw = JSON.stringify(a);
    // Mirror the same send markers into the recovery copy. An old backup must
    // never make a possibly committed unit eligible for transmission again.
    this.storage.setItem(key + ":backup", raw);
    this.storage.setItem(key, raw);
    if (
      this.storage.getItem(key) !== raw ||
      this.storage.getItem(key + ":backup") !== raw
    )
      throw Error("Storage verification failed");
  }
  saveStatistics(a) {
    const latest = this.load(a.id) || a;
    a.statsDelivery = mergeDelivery(a.statsDelivery, latest.statsDelivery);
    latest.statsDelivery = a.statsDelivery;
    this.save(latest);
  }
  discard(id) {
    const a = this.load(id);
    if (!a) return;
    a.discardedAt = Date.now();
    a.updatedAt = a.discardedAt;
    a.answers = {};
    a.result = null;
    a.review = null;
    a.flags = [];
    delete a.gradedAnswers;
    a.startedAt = null;
    a.status = "paused";
    this.save(a);
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
    compatibleVersion(raw.examId, raw.examVersion) !== exam.version
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
    gradingKind: raw.gradingKind === "interim" ? "interim" : "final",
  };
  if (raw.isSample === true) a.isSample = true;
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
  const delivery = recoverDelivery(raw.statsDelivery);
  const knownUnits = new Set(
    exam.scoring
      .filter((u) => a.sectionIds.includes(u.sectionId))
      .map((u) => u.id),
  );
  if (Object.keys(delivery).some((id) => !knownUnits.has(id))) fail();
  a.statsDelivery = delivery;
  return a;
}
