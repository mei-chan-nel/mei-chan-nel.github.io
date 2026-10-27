// Supabase Edge Function entry point. Package engine/ and exams/ together with it.
// No remote imports; no client-supplied points are trusted. Not yet deployed.
import { grade, validateExam } from "../engine/scoring.mjs";
import exam001 from "../exams/001/1.0.0/exam.json" with { type: "json" };
const exams = new Map([["001@1.0.0", exam001]]);
for (const e of exams.values()) validateExam(e);
const env = (k: string) => Deno.env.get(k) || "";
const sha = async (s: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
Deno.serve(async (req: Request) => {
  const allowed = env("MOCK_EXAM_ALLOWED_ORIGIN");
  const headers = {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
    "Content-Type": "application/json",
  };
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  if (!allowed || req.headers.get("Origin") !== allowed)
    return reply({ error: "origin" }, 403);
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply({ error: "method" }, 405);
  const url = env("SUPABASE_URL"),
    key = env("SUPABASE_SERVICE_ROLE_KEY"),
    secret = env("MOCK_EXAM_TURNSTILE_SECRET"),
    salt = env("MOCK_EXAM_IP_SALT");
  if (!url || !key || !secret || !salt)
    return reply({ error: "not configured" }, 503);
  async function rpc(name: string, body: unknown) {
    const r = await fetch(url + "/rest/v1/rpc/" + name, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw Error("RPC failure");
    return r.json();
  }
  try {
    // Bounded streaming read also rejects chunked requests without Content-Length.
    const reader = req.body?.getReader();
    if (!reader) return reply({ error: "body" }, 400);
    let size = 0,
      parts: Uint8Array[] = [];
    while (true) {
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
    const body = JSON.parse(new TextDecoder().decode(bytes));
    // Deployment must verify this gateway-supplied IP header cannot be spoofed.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (!ip) return reply({ error: "gateway identity missing" }, 503);
    if (
      !(await rpc("consume_mock_exam_budget", {
        p_identity_hash: await sha(salt + ":" + ip),
      }))
    )
      return reply({ error: "rate limit" }, 429);
    const e = exams.get(body.examId + "@" + body.examVersion);
    if (!e) return reply({ error: "exam version" }, 400);
    if (
      !/^[0-9a-f-]{36}$/.test(body.attemptId) ||
      !/^([0-9a-f]{64})$/.test(body.attemptToken) ||
      !Number.isSafeInteger(body.revision) ||
      body.revision < 1 ||
      body.revision > 10000
    )
      return reply({ error: "attempt" }, 400);
    if (
      !Array.isArray(body.sectionIds) ||
      !body.sectionIds.length ||
      new Set(body.sectionIds).size !== body.sectionIds.length ||
      body.sectionIds.some((s: string) => !e.sections.some((x) => x.id === s))
    )
      return reply({ error: "sections" }, 400);
    if (
      !body.answers ||
      typeof body.answers !== "object" ||
      Array.isArray(body.answers)
    )
      return reply({ error: "answers" }, 400);
    const allowedFields = new Set(
      e.fields
        .filter((f) => body.sectionIds.includes(f.sectionId))
        .map((f) => f.id),
    );
    if (Object.keys(body.answers).some((k) => !allowedFields.has(k)))
      return reply({ error: "answer fields" }, 400);
    const challenge = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret,
          response: body.challengeToken,
          remoteip: ip,
          idempotency_key: body.challengeRequestId,
        }),
      },
    ).then((r) => r.json());
    if (
      !challenge.success ||
      challenge.hostname !== new URL(allowed).hostname ||
      challenge.action !== "mock-exam-submit"
    )
      return reply({ error: "challenge" }, 403);
    const graded = grade(e, body.answers, body.sectionIds);
    const results = graded.units
      .filter((u) => u.answered)
      .map((u) => ({
        section_id: u.sectionId,
        scoring_id: u.id,
        answer_key: u.answerKey,
        points: u.points,
        max_points: u.maxPoints,
      }));
    const result = await rpc("replace_mock_exam_results", {
      p_attempt_id: body.attemptId,
      p_token_hash: await sha(body.attemptToken),
      p_exam_id: e.id,
      p_exam_version: e.version,
      p_revision: body.revision,
      p_results: results,
    });
    return reply(result);
  } catch {
    return reply({ error: "submission rejected" }, 400);
  }
});
