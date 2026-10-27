import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createAttempt,
  submit,
  resume,
  pause,
  startReview,
  gradeReview,
  restoreAttempt,
  AttemptStore,
} from "../engine/attempt.mjs";
import { sendUnsentUnits } from "../engine/submission.mjs";
import { fetchStats, recordBody } from "../engine/stats.mjs";
import { calculateStats, grade } from "../engine/scoring.mjs";
export const exam = JSON.parse(
  readFileSync(new URL("../exams/001/1/exam.json", import.meta.url)),
);
export function memoryStore() {
  const data = new Map();
  const storage = {
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i],
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
  };
  return { store: new AttemptStore(storage), data, storage };
}
const ok = (count) => Response.json({ updated_count: count });
const graded = (answers = {}) => {
  const a = createAttempt(exam, "untimed");
  a.answers = answers;
  submit(exam, a);
  return a;
};

test("RPC contract: integer version, exact field names, items envelope and input limits", async () => {
  const a = graded({ "q1-ア": "0", "q2a-イ": "1" }),
    units = a.result.units.filter((u) => u.answered);
  assert.deepEqual(recordBody(exam, units), {
    p_exam_id: "001",
    p_exam_version: 1,
    p_results: [
      {
        section_id: "q1",
        scoring_id: "q1-01",
        answer: "0",
        earned_points: 2,
        max_points: 2,
      },
      {
        section_id: "q2a",
        scoring_id: "q2a-02",
        answer: "1|_",
        earned_points: 0,
        max_points: 3,
      },
    ],
  });
  const rows = await fetchStats(exam, async (url, req) => {
    assert.ok(url.endsWith("/get_mock_exam_stats"));
    assert.equal(JSON.parse(req.body).p_exam_version, 1);
    return Response.json({ items: [] });
  });
  assert.deepEqual(rows, []);
  await assert.rejects(fetchStats(exam, async () => Response.json([])));
  assert.throws(() => recordBody({ ...exam, version: "1.0.0" }, units));
  assert.throws(() => recordBody(exam, [{ ...units[0], answerKey: "AB" }]));
  assert.throws(() => recordBody(exam, [{ ...units[0], points: 2.001 }]));
  assert.throws(() => recordBody(exam, [units[0], units[0]]));
});

test("first answered units only; partial mark stays frozen; resume and review never resend", async () => {
  const { store, data } = memoryStore(),
    bodies = [],
    a = graded({ "q1-ア": "1", "q2a-イ": "1" });
  store.save(a);
  const request = async (_url, req) => {
    const body = JSON.parse(req.body);
    bodies.push(body);
    for (const raw of data.values())
      for (const u of body.p_results)
        assert.equal(
          JSON.parse(raw).statsDelivery[u.scoring_id].state,
          "sending",
        );
    return ok(body.p_results.length);
  };
  assert.equal((await sendUnsentUnits(exam, a, store, { request })).count, 2);
  resume(a);
  a.answers = { "q1-ア": "0", "q2a-イ": "1", "q2a-ウ": "5", "q1-イ": "3" };
  submit(exam, a);
  store.save(a);
  await sendUnsentUnits(exam, a, store, { request });
  assert.deepEqual(
    bodies[1].p_results.map((x) => x.scoring_id),
    ["q1-02"],
  );
  assert.equal(a.result.units.find((x) => x.id === "q2a-02").points, 3);
  startReview(exam, a);
  a.review.answers = { "q1-ア": "0" };
  gradeReview(exam, a);
  await sendUnsentUnits(exam, a, store, { source: "review", request });
  assert.equal(bodies.length, 2);
  const reloaded = restoreAttempt(exam, store.load(a.id));
  await sendUnsentUnits(exam, reloaded, store, { request });
  assert.equal(bodies.length, 2);
  const retry = graded({ "q1-ア": "0" });
  store.save(retry);
  await sendUnsentUnits(exam, retry, store, { request });
  assert.equal(bodies.length, 3);
  assert.notEqual(a.id, retry.id);
});

test("blank units and ungraded interruption never call RPC", async () => {
  const { store } = memoryStore();
  let calls = 0;
  const request = async () => {
    calls++;
    return ok(0);
  };
  const blank = graded();
  store.save(blank);
  await sendUnsentUnits(exam, blank, store, { request });
  const active = createAttempt(exam, "untimed");
  active.answers = { "q1-ア": "0" };
  pause(active);
  store.save(active);
  await sendUnsentUnits(exam, active, store, { request });
  assert.equal(calls, 0);
});

test("lost response is unknown and never retried after reload, backup recovery or older import", async () => {
  const { store, data } = memoryStore(),
    a = graded({ "q1-ア": "0" }),
    old = structuredClone(a);
  store.save(a);
  let calls = 0;
  await sendUnsentUnits(exam, a, store, {
    request: async () => {
      calls++;
      throw Error("response lost after commit");
    },
  });
  assert.equal(a.statsDelivery["q1-01"].state, "unknown");
  old.updatedAt = Date.now() + 100;
  store.save(old);
  assert.equal(old.statsDelivery["q1-01"].state, "unknown");
  const key = [...data.keys()].find((k) => !k.endsWith(":backup"));
  data.set(key, "corrupted");
  const copy = restoreAttempt(exam, store.load(a.id));
  await sendUnsentUnits(exam, copy, store, {
    request: async () => {
      calls++;
      return ok(1);
    },
  });
  assert.equal(calls, 1);
  assert.equal(
    JSON.parse(store.export()).attempts[0].statsDelivery["q1-01"].state,
    "unknown",
  );
});

