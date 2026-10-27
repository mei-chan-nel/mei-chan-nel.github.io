/** Real local HTTP + real disposable Postgres, with a simulated Turnstile provider
 * and PostgREST transport. Never accepts a production DB URL or a service key.
 * Usage: node mock-exams/tests/server-http.mjs atlas-mock-stats-v2
 */
import assert from "node:assert/strict";
import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { createHandler, VERIFY_EXAM_ID } from "../server/handler.mjs";
import {
  createAttempt,
  submit,
  resume,
  startReview,
  gradeReview,
  restoreAttempt,
} from "../engine/attempt.mjs";
import { queueSubmission, sendPending } from "../engine/outbox.mjs";
import { fetchStats, fetchSubmissionConfig } from "../engine/stats.mjs";
const container = process.argv[2];
assert.match(container || "", /^atlas-mock-/);
const exec = promisify(execFile);
const dockerEnv = { ...process.env };
for (const name of [
  "DOCKER_HOST",
  "DOCKER_CONTEXT",
  "DOCKER_TLS",
  "DOCKER_TLS_VERIFY",
  "DOCKER_CERT_PATH",
])
  delete dockerEnv[name];
const q = (value) =>
  "'" +
  String(typeof value === "object" ? JSON.stringify(value) : value).replaceAll(
    "'",
    "''",
  ) +
  "'";
async function sql(query) {
  const { stdout } = await exec(
    "docker",
    [
      "--host=unix:///var/run/docker.sock",
      "exec",
      container,
      "psql",
      "-U",
      "postgres",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      query,
    ],
    { env: dockerEnv, maxBuffer: 1024 * 1024 },
  );
  return stdout.trim();
}
const exam = JSON.parse(
  await readFile(new URL("../exams/001/1.0.0/exam.json", import.meta.url)),
);
const origin = "https://mei-chan-nel.com";
const variables = {
  SUPABASE_URL: "https://database.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "local-test-only",
  MOCK_EXAM_ENABLED: "true",
  MOCK_EXAM_ALLOWED_ORIGIN: origin,
  MOCK_EXAM_TURNSTILE_SECRET: "local-challenge-only",
  MOCK_EXAM_TURNSTILE_SITE_KEY: "local-public",
  MOCK_EXAM_VERIFICATION_ENABLED: "true",
};
let challengeChecks = 0,
  replacements = 0;
