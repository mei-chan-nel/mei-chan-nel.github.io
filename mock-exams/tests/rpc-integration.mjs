/** Local HTTP + PostgreSQL using the user-supplied RPC definitions.
 * Not a production test. Only accepts a disposable atlas-mock-* container.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { runRpcVerification } from "./rpc-scenario.mjs";
import { statsConfig, rpcOptions } from "../engine/stats.mjs";
const container = process.argv[2];
assert.match(container || "", /^atlas-mock-/);
const run = promisify(execFile),
  env = { ...process.env };
for (const k of [
  "DOCKER_HOST",
  "DOCKER_CONTEXT",
  "DOCKER_TLS",
  "DOCKER_TLS_VERIFY",
  "DOCKER_CERT_PATH",
])
  delete env[k];
async function sql(query) {
  const { stdout } = await run(
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
    { env, maxBuffer: 1024 * 1024 },
  );
  return stdout.trim();
}
const q = (s) =>
  "'" +
  String(typeof s === "object" ? JSON.stringify(s) : s).replaceAll("'", "''") +
  "'";
await sql(`create role anon;create role authenticated;
 create table public.mock_exam_stats(exam_id text not null,exam_version integer not null,section_id text not null,scoring_id text not null,answer_counts jsonb not null default '{}',answered_count bigint not null default 0,correct_count bigint not null default 0,points_sum numeric not null default 0,updated_at timestamptz default now(),primary key(exam_id,exam_version,scoring_id));
 create table public.quiz_question_stats(question_id text primary key,answered_count integer);insert into public.quiz_question_stats values('legacy-sentinel',17);`);
await sql(
  await readFile(
    new URL(
      "../../docs/mock-exams/reference/existing-rpcs.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
await sql(`revoke all on public.mock_exam_stats from public,anon,authenticated;
 grant execute on function public.record_mock_exam_results(text,integer,jsonb) to anon;
 grant execute on function public.get_mock_exam_stats(text,integer) to anon;`);
const server = http.createServer(async (req, res) => {
  try {
    assert.equal(req.headers.apikey, statsConfig.publishableKey);
    const chunks = [];
    for await (const b of req) chunks.push(b);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    assert.equal(typeof body.p_exam_version, "number");
    assert.ok(Number.isInteger(body.p_exam_version));
    assert.match(body.p_exam_id, /^qa_mock_/);
    const name = req.url.split("/").at(-1);
    assert.ok(
      ["record_mock_exam_results", "get_mock_exam_stats"].includes(name),
    );
    const query = `set role anon;select public.${name}(${q(body.p_exam_id)},${body.p_exam_version}${name.startsWith("record") ? "," + q(body.p_results) + "::jsonb" : ""})`;
    const value = await sql(query);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(value);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "RPC rejected" }));
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const request = (url, options) =>
  fetch(
    "http://127.0.0.1:" + server.address().port + new URL(url).pathname,
    options,
  );
try {
  const report = await runRpcVerification({ request, log: console.log });
  assert.equal(report.passed, true, report.error);
  const keys = JSON.parse(
    await sql(
      `select answer_counts from public.mock_exam_stats where exam_id=${q(report.examId)} and scoring_id='pair'`,
    ),
  );
  assert.deepEqual(keys, { "1|_": 1, "2|1": 1 });
  const fixture = "qa_mock_invalid",
    post = (rows) =>
      request(
        statsConfig.url + "/rest/v1/rpc/record_mock_exam_results",
        rpcOptions({ p_exam_id: fixture, p_exam_version: 1, p_results: rows }),
      );
  const good = {
    section_id: "q1",
    scoring_id: "one",
    answer: "0",
    earned_points: 1.5,
    max_points: 2,
  };
  for (const rows of [
    [good, good],
    [good, { ...good, scoring_id: "two", answer: "10" }],
    [{ ...good, earned_points: "1" }],
    [{ ...good, earned_points: 3 }],
    [{ ...good, earned_points: 1.001 }],
    [{ ...good, section_id: "bad" }],
  ])
    assert.equal((await post(rows)).status, 400);
  assert.equal(
    await sql(
      `select count(*) from public.mock_exam_stats where exam_id=${q(fixture)}`,
    ),
    "0",
  );
  assert.equal((await post([{ ...good, answer: "_|_" }])).status, 200);
  assert.equal(
    await sql(
      `select count(*) from public.mock_exam_stats where exam_id=${q(fixture)}`,
    ),
    "0",
  );
  await assert.rejects(
    sql(
      "set role anon;insert into public.mock_exam_stats(exam_id,exam_version,section_id,scoring_id)values('qa_mock_forbidden',1,'q1','one')",
    ),
  );
  assert.equal(
    await sql(
      "select answered_count from public.quiz_question_stats where question_id='legacy-sentinel'",
    ),
    "17",
  );
  assert.equal(
    await sql(
      "select count(*) from public.mock_exam_stats where exam_id='001'",
    ),
    "0",
  );
  console.log(
    "PASS: supplied SQL validates inputs atomically, preserves answer order, denies direct writes, leaves existing app and No.001 unchanged",
  );
  console.log(
    "LOCAL ONLY: HTTP/PostgreSQL verified; hosted Supabase gateway not exercised.",
  );
} finally {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}
