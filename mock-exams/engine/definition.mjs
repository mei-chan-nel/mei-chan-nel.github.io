// Validate authored data before it reaches input, grading or the public RPC.
export function validateDefinition(exam) {
  const check = (ok, message) => {
    if (!ok) throw Error(message);
  };
  const object = (v) => v && typeof v === "object" && !Array.isArray(v);
  const text = (v) => typeof v === "string" && v.trim().length > 0;
  const points = (v, max = 100) =>
    Number.isFinite(v) && v >= 0 && v <= max && Math.round(v * 100) / 100 === v;
  const rpcId = (v) =>
    typeof v === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(v);
  check(object(exam) && exam.schemaVersion === 1, "Unsupported exam schema");
  check(rpcId(exam.id), "Invalid exam ID");
  check(
    Number.isInteger(exam.version) &&
      exam.version > 0 &&
      exam.version <= 2147483647,
    "Exam version must be a positive PostgreSQL integer",
  );
  check(
    text(exam.title) &&
      Number.isInteger(exam.durationSeconds) &&
      exam.durationSeconds > 0,
    "Missing exam title or duration",
  );
  check(points(exam.maxPoints) && exam.maxPoints > 0, "Invalid exam points");
  for (const name of ["sections", "fields", "scoring"])
    check(
      Array.isArray(exam[name]) && exam[name].length > 0,
      `Missing ${name}`,
    );
  check(exam.scoring.length <= 100, "RPC supports at most 100 scoring units");
  const sections = new Map(),
    fields = new Map(),
    preceding = new Map();
  for (const s of exam.sections) {
    check(
      object(s) &&
        ["q1", "q2a", "q2b", "q3", "q4"].includes(s.id) &&
        !sections.has(s.id),
      "Unknown or duplicate section",
    );
    check(
      text(s.title) && points(s.maxPoints) && s.maxPoints > 0,
      `Invalid section: ${s.id}`,
    );
    sections.set(s.id, s);
  }
  for (const f of exam.fields) {
    check(
      object(f) &&
        typeof f.id === "string" &&
        /^[A-Za-z0-9_\-\u3040-\u30ff]{1,100}$/.test(f.id) &&
        !fields.has(f.id) &&
        sections.has(f.sectionId) &&
        text(f.label),
      "Invalid or duplicate field",
    );
    let values;
    if (f.type === "text") {
      check(
        f.maxLength === 1 &&
          typeof f.allowed === "string" &&
          /^[0-9A-F]+$/.test(f.allowed),
        `RPC requires a single 0–9/A–F mark: ${f.id}`,
      );
      values = [...f.allowed];
    } else {
      check(
        f.type === "choice" && Array.isArray(f.choices) && f.choices.length > 0,
        `Missing choices: ${f.id}`,
      );
      check(
        f.choices.every(
          (c) =>
            object(c) &&
            typeof c.value === "string" &&
            /^[0-9A-F]$/.test(c.value) &&
            text(c.text) &&
            (c.parts === undefined ||
              (Array.isArray(c.parts) && c.parts.every(text))),
        ),
        `Invalid choice: ${f.id}`,
      );
      values = f.choices.map((c) => c.value);
    }
    check(
      new Set(values).size === values.length,
      `Duplicate answer value: ${f.id}`,
    );
    fields.set(f.id, { ...f, values });
  }
  function condition(c, unit, depth = 0) {
    check(object(c) && depth < 12, `Invalid condition: ${unit.id}`);
    const keys = ["all", "any", "field", "unit"].filter((k) =>
      Object.hasOwn(c, k),
    );
    check(keys.length === 1, `Ambiguous condition: ${unit.id}`);
    if (keys[0] === "all" || keys[0] === "any") {
      check(
        Array.isArray(c[keys[0]]) && c[keys[0]].length > 0,
        `Empty condition: ${unit.id}`,
      );
      c[keys[0]].forEach((v) => condition(v, unit, depth + 1));
    } else if (c.field) {
      const f = fields.get(c.field);
      check(
        f?.sectionId === unit.sectionId && ["", ...f.values].includes(c.equals),
        `Unknown/cross-section condition field: ${unit.id}`,
      );
    } else {
      const prev = preceding.get(c.unit);
      check(
        prev?.sectionId === unit.sectionId &&
          points(c.atLeast, prev?.maxPoints),
        `Scoring dependency must precede ${unit.id} in the same section`,
      );
    }
  }
  function rule(r, unit, depth = 0) {
    check(object(r) && depth < 12, `Invalid rule: ${unit.id}`);
    function pattern(p, unordered = false) {
      check(
        Array.isArray(p) && p.length === unit.fields.length,
        `Pattern width mismatch: ${unit.id}`,
      );
      p.forEach((v, i) => {
        const targets = unordered ? unit.fields : [unit.fields[i]];
        check(
          targets.every((id) => ["", ...fields.get(id).values].includes(v)),
          `Answer outside field choices: ${unit.id}`,
        );
      });
    }
    if (r.kind === "conditional") {
      condition(r.when, unit);
      rule(r.then, unit, depth + 1);
      rule(r.else, unit, depth + 1);
    } else if (["exact", "unordered", "unordered-partial"].includes(r.kind)) {
      check(
        Array.isArray(r.patterns) && r.patterns.length > 0,
        `Missing patterns: ${unit.id}`,
      );
      r.patterns.forEach((p) => {
        pattern(p, r.kind !== "exact");
        check(
          p.every((v) => v !== ""),
          `Blank in correct pattern: ${unit.id}`,
        );
      });
      if (r.kind === "unordered-partial")
        check(
          Array.isArray(r.pointsByMatches) &&
            r.pointsByMatches.length === unit.fields.length + 1 &&
            r.pointsByMatches[0] === 0 &&
            r.pointsByMatches.at(-1) === unit.maxPoints &&
            r.pointsByMatches.every(
              (v, i, a) => points(v, unit.maxPoints) && (!i || v >= a[i - 1]),
            ),
          `Invalid partial credit: ${unit.id}`,
        );
    } else if (r.kind === "cases") {
      check(
        Array.isArray(r.cases) && r.cases.length > 0,
        `Missing cases: ${unit.id}`,
      );
      for (const c of r.cases) {
        check(
          object(c) &&
            points(c.points, unit.maxPoints) &&
            (c.unordered === undefined || typeof c.unordered === "boolean"),
          `Invalid case: ${unit.id}`,
        );
        pattern(c.answers, c.unordered);
        if (c.when !== undefined) condition(c.when, unit);
        check(
          c.points === 0 || c.answers.some((v) => v !== ""),
          `Blank earns points: ${unit.id}`,
        );
      }
      check(
        r.cases.some((c) => c.points === unit.maxPoints),
        `No full-credit case: ${unit.id}`,
      );
    } else throw Error(`Unknown scoring kind: ${r.kind}`);
  }
  const covered = new Set();
  let previousSection = -1,
    previousQuestion = 0;
  for (const u of exam.scoring) {
    check(
      object(u) && rpcId(u.id) && !preceding.has(u.id),
      "Invalid or duplicate scoring ID",
    );
    const sectionIndex = [...sections.keys()].indexOf(u.sectionId);
    check(
      sectionIndex >= previousSection && sectionIndex >= 0,
      `Scoring section order: ${u.id}`,
    );
    if (sectionIndex !== previousSection) previousQuestion = 0;
    check(
      Number.isInteger(u.question) &&
        u.question > 0 &&
        u.question >= previousQuestion,
      `Missing or out-of-order question number: ${u.id}`,
    );
    previousSection = sectionIndex;
    previousQuestion = u.question;
    check(
      points(u.maxPoints) && u.maxPoints > 0,
      `Invalid unit points: ${u.id}`,
    );
    check(
      Array.isArray(u.fields) && u.fields.length > 0 && u.fields.length <= 64,
      `Invalid unit width: ${u.id}`,
    );
    for (const id of u.fields) {
      check(
        fields.get(id)?.sectionId === u.sectionId && !covered.has(id),
        `Unknown, cross-section or duplicate scored field: ${id}`,
      );
      covered.add(id);
    }
    rule(u.rule, u);
    preceding.set(u.id, u);
  }
  check(covered.size === fields.size, "Unscored field");
  for (const s of exam.sections)
    check(
      Math.abs(
        exam.scoring
          .filter((u) => u.sectionId === s.id)
          .reduce((n, u) => n + u.maxPoints, 0) - s.maxPoints,
      ) < 1e-9,
      `Section points mismatch: ${s.id}`,
    );
  check(
    Math.abs(
      exam.sections.reduce((n, s) => n + s.maxPoints, 0) - exam.maxPoints,
    ) < 1e-9,
    "Exam points mismatch",
  );
}
