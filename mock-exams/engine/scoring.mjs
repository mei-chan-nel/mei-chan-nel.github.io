// Deterministic browser scoring; scoring units are independent of input fields.
import { validateDefinition } from "./definition.mjs";
const blank = (value) => value === undefined || value === null || value === "";
export function normalize(field, value) {
  if (blank(value)) return "";
  if (typeof value !== "string") throw new Error(`Invalid answer: ${field.id}`);
  const s = value.normalize("NFKC").trim().toUpperCase();
  if (field.type === "text") {
    if (
      s.length > field.maxLength ||
      [...s].some((c) => !field.allowed.includes(c))
    )
      throw new Error(`Invalid characters: ${field.id}`);
  } else if (!field.choices.some((c) => c.value === s))
    throw new Error(`Invalid choice: ${field.id}`);
  return s;
}
function matches(actual, expected, unordered) {
  const a = unordered ? [...actual].sort() : actual;
  const b = unordered ? [...expected].sort() : expected;
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
function condition(c, answers, results) {
  if (!c) return true;
  if (c.all) return c.all.every((x) => condition(x, answers, results));
  if (c.any) return c.any.some((x) => condition(x, answers, results));
  if (c.field) return answers[c.field] === c.equals;
  if (c.unit) {
    if (!results[c.unit])
      throw new Error(`Scoring dependency must precede ${c.unit}`);
    return results[c.unit].points >= c.atLeast;
  }
  throw new Error("Unknown scoring condition");
}
function award(rule, actual, max, answers, results) {
  if (rule.kind === "conditional")
    return award(
      condition(rule.when, answers, results) ? rule.then : rule.else,
      actual,
      max,
      answers,
      results,
    );
  if (["exact", "unordered"].includes(rule.kind))
    return rule.patterns.some((p) =>
      matches(actual, p, rule.kind === "unordered"),
    )
      ? max
      : 0;
  if (rule.kind === "cases") {
    const hit = rule.cases.find(
      (c) =>
        condition(c.when, answers, results) &&
        matches(actual, c.answers, !!c.unordered),
    );
    return hit ? hit.points : 0;
  }
  if (rule.kind === "unordered-partial") {
    let best = 0;
    for (const pattern of rule.patterns) {
      const remaining = [...pattern];
      let hits = 0;
      for (const v of actual) {
        const i = remaining.indexOf(v);
        if (v !== "" && i >= 0) {
          remaining.splice(i, 1);
          hits++;
        }
      }
      best = Math.max(best, rule.pointsByMatches[hits] ?? 0);
    }
    return best;
  }
  throw new Error(`Unknown scoring kind: ${rule.kind}`);
}
export function grade(
  exam,
  raw = {},
  sectionIds = exam.sections.map((s) => s.id),
) {
  const answers = {};
  for (const f of exam.fields) answers[f.id] = normalize(f, raw[f.id]);
  const results = {};
  for (const u of exam.scoring) {
    const actual = u.fields.map((id) => answers[id]);
    const points = award(u.rule, actual, u.maxPoints, answers, results);
    if (!Number.isFinite(points) || points < 0 || points > u.maxPoints)
      throw new Error(`Invalid points: ${u.id}`);
    results[u.id] = {
      id: u.id,
      sectionId: u.sectionId,
      fields: u.fields,
      answers: actual,
      answerKey: actual.map((v) => v || "_").join("|"),
      answered: actual.some((v) => v !== ""),
      points,
      maxPoints: u.maxPoints,
      correct: points === u.maxPoints,
    };
  }
  const units = Object.values(results).filter((u) =>
    sectionIds.includes(u.sectionId),
  );
  const sections = exam.sections
    .filter((s) => sectionIds.includes(s.id))
    .map((s) => ({
      ...s,
      points: units
        .filter((u) => u.sectionId === s.id)
        .reduce((n, u) => n + u.points, 0),
    }));
  return {
    points: units.reduce((n, u) => n + u.points, 0),
    maxPoints: units.reduce((n, u) => n + u.maxPoints, 0),
    units,
    sections,
  };
}
export function correctPatterns(rule) {
  if (rule.patterns) return rule.patterns;
  if (rule.kind === "conditional")
    return [...correctPatterns(rule.then), ...correctPatterns(rule.else)];
  return rule.cases?.map((c) => c.answers) ?? [];
}
export function validateExam(exam) {
  validateDefinition(exam);
  if (grade(exam, {}).points !== 0) throw Error("Blank exam must score zero");
  return true;
}
export function calculateStats(exam, rows = []) {
  const units = exam.scoring.map((u) => {
    const r = rows.find((r) => r.scoring_id === u.id);
    const n = Number(r?.answered_count || 0);
    return {
      ...u,
      count: n,
      fullRate: n ? Number(r.correct_count) / n : null,
      average: n ? Number(r.points_sum) / n : null,
      averageRate: n ? Number(r.points_sum) / (n * u.maxPoints) : null,
    };
  });
  const aggregate = (ids) => {
    const us = units.filter((u) => ids.includes(u.sectionId));
    const maxPoints = us.reduce((n, u) => n + u.maxPoints, 0);
    const available = us.length > 0 && us.every((u) => u.count > 0);
    const points = available ? us.reduce((n, u) => n + u.average, 0) : null;
    return {
      maxPoints,
      points,
      rate: available ? points / maxPoints : null,
      available,
    };
  };
  return {
    units,
    total: aggregate(exam.sections.map((s) => s.id)),
    sections: Object.fromEntries(
      exam.sections.map((s) => [s.id, aggregate([s.id])]),
    ),
  };
}