test("unloading during send recovers sending as unknown; failures keep personal grade", async () => {
  for (const request of [
    async () => new Response("", { status: 500 }),
    async () => Response.json({ updated_count: 0 }),
    async () => new Response("broken"),
  ]) {
    const { store } = memoryStore(),
      a = graded({ "q1-ア": "0" });
    store.save(a);
    await sendUnsentUnits(exam, a, store, { request });
    assert.equal(store.load(a.id).statsDelivery["q1-01"].state, "unknown");
    assert.equal(store.load(a.id).result.points, 2);
  }
  const { store } = memoryStore(),
    a = graded({ "q1-ア": "0" });
  a.statsDelivery = { "q1-01": { state: "sending", attemptedAt: 1 } };
  store.save(a);
  assert.equal(
    restoreAttempt(exam, store.load(a.id)).statsDelivery["q1-01"].state,
    "unknown",
  );
});

test("storage failure blocks network; lost local acknowledgement retains durable sending fence", async () => {
  const { store, storage } = memoryStore(),
    a = graded({ "q1-ア": "0" });
  store.save(a);
  let calls = 0;
  const save = storage.setItem;
  storage.setItem = () => {
    throw Error("quota");
  };
  assert.equal(
    (
      await sendUnsentUnits(exam, a, store, {
        request: async () => {
          calls++;
          return ok(1);
        },
      })
    ).status,
    "storage-error",
  );
  assert.equal(calls, 0);
  assert.equal(store.load(a.id).result.points, 2);
  storage.setItem = save;
  const b = graded({ "q1-ア": "0" });
  store.save(b);
  await sendUnsentUnits(exam, b, store, {
    request: async () => {
      storage.setItem = () => {
        throw Error("quota after commit");
      };
      return ok(1);
    },
  });
  assert.equal(
    restoreAttempt(exam, store.load(b.id)).statsDelivery["q1-01"].state,
    "unknown",
  );
});

test("overlapping grades serialize new units, late replies preserve latest personal result", async () => {
  const { store } = memoryStore(),
    a = graded({ "q1-ア": "1" });
  store.save(a);
  let release;
  const waiting = new Promise((r) => (release = r)),
    bodies = [];
  const request = async (_url, req) => {
    const body = JSON.parse(req.body);
    bodies.push(body);
    if (bodies.length === 1) await waiting;
    return ok(body.p_results.length);
  };
  const first = sendUnsentUnits(exam, a, store, { request });
  resume(a);
  a.answers = { "q1-ア": "0", "q1-イ": "3" };
  submit(exam, a);
  store.save(a);
  const second = sendUnsentUnits(exam, a, store, { request });
  release();
  await Promise.all([first, second]);
  assert.equal(bodies.length, 2);
  assert.deepEqual(
    bodies[1].p_results.map((x) => x.scoring_id),
    ["q1-02"],
  );
  assert.equal(store.load(a.id).result.points, a.result.points);
  const stale = structuredClone(a);
  stale.statsDelivery = {};
  await sendUnsentUnits(exam, stale, store, { request });
  assert.equal(bodies.length, 2);
});

test("different denominators use per-unit averages; missing data never becomes zero", () => {
  const rows = exam.scoring.map((u, i) => ({
    scoring_id: u.id,
    answered_count: i === 0 ? 100 : 2,
    correct_count: i === 0 ? 50 : 1,
    points_sum: ((i === 0 ? 100 : 2) * u.maxPoints) / 2,
  }));
  const s = calculateStats(exam, rows);
  assert.equal(s.total.points, 50);
  assert.equal(s.total.rate, 0.5);
  assert.equal(s.sections.q1.points, 10);
  assert.equal(s.sections.q2a.points, 7.5);
  assert.equal(s.units[0].average, 1);
  assert.equal(s.units[0].averageRate, 0.5);
  const missing = calculateStats(exam, rows.slice(1));
  assert.equal(missing.units[0].average, null);
  assert.equal(missing.sections.q1.points, null);
  assert.equal(missing.total.points, null);
  assert.equal(missing.sections.q2a.rate, 0.5);
  const zero = calculateStats(exam, [
    { scoring_id: "q1-01", answered_count: 0, correct_count: 0, points_sum: 0 },
  ]);
  assert.equal(zero.units[0].fullRate, null);
});

test("old development history version migrates to integer without losing answers", () => {
  const a = graded({ "q1-ア": "0" });
  a.examVersion = "1.0.0";
  const restored = restoreAttempt(exam, a);
  assert.equal(restored.examVersion, 1);
  assert.equal(restored.result.points, 2);
  assert.equal(restored.id, a.id);
});
