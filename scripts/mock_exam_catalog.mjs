import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { grade, validateExam } from "../mock-exams/engine/scoring.mjs";
import { recordBody } from "../mock-exams/engine/stats.mjs";

export const mockRoot = fileURLToPath(
  new URL("../mock-exams/", import.meta.url),
);
export const readJSON = (file) => JSON.parse(readFileSync(file, "utf8"));
const check = (ok, message) => {
  if (!ok) throw Error(message);
};

export function catalogVersions(catalog) {
  check(Array.isArray(catalog), "catalog.json must be an array");
  const ids = new Set(),
    out = [];
  for (const entry of catalog) {
    check(
      /^\d{3}$/.test(entry.id) && entry.id !== "000" && !ids.has(entry.id),
      "Duplicate or invalid catalog No.",
    );
    ids.add(entry.id);
    check(
      typeof entry.title === "string" && entry.title.trim(),
      `Missing title: ${entry.id}`,
    );
    if (entry.publishedAt !== undefined)
      check(
        /^\d{4}-\d{2}-\d{2}$/.test(entry.publishedAt) &&
          new Date(entry.publishedAt).toISOString().slice(0, 10) ===
            entry.publishedAt,
        `Invalid publication date: ${entry.id}`,
      );
    check(
      entry.versions === undefined || Array.isArray(entry.versions),
      "versions must be an array",
    );
    const versions = new Set();
    for (const item of [entry, ...(entry.versions || [])]) {
      check(
        Number.isInteger(item.version) &&
          item.version > 0 &&
          item.version <= entry.version &&
          !versions.has(item.version),
        `Duplicate/invalid version: ${entry.id}`,
      );
      versions.add(item.version);
      check(
        item.manifest === `exams/${entry.id}/${item.version}/exam.json`,
        `Unexpected manifest path: ${item.manifest}`,
      );
      out.push({ ...entry, ...item, id: entry.id });
    }
  }
  return out;
}

// Keep unrelated exams, publication metadata and every old manifest intact.
export function registerEntry(catalog, incoming) {
  catalogVersions(catalog);
  const result = structuredClone(catalog);
  const i = result.findIndex((e) => e.id === incoming.id);
  if (i < 0) result.push(incoming);
  else {
    const current = result[i];
    check(
      incoming.version >= current.version,
      "Cannot replace the current edition with an older version",
    );
    const versions = [...(current.versions || [])];
    if (incoming.version > current.version)
      versions.push({ version: current.version, manifest: current.manifest });
    result[i] = {
      ...current,
      ...incoming,
      ...(versions.length ? { versions } : {}),
    };
  }
  catalogVersions(result);
  return result;
}

export function checkManifest(relative, root = mockRoot) {
  check(
    /^exams\/[0-9]{3}\/[1-9][0-9]*\/exam\.json$/.test(relative),
    "Use exams/NNN/<integer>/exam.json",
  );
  const file = path.join(root, relative),
    exam = readJSON(file);
  validateExam(exam);
  check(
    relative === `exams/${exam.id}/${exam.version}/exam.json`,
    "Directory and exam ID/version disagree",
  );
  check(
    exam.sections.map((s) => s.id).join() === "q1,q2a,q2b,q3,q4" &&
      exam.maxPoints === 100 &&
      exam.durationSeconds === 3600,
    "A full mock must have five sections, 100 points and 60 minutes",
  );
  // Authored separately from exam.json, from the reviewed answers/explanations.
  const qa = readJSON(path.join(path.dirname(file), "source/qa.json"));
  check(qa.schemaVersion === 1, "Missing QA schemaVersion");
  const ids = exam.fields.map((f) => f.id);
  check(
    Object.keys(qa.answers || {}).length === ids.length &&
      ids.every((id) => Object.hasOwn(qa.answers, id)),
    "QA must answer every field",
  );
  const perfect = grade(exam, qa.answers);
  check(
    perfect.points === qa.expectedTotal && perfect.points === exam.maxPoints,
    "Reviewed answers do not earn full marks",
  );
  for (const section of perfect.sections)
    check(
      section.points === qa.expectedSections?.[section.id],
      `QA section total: ${section.id}`,
    );
  for (const unit of exam.scoring)
    for (const id of unit.fields)
      check(
        qa.expectedQuestions?.[id] === unit.question,
        `Question number differs from reviewed original: ${id}`,
      );
  recordBody(exam, perfect.units);
  check(grade(exam, {}).points === 0, "Blank exam must earn zero");
  for (const scenario of qa.cases || []) {
    const result = grade(exam, scenario.answers);
    check(
      Object.keys(scenario.answers).every((id) => ids.includes(id)),
      `Unknown QA field: ${scenario.name}`,
    );
    check(
      result.points === scenario.expectedTotal,
      `QA total: ${scenario.name}`,
    );
    for (const [id, points] of Object.entries(scenario.expectedUnits || {}))
      check(
        result.units.find((u) => u.id === id)?.points === points,
        `QA unit: ${scenario.name} / ${id}`,
      );
    recordBody(
      exam,
      result.units.filter((u) => u.answered),
    );
  }
  return exam;
}
