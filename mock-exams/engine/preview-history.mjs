// Activated only by the Sites preview's explicit metadata. These personal sample
// attempts are never submitted to anonymous statistics, including after import.
import { createAttempt, submit, pause } from "./attempt.mjs";
import { correctPatterns } from "./scoring.mjs";
export async function seedPreviewHistory(
  catalog,
  store,
  request = fetch,
  now = Date.now(),
) {
  const entry = catalog.find((e) => e.id === "001");
  if (!entry) return;
  const ids = Array.from(
    { length: 6 },
    (_, i) => `00000000-0000-4000-8000-${String(i + 101).padStart(12, "0")}`,
  );
  if (ids.every((id) => store.load(id))) return;
  const response = await request(new URL(entry.manifest, location.href));
  if (!response.ok) throw Error("Sample exam unavailable");
  const exam = await response.json();
  const specifications = [
    ["untimed", null, 0.46, 3000, "final"],
    ["untimed", null, 0.65, 2840, "final"],
    ["untimed", null, 0.84, 2630, "final"],
    ["section", "q3", 0.53, 920, "final"],
    ["section", "q3", 0.82, 810, "final"],
    ["section", "q2b", 0.4, 280, "interim"],
  ];
  for (const [
    index,
    [mode, sectionId, fraction, seconds, kind],
  ] of specifications.entries()) {
    // A deletion tombstone also counts as already prepared: never restore a
    // sample that the learner deleted, and never replace their existing work.
    if (store.load(ids[index])) continue;
    const created = now - (7 - index) * 86400000;
    const a = createAttempt(exam, mode, sectionId, created);
    a.id = ids[index];
    a.isSample = true;
    const units = exam.scoring.filter((u) =>
      a.sectionIds.includes(u.sectionId),
    );
    for (const [i, unit] of units.entries()) {
      const expected = correctPatterns(unit.rule)[0];
      for (const [j, id] of unit.fields.entries()) {
        const field = exam.fields.find((f) => f.id === id);
        const correct = i < Math.round(units.length * fraction);
        a.answers[id] = correct
          ? expected[j]
          : field.type === "choice"
            ? field.choices.find((c) => c.value !== expected[j]).value
            : [...field.allowed].find((c) => c !== expected[j]);
      }
    }
    submit(exam, a, created + seconds * 1000);
    a.gradingKind = kind;
    if (kind === "interim") pause(a, created + seconds * 1000);
    store.save(a);
  }
}
