// Web Request/Response handler shared by Deno deployment and HTTP tests.
import { grade, validateExam } from "../engine/scoring.mjs";

export const PROTOCOL = 2;
export const VERIFY_EXAM_ID = "__verify_001";
const uuid = (s) =>
  typeof s === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
export const sha256 = async (s) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");

export function createHandler({ exams, env, request = fetch }) {
  for (const e of exams.values()) validateExam(e);
  return async function handle(req) {
    const allowed = env("MOCK_EXAM_ALLOWED_ORIGIN");
    const headers = {
      "Access-Control-Allow-Origin": allowed || "null",
      "Access-Control-Allow-Headers": "content-type, apikey",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Cache-Control": "no-store",
      Vary: "Origin",
      "Content-Type": "application/json",
    };
    const reply = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers });
    if (!allowed || req.headers.get("origin") !== allowed)
      return reply({ error: "origin" }, 403);
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (!["GET", "POST"].includes(req.method))
      return reply({ error: "method" }, 405);
    const url = env("SUPABASE_URL"),
      key = env("SUPABASE_SERVICE_ROLE_KEY"),
      secret = env("MOCK_EXAM_TURNSTILE_SECRET"),
      sitekey = env("MOCK_EXAM_TURNSTILE_SITE_KEY");
    if (
      !url ||
      !key ||
      !secret ||
      !sitekey ||
      env("MOCK_EXAM_ENABLED") !== "true"
    )
      return reply({ error: "not_configured" }, 503);
    async function rpc(name, body) {
      const r = await request(url + "/rest/v1/rpc/" + name, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) throw Error("database_unavailable");
      return r.json();
    }
    try {
      if (req.method === "GET") {
        if ((await rpc("mock_exam_stats_health", {})) !== PROTOCOL)
          throw Error("database_unavailable");
        return reply({
          protocol: PROTOCOL,
          ready: true,
          turnstileSiteKey: sitekey,
          verificationEnabled: env("MOCK_EXAM_VERIFICATION_ENABLED") === "true",
        });
      }
      if (
        !req.headers
          .get("content-type")
          ?.toLowerCase()
          .startsWith("application/json")
      )
        return reply({ error: "content_type" }, 415);
      const reader = req.body?.getReader();
      if (!reader) return reply({ error: "body" }, 400);
      let size = 0;
      const parts = [];
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 32768) {
          await reader.cancel();
          return reply({ error: "size" }, 413);
        }
        parts.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const part of parts) {
        bytes.set(part, offset);
        offset += part.length;
      }
      let body;
      try {
        body = JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        return reply({ error: "json" }, 400);
      }
      if (!object(body)) return reply({ error: "body" }, 400);
      if (body.kind !== "attempt-grade")
        return reply({ error: "not_an_exam_grade" }, 400);
      const fields = new Set([
        "kind",
        "attemptId",
        "attemptToken",
        "examId",
        "examVersion",
        "revision",
        "sectionIds",
        "answers",
        "challengeToken",
        "challengeRequestId",
        "verificationRun",
      ]);
      if (Object.keys(body).some((k) => !fields.has(k)))
        return reply({ error: "unknown_field" }, 400);
      const e = exams.get(body.examId + "@" + body.examVersion);
      if (!e) return reply({ error: "exam_version" }, 400);
      if (
        !uuid(body.attemptId) ||
        typeof body.attemptToken !== "string" ||
        !/^[0-9a-f]{64}$/.test(body.attemptToken) ||
        !Number.isSafeInteger(body.revision) ||
        body.revision < 1 ||
        body.revision > 10000
      )
        return reply({ error: "attempt" }, 400);
      if (
        !Array.isArray(body.sectionIds) ||
        !body.sectionIds.length ||
        new Set(body.sectionIds).size !== body.sectionIds.length ||
        body.sectionIds.some((s) => !e.sections.some((x) => x.id === s))
      )
        return reply({ error: "sections" }, 400);
      const allowedFields = new Set(
        e.fields
          .filter((f) => body.sectionIds.includes(f.sectionId))
          .map((f) => f.id),
      );
      if (
        !object(body.answers) ||
        Object.keys(body.answers).some((k) => !allowedFields.has(k))
      )
        return reply({ error: "answers" }, 400);
      if (
        typeof body.challengeToken !== "string" ||
        !body.challengeToken.length ||
        body.challengeToken.length > 2048 ||
        !uuid(body.challengeRequestId)
      )
        return reply({ error: "challenge_input" }, 400);
      const verifying = body.verificationRun !== undefined;
      if (
        verifying &&
        (env("MOCK_EXAM_VERIFICATION_ENABLED") !== "true" ||
          e.id !== "001" ||
          !uuid(body.verificationRun))
      )
        return reply({ error: "verification_disabled" }, 403);
      let graded;
      try {
        graded = grade(e, body.answers, body.sectionIds);
      } catch {
        return reply({ error: "answer_value" }, 400);
      }
      const challengeResponse = await request(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({
            secret,
            response: body.challengeToken,
            idempotency_key: body.challengeRequestId,
          }),
        },
      );
      if (!challengeResponse.ok) throw Error("challenge_unavailable");
      const challenge = await challengeResponse.json();
      if (
        !challenge.success ||
        challenge.hostname !== new URL(allowed).hostname ||
        challenge.action !== "mock-exam-submit"
      )
        return reply({ error: "challenge" }, 403);
      const tokenHash = await sha256(body.attemptToken);
      // No trust in client-controlled X-Forwarded-For. SQL limits each token AND
      // the entire endpoint, after a verified challenge.
      if (
        !(await rpc("consume_mock_exam_budget", { p_identity_hash: tokenHash }))
      )
        return reply({ error: "rate_limit" }, 429);
      const result = await rpc("replace_mock_exam_results", {
        p_attempt_id: body.attemptId,
        p_token_hash: tokenHash,
        p_exam_id: verifying ? VERIFY_EXAM_ID : e.id,
        p_exam_version: verifying ? body.verificationRun : e.version,
        p_revision: body.revision,
        p_section_ids: [...body.sectionIds].sort(),
        p_results: graded.units
          .filter((u) => u.answered)
          .map((u) => ({
            section_id: u.sectionId,
            scoring_id: u.id,
            answer_key: u.answerKey,
            points: u.points,
            max_points: u.maxPoints,
          })),
      });
      if (result.status === "conflict") return reply(result, 409);
      return reply(result);
    } catch {
      // Never log or return request bodies, tokens, keys or database details.
      return reply({ error: "upstream_unavailable" }, 503);
    }
  };
}