const handler = createHandler({
  exams: new Map([["001@1.0.0", exam]]),
  env: (k) => variables[k] || "",
  request: async (url, init) => {
    const b = JSON.parse(init.body);
    if (url.startsWith("https://challenges.cloudflare.com/")) {
      challengeChecks++;
      assert.equal(b.secret, "local-challenge-only");
      assert.equal(b.remoteip, undefined);
      return Response.json({
        success: b.response === "test-ok",
        hostname: new URL(origin).hostname,
        action: "mock-exam-submit",
      });
    }
    assert.equal(init.headers.apikey, "local-test-only");
    assert.equal(init.headers.Authorization, "Bearer local-test-only");
    const name = new URL(url).pathname.split("/").at(-1);
    let query;
    if (name === "mock_exam_stats_health")
      query = "select public.mock_exam_stats_health()";
    else if (name === "consume_mock_exam_budget")
      query = `select public.consume_mock_exam_budget(${q(b.p_identity_hash)})`;
    else if (name === "replace_mock_exam_results") {
      replacements++;
      query = `select public.replace_mock_exam_results(${q(b.p_attempt_id)}::uuid,${q(b.p_token_hash)},${q(b.p_exam_id)},${q(b.p_exam_version)},${b.p_revision},${q(b.p_section_ids)}::jsonb,${q(b.p_results)}::jsonb)`;
    } else throw Error("unexpected RPC");
    const result = await sql("set role service_role;" + query);
    return Response.json(
      result === "t" ? true : result === "f" ? false : JSON.parse(result),
    );
  },
});
const server = http.createServer(async (req, res) => {
  try {
    const bytes = [];
    for await (const part of req) bytes.push(part);
    const request = new Request("http://localhost" + req.url, {
      method: req.method,
      headers: req.headers,
      ...(req.method === "GET" || req.method === "HEAD"
        ? {}
        : { body: Buffer.concat(bytes) }),
    });
    const response = await handler(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const endpoint = "http://127.0.0.1:" + server.address().port;
const run = crypto.randomUUID();
const config = { submitUrl: endpoint, publishableKey: "public-test-only" };
const post = (body, extra = {}) =>
  fetch(endpoint, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", ...extra },
    body: JSON.stringify(body),
  });
const payload = (a, extra = {}) => ({
  ...a.pendingSubmission,
  challengeToken: "test-ok",
  challengeRequestId: crypto.randomUUID(),
  verificationRun: run,
  ...extra,
});
async function stats() {
  return fetchStats(
    { id: VERIFY_EXAM_ID, version: run },
    async (_url, init) => {
      const b = JSON.parse(init.body);
      assert.equal(init.headers.apikey.startsWith("sb_publishable_"), true);
      return Response.json(
        JSON.parse(
          await sql(
            `select coalesce(json_agg(t),'[]') from public.get_mock_exam_stats(${q(b.p_exam_id)},${q(b.p_exam_version)}) t`,
          ),
        ),
      );
    },
  );
}
const row = async (id) => (await stats()).find((r) => r.scoring_id === id);
const state = (r) => [
  Number(r.answered_count),
  Number(r.correct_count),
  Number(r.points_sum),
];
try {
  const initial001 = await sql(
    "select md5(coalesce(json_agg(t order by scoring_id)::text,'')) from public.mock_exam_stats t where exam_id='001'",
  );
  const c = await fetchSubmissionConfig((_url, init) =>
    fetch(endpoint, { ...init, headers: { ...init.headers, Origin: origin } }),
  );
  assert.equal(c.turnstileSiteKey, "local-public");
  assert.equal(c.verificationEnabled, true);
  const preflight = await fetch(endpoint, {
    method: "OPTIONS",
    headers: { Origin: origin },
  });
  assert.equal(preflight.status, 204);
  const a = createAttempt(exam, "section", "q2a");
  a.answers = { "q2a-イ": "1" };
  submit(exam, a);
  queueSubmission(exam, a);
  const first = payload(a);
  let r = await post(first);
  assert.deepEqual(await r.json(), { status: "recorded", revision: 1 });
  assert.deepEqual(state(await row("q2a-02")), [1, 0, 0]);
  assert.deepEqual((await row("q2a-02")).answer_counts, { "1|_": 1 });
  const request = async (_url, init) =>
    post({ ...JSON.parse(init.body), verificationRun: run });
  // A committed response lost on the wire keeps the durable outbox. Retry is exact.
  await assert.rejects(
    sendPending(a, config, "test-ok", async (...args) => {
      await request(...args);
      throw Error("response lost");
    }),
  );
  assert.equal(a.pendingSubmission.revision, 1);
  const restored = restoreAttempt(exam, a);
  await sendPending(restored, config, "test-ok", request);
  assert.equal(restored.pendingSubmission, undefined);
  assert.deepEqual(state(await row("q2a-02")), [1, 0, 0]);
  resume(a);
  a.answers["q2a-ウ"] = "5";
  submit(exam, a);
  queueSubmission(exam, a);
  r = await post(payload(a));
  assert.equal((await r.json()).status, "recorded");
  assert.deepEqual(state(await row("q2a-02")), [1, 1, 3]);
  // Review uses separate answer state and cannot create a new queued revision.
  const pending = structuredClone(a.pendingSubmission);
  startReview(exam, a);
  a.review.answers = { "q2a-イ": "0" };
  gradeReview(exam, a);
  assert.equal(queueSubmission(exam, a, { source: "review" }), false);
  assert.deepEqual(a.pendingSubmission, pending);
  assert.equal((await post(payload(a, { kind: "review" }))).status, 400);
  assert.deepEqual(state(await row("q2a-02")), [1, 1, 3]);
  const b = createAttempt(exam, "section", "q2a");
  b.answers = { "q2a-イ": "5", "q2a-ウ": "1" };
  submit(exam, b);
  queueSubmission(exam, b);
  const simultaneous = await Promise.all([post(payload(b)), post(payload(b))]);
  assert.deepEqual(
    (await Promise.all(simultaneous.map((x) => x.json())))
      .map((x) => x.status)
      .sort(),
    ["duplicate", "recorded"],
  );
  assert.deepEqual(state(await row("q2a-02")), [2, 2, 6]);
  assert.deepEqual((await row("q2a-02")).answer_counts, { "1|5": 1, "5|1": 1 });
  resume(a);
  a.answers = {};
  submit(exam, a);
  queueSubmission(exam, a);
  await post(payload(a));
  assert.deepEqual(state(await row("q2a-02")), [1, 1, 3]);
  r = await post(first);
  assert.deepEqual(await r.json(), { status: "stale", revision: 3 });
  assert.equal(
    (await post(payload(a, { answers: { "q2a-イ": "1" } }))).status,
    409,
  );
  assert.equal(
    (await post(payload(a, { attemptToken: "f".repeat(64) }))).status,
    409,
  );
  assert.equal(
    (await post(payload(a, { sectionIds: ["q1"], revision: 4 }))).status,
    409,
  );
  console.log(
    "PASS: real HTTP/DB partial grade, lost response/retry, resume/regrade, review exclusion, repeat attempt, blanks, stale/conflict/scope",
  );
  // Empty initial submission cannot create a phantom aggregate count.
  const blank = createAttempt(exam, "section", "q1");
  submit(exam, blank);
  queueSubmission(exam, blank);
  await post(payload(blank));
  assert.equal(
    (await stats()).some((x) => x.section_id === "q1"),
    false,
  );
  const before = replacements;
  for (const [body, status] of [
    [null, 400],
    [[], 400],
    [payload(a, { points: 100 }), 400],
    [payload(a, { answers: { "q2a-イ": "99" } }), 400],
    [payload(a, { answers: { "q1-ア": "0" } }), 400],
    [payload(a, { challengeToken: "bad" }), 403],
    [payload(a, { examVersion: "unknown" }), 400],
    [payload(a, { attemptId: "-".repeat(36) }), 400],
    [payload(a, { extra: "x".repeat(33000) }), 413],
  ])
    assert.equal((await post(body)).status, status);
  assert.equal(
    (await post(payload(a), { Origin: "https://elsewhere.invalid" })).status,
    403,
  );
  assert.equal(
    (
      await fetch(endpoint, {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: "{",
      })
    ).status,
    400,
  );
  assert.equal(replacements, before);
  variables.MOCK_EXAM_VERIFICATION_ENABLED = "false";
  assert.equal((await post(payload(a))).status, 403);
  variables.MOCK_EXAM_ENABLED = "false";
  assert.equal((await post(payload(a))).status, 503);
  assert.equal(
    await sql(
      "select md5(coalesce(json_agg(t order by scoring_id)::text,'')) from public.mock_exam_stats t where exam_id='001'",
    ),
    initial001,
  );
  assert.equal(
    await sql(
      "select answered_count from public.quiz_question_stats where question_id='legacy-sentinel'",
    ),
    "17",
  );
  console.log(
    "PASS: server recomputes scores; tampering/origin/challenge/size checks; verification isolation; existing app untouched",
  );
  console.log(
    "LOCAL ONLY: Turnstile and PostgREST transport simulated; Supabase production not exercised.",
  );
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
