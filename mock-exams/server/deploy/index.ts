// GENERATED: paste this entire file into Supabase Edge Functions > mock-exam-submit > index.ts.
// Contains only public exam data and code; set secrets in the Supabase dashboard.

// mock-exams/engine/scoring.mjs
var blank = (value) => value === void 0 || value === null || value === "";
function normalize(field, value) {
  if (blank(value)) return "";
  if (typeof value !== "string") throw new Error(`Invalid answer: ${field.id}`);
  const s = value.normalize("NFKC").trim().toUpperCase();
  if (field.type === "text") {
    if (s.length > field.maxLength || [...s].some((c) => !field.allowed.includes(c)))
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
      results
    );
  if (["exact", "unordered"].includes(rule.kind))
    return rule.patterns.some(
      (p) => matches(actual, p, rule.kind === "unordered")
    ) ? max : 0;
  if (rule.kind === "cases") {
    const hit = rule.cases.find(
      (c) => condition(c.when, answers, results) && matches(actual, c.answers, !!c.unordered)
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
function grade(exam, raw = {}, sectionIds = exam.sections.map((s) => s.id)) {
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
      correct: points === u.maxPoints
    };
  }
  const units = Object.values(results).filter(
    (u) => sectionIds.includes(u.sectionId)
  );
  const sections = exam.sections.filter((s) => sectionIds.includes(s.id)).map((s) => ({
    ...s,
    points: units.filter((u) => u.sectionId === s.id).reduce((n, u) => n + u.points, 0)
  }));
  return {
    points: units.reduce((n, u) => n + u.points, 0),
    maxPoints: units.reduce((n, u) => n + u.maxPoints, 0),
    units,
    sections
  };
}
function validateExam(exam) {
  if (exam.schemaVersion !== 1) throw new Error("Unsupported exam schema");
  const ids = new Set(exam.fields.map((f) => f.id));
  if (ids.size !== exam.fields.length) throw new Error("Duplicate field id");
  const units = /* @__PURE__ */ new Set();
  const covered = /* @__PURE__ */ new Set();
  for (const u of exam.scoring) {
    if (units.has(u.id) || !u.fields.length)
      throw new Error("Duplicate or empty scoring unit");
    units.add(u.id);
    if (!exam.sections.some((s) => s.id === u.sectionId))
      throw new Error("Unknown section");
    for (const id of u.fields) {
      if (!ids.has(id) || covered.has(id))
        throw new Error("Unknown or duplicate scored field");
      covered.add(id);
    }
  }
  if (covered.size !== ids.size) throw new Error("Unscored field");
  for (const s of exam.sections)
    if (exam.scoring.filter((u) => u.sectionId === s.id).reduce((n, u) => n + u.maxPoints, 0) !== s.maxPoints)
      throw new Error("Section points mismatch");
  if (exam.sections.reduce((n, s) => n + s.maxPoints, 0) !== exam.maxPoints)
    throw new Error("Exam points mismatch");
  grade(exam, {});
  return true;
}

// mock-exams/server/handler.mjs
var PROTOCOL = 2;
var VERIFY_EXAM_ID = "__verify_001";
var uuid = (s) => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);
var object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
var sha256 = async (s) => Array.from(
  new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))
  ),
  (b) => b.toString(16).padStart(2, "0")
).join("");
function createHandler({ exams, env, request = fetch }) {
  for (const e of exams.values()) validateExam(e);
  return async function handle(req) {
    const allowed = env("MOCK_EXAM_ALLOWED_ORIGIN");
    const headers = {
      "Access-Control-Allow-Origin": allowed || "null",
      "Access-Control-Allow-Headers": "content-type, apikey",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Cache-Control": "no-store",
      Vary: "Origin",
      "Content-Type": "application/json"
    };
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (!allowed || req.headers.get("origin") !== allowed)
      return reply({ error: "origin" }, 403);
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (!["GET", "POST"].includes(req.method))
      return reply({ error: "method" }, 405);
    const url = env("SUPABASE_URL"), key = env("SUPABASE_SERVICE_ROLE_KEY"), secret = env("MOCK_EXAM_TURNSTILE_SECRET"), sitekey = env("MOCK_EXAM_TURNSTILE_SITE_KEY");
    if (!url || !key || !secret || !sitekey || env("MOCK_EXAM_ENABLED") !== "true")
      return reply({ error: "not_configured" }, 503);
    async function rpc(name, body) {
      const r = await request(url + "/rest/v1/rpc/" + name, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8e3)
      });
      if (!r.ok) throw Error("database_unavailable");
      return r.json();
    }
    try {
      if (req.method === "GET") {
        if (await rpc("mock_exam_stats_health", {}) !== PROTOCOL)
          throw Error("database_unavailable");
        return reply({
          protocol: PROTOCOL,
          ready: true,
          turnstileSiteKey: sitekey,
          verificationEnabled: env("MOCK_EXAM_VERIFICATION_ENABLED") === "true"
        });
      }
      if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
        return reply({ error: "content_type" }, 415);
      const reader = req.body?.getReader();
      if (!reader) return reply({ error: "body" }, 400);
      let size = 0;
      const parts = [];
      for (; ; ) {
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
      const fields = /* @__PURE__ */ new Set([
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
        "verificationRun"
      ]);
      if (Object.keys(body).some((k) => !fields.has(k)))
        return reply({ error: "unknown_field" }, 400);
      const e = exams.get(body.examId + "@" + body.examVersion);
      if (!e) return reply({ error: "exam_version" }, 400);
      if (!uuid(body.attemptId) || typeof body.attemptToken !== "string" || !/^[0-9a-f]{64}$/.test(body.attemptToken) || !Number.isSafeInteger(body.revision) || body.revision < 1 || body.revision > 1e4)
        return reply({ error: "attempt" }, 400);
      if (!Array.isArray(body.sectionIds) || !body.sectionIds.length || new Set(body.sectionIds).size !== body.sectionIds.length || body.sectionIds.some((s) => !e.sections.some((x) => x.id === s)))
        return reply({ error: "sections" }, 400);
      const allowedFields = new Set(
        e.fields.filter((f) => body.sectionIds.includes(f.sectionId)).map((f) => f.id)
      );
      if (!object(body.answers) || Object.keys(body.answers).some((k) => !allowedFields.has(k)))
        return reply({ error: "answers" }, 400);
      if (typeof body.challengeToken !== "string" || !body.challengeToken.length || body.challengeToken.length > 2048 || !uuid(body.challengeRequestId))
        return reply({ error: "challenge_input" }, 400);
      const verifying = body.verificationRun !== void 0;
      if (verifying && (env("MOCK_EXAM_VERIFICATION_ENABLED") !== "true" || e.id !== "001" || !uuid(body.verificationRun)))
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
          signal: AbortSignal.timeout(8e3),
          body: JSON.stringify({
            secret,
            response: body.challengeToken,
            idempotency_key: body.challengeRequestId
          })
        }
      );
      if (!challengeResponse.ok) throw Error("challenge_unavailable");
      const challenge = await challengeResponse.json();
      if (!challenge.success || challenge.hostname !== new URL(allowed).hostname || challenge.action !== "mock-exam-submit")
        return reply({ error: "challenge" }, 403);
      const tokenHash = await sha256(body.attemptToken);
      if (!await rpc("consume_mock_exam_budget", { p_identity_hash: tokenHash }))
        return reply({ error: "rate_limit" }, 429);
      const result = await rpc("replace_mock_exam_results", {
        p_attempt_id: body.attemptId,
        p_token_hash: tokenHash,
        p_exam_id: verifying ? VERIFY_EXAM_ID : e.id,
        p_exam_version: verifying ? body.verificationRun : e.version,
        p_revision: body.revision,
        p_section_ids: [...body.sectionIds].sort(),
        p_results: graded.units.filter((u) => u.answered).map((u) => ({
          section_id: u.sectionId,
          scoring_id: u.id,
          answer_key: u.answerKey,
          points: u.points,
          max_points: u.maxPoints
        }))
      });
      if (result.status === "conflict") return reply(result, 409);
      return reply(result);
    } catch {
      return reply({ error: "upstream_unavailable" }, 503);
    }
  };
}

// mock-exams/exams/001/1.0.0/exam.json
var exam_default = {
  schemaVersion: 1,
  id: "001",
  version: "1.0.0",
  title: "情報Ⅰ 実戦模試 No.001",
  durationSeconds: 3600,
  maxPoints: 100,
  sections: [
    {
      id: "q1",
      title: "第1問",
      maxPoints: 20,
      sourceVersion: "1.4.0",
      problem: "q1.html",
      solution: "q1-solution.html",
      sourceSha256: "788acd2e4595e7f040198b0703234e93587af1bde8b79837913dff98ba7a7409"
    },
    {
      id: "q2a",
      title: "第2問A",
      maxPoints: 15,
      sourceVersion: "2.5.0",
      problem: "q2a.html",
      solution: "q2a-solution.html",
      sourceSha256: "da90e7bf11d5165e1a48f37899b33d9c82b241c6c280cf06403399b4714c6b32"
    },
    {
      id: "q2b",
      title: "第2問B",
      maxPoints: 15,
      sourceVersion: "1.0.5",
      problem: "q2b.html",
      solution: "q2b-solution.html",
      sourceSha256: "bc6af86951cc1f6c06b19824cbed0c5774abd052a2d900e82ac3be4bc2f43a49"
    },
    {
      id: "q3",
      title: "第3問",
      maxPoints: 25,
      sourceVersion: "1.2.2",
      problem: "q3.html",
      solution: "q3-solution.html",
      sourceSha256: "8008752cc11dff167c996e4a3b75cdadff7b7f039c44ad85e278c895d2a4bc5e"
    },
    {
      id: "q4",
      title: "第4問",
      maxPoints: 25,
      sourceVersion: "4.5.0",
      problem: "q4.html",
      solution: "q4-solution.html",
      sourceSha256: "83e1abe15a384167c9b1bb0967ddc34b9a09d85d92cb9f0fe10b6182ad8d342e"
    }
  ],
  fields: [
    {
      id: "q1-ア",
      sectionId: "q1",
      label: "ア",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "ソースコードを入手でき，ライセンスの条件に従って改変や再配布ができる。"
        },
        {
          value: "1",
          text: "著作権が放棄され，改変したものも条件なしに再配布できる。"
        },
        {
          value: "2",
          text: "ソースコードを入手でき，再配布を有償で行うことは禁じられている。"
        },
        {
          value: "3",
          text: "実行ファイルを無償で利用でき，ソースコードは開発者だけが閲覧できる。"
        }
      ]
    },
    {
      id: "q1-イ",
      sectionId: "q1",
      label: "イ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "CPUの処理時間はOSが割り当て，主記憶装置の空き領域は各アプリケーションがOSを介さずに確保する。"
        },
        {
          value: "1",
          text: "主記憶装置の領域はOSが割り当て，CPUを利用する順序は各アプリケーションがOSを介さずに決める。"
        },
        {
          value: "2",
          text: "CPUの処理時間と主記憶装置の領域は，アプリケーションをインストールしたときに割り当てられ，実行中は変わらない。"
        },
        {
          value: "3",
          text: "CPUの処理時間と主記憶装置の領域は，実行中のアプリケーションの要求や状態に応じてOSが割り当てる。"
        }
      ]
    },
    {
      id: "q1-ウ",
      sectionId: "q1",
      label: "ウ",
      type: "text",
      choices: [],
      allowed: "0123456789",
      maxLength: 1
    },
    {
      id: "q1-エ",
      sectionId: "q1",
      label: "エ",
      type: "text",
      choices: [],
      allowed: "ABCD",
      maxLength: 1
    },
    {
      id: "q1-オ",
      sectionId: "q1",
      label: "オ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "符号の割当て 0"
        },
        {
          value: "1",
          text: "符号の割当て 1"
        },
        {
          value: "2",
          text: "符号の割当て 2"
        },
        {
          value: "3",
          text: "符号の割当て 3"
        }
      ]
    },
    {
      id: "q1-カ",
      sectionId: "q1",
      label: "カ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "第1版"
        },
        {
          value: "1",
          text: "第2版"
        },
        {
          value: "2",
          text: "第3版"
        },
        {
          value: "3",
          text: "特定できない"
        }
      ]
    },
    {
      id: "q1-キ",
      sectionId: "q1",
      label: "キ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "第1版"
        },
        {
          value: "1",
          text: "第2版"
        },
        {
          value: "2",
          text: "第3版"
        },
        {
          value: "3",
          text: "特定できない"
        }
      ]
    },
    {
      id: "q1-ク",
      sectionId: "q1",
      label: "ク",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "全ての閲覧で最新の版を表示する全ての閲覧で最新の版を表示する"
        },
        {
          value: "1",
          text: "全ての閲覧で最新の版を表示する古い版を表示する閲覧がある"
        },
        {
          value: "2",
          text: "古い版を表示する閲覧がある全ての閲覧で最新の版を表示する"
        },
        {
          value: "3",
          text: "古い版を表示する閲覧がある古い版を表示する閲覧がある"
        }
      ]
    },
    {
      id: "q1-ケ",
      sectionId: "q1",
      label: "ケ",
      type: "text",
      choices: [],
      allowed: "0123456789",
      maxLength: 1
    },
    {
      id: "q1-コ",
      sectionId: "q1",
      label: "コ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "公表する表 0"
        },
        {
          value: "1",
          text: "公表する表 1"
        },
        {
          value: "2",
          text: "公表する表 2"
        },
        {
          value: "3",
          text: "公表する表 3"
        }
      ]
    },
    {
      id: "q2a-ア",
      sectionId: "q2a",
      label: "ア",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "D11，D12"
        },
        {
          value: "1",
          text: "D11，D13"
        },
        {
          value: "2",
          text: "D11"
        },
        {
          value: "3",
          text: "D11，D12，D21"
        }
      ]
    },
    {
      id: "q2a-イ",
      sectionId: "q2a",
      label: "イ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "M01"
        },
        {
          value: "1",
          text: "M02"
        },
        {
          value: "2",
          text: "M03"
        },
        {
          value: "3",
          text: "M04"
        },
        {
          value: "4",
          text: "M05"
        },
        {
          value: "5",
          text: "M06"
        }
      ]
    },
    {
      id: "q2a-ウ",
      sectionId: "q2a",
      label: "ウ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "M01"
        },
        {
          value: "1",
          text: "M02"
        },
        {
          value: "2",
          text: "M03"
        },
        {
          value: "3",
          text: "M04"
        },
        {
          value: "4",
          text: "M05"
        },
        {
          value: "5",
          text: "M06"
        }
      ]
    },
    {
      id: "q2a-エ",
      sectionId: "q2a",
      label: "エ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "工具番号貸出番号"
        },
        {
          value: "1",
          text: "貸出番号，工具番号貸出番号"
        },
        {
          value: "2",
          text: "貸出番号工具番号"
        },
        {
          value: "3",
          text: "工具番号工具番号"
        },
        {
          value: "4",
          text: "貸出番号貸出番号"
        },
        {
          value: "5",
          text: "貸出番号，工具番号工具番号"
        }
      ]
    },
    {
      id: "q2a-オ",
      sectionId: "q2a",
      label: "オ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "工具番号ごとに「貸出可」かどうかだけを記録する。点検合格を受けた工具，または停止解除を受けた型式の工具を「貸出可」にする。"
        },
        {
          value: "1",
          text: "型式ごとに点検の合否と使用停止の有無を分けて記録する。どれか1台の合格でその型式を合格とし，二つの条件から表示を決める。"
        },
        {
          value: "2",
          text: "工具番号ごとに今回の点検の合否を，型式ごとに使用停止の有無を分けて記録する。各連絡で対応する記録だけを更新し，二つの条件から表示を決める。"
        },
        {
          value: "3",
          text: "工具番号ごとに点検の合否と使用停止の有無を分けて記録する。停止解除の時点で合格済みの工具だけを停止なしとし，二つの条件から表示を決める。"
        }
      ]
    },
    {
      id: "q2a-カ",
      sectionId: "q2a",
      label: "カ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "P：予約不可 Q：予約不可"
        },
        {
          value: "1",
          text: "P：予約確定 Q：予約不可"
        },
        {
          value: "2",
          text: "P：予約不可 Q：予約確定"
        },
        {
          value: "3",
          text: "P：予約確定 Q：予約確定"
        }
      ]
    },
    {
      id: "q2a-キ",
      sectionId: "q2a",
      label: "キ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "会員が申込を送信すると，その会員の画面の予約ボタンを無効にする。確定処理からの通知が届くまで再び押せないようにし，確認処理と確定処理は今の方法を使う。"
        },
        {
          value: "1",
          text: "確定処理の直前に予約の有無を再確認し，予約がなければ記録する。再確認と記録の間には他の申込の処理が入ることがあり，記録に成功した申込にだけ確定を通知する。"
        },
        {
          value: "2",
          text: "工具ごとに予約の保存欄を一つにし，確認結果が「可」ならその欄に記録する。既に予約があれば新しい申込で上書きし，書込みに成功した申込にだけ確定を通知する。"
        },
        {
          value: "3",
          text: "確認結果の保存をやめ，サーバで同じ工具の確認と予約の記録を一続きに行う。この間には他の申込の処理を入れず，その処理で予約を記録できた申込にだけ確定を通知する。"
        }
      ]
    },
    {
      id: "q2b-コ",
      sectionId: "q2b",
      label: "コ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "0000"
        },
        {
          value: "1",
          text: "0001"
        },
        {
          value: "2",
          text: "0100"
        },
        {
          value: "3",
          text: "0110"
        },
        {
          value: "4",
          text: "1001"
        },
        {
          value: "5",
          text: "1100"
        },
        {
          value: "6",
          text: "1110"
        },
        {
          value: "7",
          text: "1111"
        }
      ]
    },
    {
      id: "q2b-サ",
      sectionId: "q2b",
      label: "サ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "0000"
        },
        {
          value: "1",
          text: "0001"
        },
        {
          value: "2",
          text: "0100"
        },
        {
          value: "3",
          text: "0110"
        },
        {
          value: "4",
          text: "1001"
        },
        {
          value: "5",
          text: "1100"
        },
        {
          value: "6",
          text: "1110"
        },
        {
          value: "7",
          text: "1111"
        }
      ]
    },
    {
      id: "q2b-シ",
      sectionId: "q2b",
      label: "シ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "Pを使ってAを復元し，次にQを使ってCを復元する"
        },
        {
          value: "1",
          text: "Pを使ってCを復元し，次にPを使ってAを復元する"
        },
        {
          value: "2",
          text: "Qを使ってAを復元し，次にPを使ってCを復元する"
        },
        {
          value: "3",
          text: "Qを使ってCを復元し，次にPを使ってAを復元する"
        }
      ]
    },
    {
      id: "q2b-ス",
      sectionId: "q2b",
      label: "ス",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "P ⊕ Q ⊕ B"
        },
        {
          value: "1",
          text: "P ⊕ Q ⊕ D"
        },
        {
          value: "2",
          text: "P ⊕ B ⊕ D"
        },
        {
          value: "3",
          text: "Q ⊕ B ⊕ D"
        }
      ]
    },
    {
      id: "q2b-セ",
      sectionId: "q2b",
      label: "セ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "AとB"
        },
        {
          value: "1",
          text: "AとC"
        },
        {
          value: "2",
          text: "AとD"
        },
        {
          value: "3",
          text: "BとC"
        },
        {
          value: "4",
          text: "BとD"
        },
        {
          value: "5",
          text: "CとD"
        }
      ]
    },
    {
      id: "q2b-ソ",
      sectionId: "q2b",
      label: "ソ",
      type: "text",
      choices: [],
      allowed: "0123456789",
      maxLength: 1
    },
    {
      id: "q2b-タ",
      sectionId: "q2b",
      label: "タ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "Aだけ"
        },
        {
          value: "1",
          text: "Bだけ"
        },
        {
          value: "2",
          text: "Cだけ"
        },
        {
          value: "3",
          text: "Dだけ"
        }
      ]
    },
    {
      id: "q2b-チ",
      sectionId: "q2b",
      label: "チ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "A，B，P"
        },
        {
          value: "1",
          text: "A，C，Q"
        },
        {
          value: "2",
          text: "B，C，P"
        },
        {
          value: "3",
          text: "C，D，R"
        }
      ]
    },
    {
      id: "q3-ア",
      sectionId: "q3",
      label: "ア",
      type: "text",
      choices: [],
      allowed: "0123456789",
      maxLength: 1
    },
    {
      id: "q3-イ",
      sectionId: "q3",
      label: "イ",
      type: "text",
      choices: [],
      allowed: "0123456789",
      maxLength: 1
    },
    {
      id: "q3-ウ",
      sectionId: "q3",
      label: "ウ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "受付番号1・6の申込を確定し，受付番号3の申込を待機にする。"
        },
        {
          value: "1",
          text: "受付番号1・3の申込を確定し，受付番号6の申込を待機にする。"
        },
        {
          value: "2",
          text: "受付番号1の申込だけを確定し，受付番号3・6の申込を待機にする。"
        },
        {
          value: "3",
          text: "受付番号3・6の申込を確定し，受付番号1の申込を待機にする。"
        }
      ]
    },
    {
      id: "q3-エ",
      sectionId: "q3",
      label: "エ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "要素数(Zaiko)"
        },
        {
          value: "1",
          text: "kensu - 1"
        },
        {
          value: "2",
          text: "kensu"
        },
        {
          value: "3",
          text: "kensu + 1"
        }
      ]
    },
    {
      id: "q3-オ",
      sectionId: "q3",
      label: "オ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "Kishu[i]"
        },
        {
          value: "1",
          text: "Kazu[i]"
        },
        {
          value: "2",
          text: "Zaiko[i]"
        },
        {
          value: "3",
          text: "i"
        }
      ]
    },
    {
      id: "q3-カ",
      sectionId: "q3",
      label: "カ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "Zaiko[b] > Kazu[i]"
        },
        {
          value: "1",
          text: "Zaiko[b] >= Kazu[i]"
        },
        {
          value: "2",
          text: "Zaiko[b] >= Kazu[b]"
        },
        {
          value: "3",
          text: "Zaiko[b] >= Kishu[i]"
        }
      ]
    },
    {
      id: "q3-キ",
      sectionId: "q3",
      label: "キ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "Zaiko[b] - Kazu[i]"
        },
        {
          value: "1",
          text: "Zaiko[b] - Kazu[b]"
        },
        {
          value: "2",
          text: "Zaiko[b] - Kishu[i]"
        },
        {
          value: "3",
          text: "Zaiko[b] + Kazu[i]"
        },
        {
          value: "4",
          text: "Kazu[i] - Zaiko[b]"
        },
        {
          value: "5",
          text: "Zaiko[b] - 1"
        }
      ]
    },
    {
      id: "q3-ク",
      sectionId: "q3",
      label: "ク",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "Jotai[i] == 0"
        },
        {
          value: "1",
          text: "Kishu[i] == 1"
        },
        {
          value: "2",
          text: "Jotai[i] == 1"
        },
        {
          value: "3",
          text: "Kazu[i] == 1"
        }
      ]
    },
    {
      id: "q3-ケ",
      sectionId: "q3",
      label: "ケ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "Zaiko[b] + Kazu[b]"
        },
        {
          value: "1",
          text: "Zaiko[b] + Kazu[i]"
        },
        {
          value: "2",
          text: "Zaiko[b] + 1"
        },
        {
          value: "3",
          text: "Zaiko[b] - Kazu[i]"
        },
        {
          value: "4",
          text: "Kazu[i] - Zaiko[b]"
        },
        {
          value: "5",
          text: "Zaiko[b] + Kishu[i]"
        }
      ]
    },
    {
      id: "q3-コ",
      sectionId: "q3",
      label: "コ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "繰返しcの外"
        },
        {
          value: "1",
          text: "繰返しcの中・jの外"
        },
        {
          value: "2",
          text: "繰返しjの中"
        },
        {
          value: "3",
          text: "条件成立時"
        }
      ]
    },
    {
      id: "q3-サ",
      sectionId: "q3",
      label: "サ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "(Jotai[j] == 0) and (Zaiko[b] >= Kazu[j])"
        },
        {
          value: "1",
          text: "(Jotai[j] == 0) or (Zaiko[b] >= Kazu[j])"
        },
        {
          value: "2",
          text: "(Jotai[j] != 1) and (Zaiko[b] >= Kazu[j])"
        },
        {
          value: "3",
          text: "(Jotai[j] == 0) and (Zaiko[b] > Kazu[j])"
        }
      ]
    },
    {
      id: "q3-シ",
      sectionId: "q3",
      label: "シ",
      type: "text",
      choices: [],
      allowed: "0123456789",
      maxLength: 1
    },
    {
      id: "q3-ス",
      sectionId: "q3",
      label: "ス",
      type: "text",
      choices: [],
      allowed: "0123456789",
      maxLength: 1
    },
    {
      id: "q3-セ",
      sectionId: "q3",
      label: "セ",
      type: "text",
      choices: [],
      allowed: "0123456789",
      maxLength: 1
    },
    {
      id: "q4-ア",
      sectionId: "q4",
      label: "ア",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "1月では半数未満の日が当てはまり，7月では当てはまる日がある"
        },
        {
          value: "1",
          text: "1月では半数未満の日が当てはまり，7月では当てはまる日がない"
        },
        {
          value: "2",
          text: "1月では半数以上の日が当てはまり，7月では当てはまる日がない"
        },
        {
          value: "3",
          text: "1月では半数以上の日が当てはまり，7月では当てはまる日がある"
        }
      ]
    },
    {
      id: "q4-イ",
      sectionId: "q4",
      label: "イ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "Pは調査対象に残り，Tは加わらない"
        },
        {
          value: "1",
          text: "Pは調査対象から外れ，Tは加わる"
        },
        {
          value: "2",
          text: "Pは調査対象から外れ，Tは加わらない"
        },
        {
          value: "3",
          text: "Pは調査対象に残り，Tは加わる"
        }
      ]
    },
    {
      id: "q4-ウ",
      sectionId: "q4",
      label: "ウ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "中央値は1にそろい，四分位範囲も同じになる"
        },
        {
          value: "1",
          text: "中央値はそろわず，四分位範囲は同じになる"
        },
        {
          value: "2",
          text: "中央値は1にそろうが，四分位範囲は異なる"
        },
        {
          value: "3",
          text: "中央値も四分位範囲も，群によって異なる"
        }
      ]
    },
    {
      id: "q4-エ",
      sectionId: "q4",
      label: "エ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "PもTも，同じ月・区分の日合計の第1四分位数を下回る。"
        },
        {
          value: "1",
          text: "Pの中央値に対する比D/Mは0.713なので，Pは1月の平日のうち少ない方から約71.3％の位置に当たる。"
        },
        {
          value: "2",
          text: "PとTはともに平日なので，日合計Dと中央値に対する比D/Mの大小の順序が一致する。"
        },
        {
          value: "3",
          text: "同じ月・区分では，日合計Dと中央値に対する比D/Mの大小の順序が一致する。"
        },
        {
          value: "4",
          text: "同月・同区分の中央値Mで割るので，各群の比D/Mの平均値も必ず1になる。"
        }
      ]
    },
    {
      id: "q4-オ",
      sectionId: "q4",
      label: "オ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "PもTも，同じ月・区分の日合計の第1四分位数を下回る。"
        },
        {
          value: "1",
          text: "Pの中央値に対する比D/Mは0.713なので，Pは1月の平日のうち少ない方から約71.3％の位置に当たる。"
        },
        {
          value: "2",
          text: "PとTはともに平日なので，日合計Dと中央値に対する比D/Mの大小の順序が一致する。"
        },
        {
          value: "3",
          text: "同じ月・区分では，日合計Dと中央値に対する比D/Mの大小の順序が一致する。"
        },
        {
          value: "4",
          text: "同月・同区分の中央値Mで割るので，各群の比D/Mの平均値も必ず1になる。"
        }
      ]
    },
    {
      id: "q4-カ",
      sectionId: "q4",
      label: "カ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "昼間と夜間で両日の大小が変わらず，各時台の差を合計すると差が打ち消し合っている"
        },
        {
          value: "1",
          text: "昼間と夜間で両日の大小が逆になり，各時台の差を合計すると差が拡大している"
        },
        {
          value: "2",
          text: "昼間と夜間で両日の大小が逆になり，各時台の差を合計すると差が打ち消し合っている"
        },
        {
          value: "3",
          text: "昼間と夜間で両日の大小が変わらず，各時台の差を合計すると差が拡大している"
        }
      ]
    },
    {
      id: "q4-キ",
      sectionId: "q4",
      label: "キ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "R"
        },
        {
          value: "1",
          text: "S"
        },
        {
          value: "2",
          text: "U"
        },
        {
          value: "3",
          text: "V"
        }
      ]
    },
    {
      id: "q4-ク",
      sectionId: "q4",
      label: "ク",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "R0〜23時台",
          parts: [
            "R",
            "0〜23時台"
          ]
        },
        {
          value: "1",
          text: "T13〜23時台",
          parts: [
            "T",
            "13〜23時台"
          ]
        },
        {
          value: "2",
          text: "T0〜23時台",
          parts: [
            "T",
            "0〜23時台"
          ]
        },
        {
          value: "3",
          text: "R13〜23時台",
          parts: [
            "R",
            "13〜23時台"
          ]
        }
      ]
    },
    {
      id: "q4-ケ",
      sectionId: "q4",
      label: "ケ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "割合の大小が逆転し，両者の割合の差の絶対値は大きくなった"
        },
        {
          value: "1",
          text: "割合の大小が逆転し，両者の割合の差の絶対値は小さくなった"
        },
        {
          value: "2",
          text: "割合の大小は変わらず，両者の割合の差の絶対値は大きくなった"
        },
        {
          value: "3",
          text: "割合の大小は変わらず，両者の割合の差の絶対値は小さくなった"
        }
      ]
    },
    {
      id: "q4-コ",
      sectionId: "q4",
      label: "コ",
      type: "choice",
      choices: [
        {
          value: "0",
          text: "案Ⅰ案Ⅰ"
        },
        {
          value: "1",
          text: "案Ⅱ案Ⅱ"
        },
        {
          value: "2",
          text: "案Ⅰ案Ⅱ"
        },
        {
          value: "3",
          text: "案Ⅱ案Ⅰ"
        }
      ]
    }
  ],
  scoring: [
    {
      id: "q1-01",
      sectionId: "q1",
      fields: [
        "q1-ア"
      ],
      maxPoints: 2,
      rule: {
        kind: "exact",
        patterns: [
          [
            "0"
          ]
        ]
      }
    },
    {
      id: "q1-02",
      sectionId: "q1",
      fields: [
        "q1-イ"
      ],
      maxPoints: 2,
      rule: {
        kind: "exact",
        patterns: [
          [
            "3"
          ]
        ]
      }
    },
    {
      id: "q1-03",
      sectionId: "q1",
      fields: [
        "q1-ウ",
        "q1-エ"
      ],
      maxPoints: 3,
      rule: {
        kind: "exact",
        patterns: [
          [
            "5",
            "C"
          ]
        ]
      }
    },
    {
      id: "q1-04",
      sectionId: "q1",
      fields: [
        "q1-オ"
      ],
      maxPoints: 3,
      rule: {
        kind: "exact",
        patterns: [
          [
            "2"
          ]
        ]
      }
    },
    {
      id: "q1-05",
      sectionId: "q1",
      fields: [
        "q1-カ",
        "q1-キ"
      ],
      maxPoints: 3,
      rule: {
        kind: "exact",
        patterns: [
          [
            "2",
            "1"
          ]
        ]
      }
    },
    {
      id: "q1-06",
      sectionId: "q1",
      fields: [
        "q1-ク"
      ],
      maxPoints: 2,
      rule: {
        kind: "exact",
        patterns: [
          [
            "2"
          ]
        ]
      }
    },
    {
      id: "q1-07",
      sectionId: "q1",
      fields: [
        "q1-ケ"
      ],
      maxPoints: 2,
      rule: {
        kind: "exact",
        patterns: [
          [
            "2"
          ]
        ]
      }
    },
    {
      id: "q1-08",
      sectionId: "q1",
      fields: [
        "q1-コ"
      ],
      maxPoints: 3,
      rule: {
        kind: "exact",
        patterns: [
          [
            "3"
          ]
        ]
      }
    },
    {
      id: "q2a-01",
      sectionId: "q2a",
      fields: [
        "q2a-ア"
      ],
      maxPoints: 2,
      rule: {
        kind: "exact",
        patterns: [
          [
            "2"
          ]
        ]
      }
    },
    {
      id: "q2a-02",
      sectionId: "q2a",
      fields: [
        "q2a-イ",
        "q2a-ウ"
      ],
      maxPoints: 3,
      rule: {
        kind: "unordered",
        patterns: [
          [
            "1",
            "5"
          ]
        ]
      }
    },
    {
      id: "q2a-03",
      sectionId: "q2a",
      fields: [
        "q2a-エ"
      ],
      maxPoints: 2,
      rule: {
        kind: "exact",
        patterns: [
          [
            "1"
          ]
        ]
      }
    },
    {
      id: "q2a-04",
      sectionId: "q2a",
      fields: [
        "q2a-オ"
      ],
      maxPoints: 3,
      rule: {
        kind: "exact",
        patterns: [
          [
            "2"
          ]
        ]
      }
    },
    {
      id: "q2a-05",
      sectionId: "q2a",
      fields: [
        "q2a-カ"
      ],
      maxPoints: 2,
      rule: {
        kind: "exact",
        patterns: [
          [
            "3"
          ]
        ]
      }
    },
    {
      id: "q2a-06",
      sectionId: "q2a",
      fields: [
        "q2a-キ"
      ],
      maxPoints: 3,
      rule: {
        kind: "exact",
        patterns: [
          [
            "3"
          ]
        ]
      }
    },
    {
      id: "q2b-01",
      sectionId: "q2b",
      fields: [
        "q2b-コ"
      ],
      maxPoints: 1,
      rule: {
        kind: "exact",
        patterns: [
          [
            "1"
          ]
        ]
      }
    },
    {
      id: "q2b-02",
      sectionId: "q2b",
      fields: [
        "q2b-サ"
      ],
      maxPoints: 2,
      rule: {
        kind: "exact",
        patterns: [
          [
            "6"
          ]
        ]
      }
    },
    {
      id: "q2b-03",
      sectionId: "q2b",
      fields: [
        "q2b-シ"
      ],
      maxPoints: 2,
      rule: {
        kind: "exact",
        patterns: [
          [
            "3"
          ]
        ]
      }
    },
    {
      id: "q2b-04",
      sectionId: "q2b",
      fields: [
        "q2b-ス"
      ],
      maxPoints: 2,
      rule: {
        kind: "exact",
        patterns: [
          [
            "1"
          ]
        ]
      }
    },
    {
      id: "q2b-05",
      sectionId: "q2b",
      fields: [
        "q2b-セ"
      ],
      maxPoints: 2,
      rule: {
        kind: "exact",
        patterns: [
          [
            "3"
          ]
        ]
      }
    },
    {
      id: "q2b-06",
      sectionId: "q2b",
      fields: [
        "q2b-ソ",
        "q2b-タ"
      ],
      maxPoints: 3,
      rule: {
        kind: "exact",
        patterns: [
          [
            "6",
            "1"
          ]
        ]
      }
    },
    {
      id: "q2b-07",
      sectionId: "q2b",
      fields: [
        "q2b-チ"
      ],
      maxPoints: 3,
      rule: {
        kind: "exact",
        patterns: [
          [
            "1"
          ]
        ]
      }
    },
    {
      id: "q3-01",
      sectionId: "q3",
      fields: [
        "q3-ア"
      ],
      maxPoints: 2,
      rule: {
        kind: "exact",
        patterns: [
          [
            "1"
          ]
        ]
      }
    },
    {
      id: "q3-02",
      sectionId: "q3",
      fields: [
        "q3-イ"
      ],
      maxPoints: 1,
      rule: {
        kind: "exact",
        patterns: [
          [
            "0"
          ]
        ]
      }
    },
    {
      id: "q3-03",
      sectionId: "q3",
      fields: [
        "q3-ウ"
      ],
      maxPoints: 2,
      rule: {
        kind: "exact",
        patterns: [
          [
            "1"
          ]
        ]
      }
    },
    {
      id: "q3-04",
      sectionId: "q3",
      fields: [
        "q3-エ"
      ],
      maxPoints: 1,
      rule: {
        kind: "exact",
        patterns: [
          [
            "2"
          ]
        ]
      }
    },
    {
      id: "q3-05",
      sectionId: "q3",
      fields: [
        "q3-オ"
      ],
      maxPoints: 2,
      rule: {
        kind: "exact",
        patterns: [
          [
            "0"
          ]
        ]
      }
    },
    {
      id: "q3-06",
      sectionId: "q3",
      fields: [
        "q3-カ"
      ],
      maxPoints: 3,
      rule: {
        kind: "exact",
        patterns: [
          [
            "1"
          ]
        ]
      }
    },
    {
      id: "q3-07",
      sectionId: "q3",
      fields: [
        "q3-キ"
      ],
      maxPoints: 2,
      rule: {
        kind: "exact",
        patterns: [
          [
            "0"
          ]
        ]
      }
    },
    {
      id: "q3-08",
      sectionId: "q3",
      fields: [
        "q3-ク"
      ],
      maxPoints: 2,
      rule: {
        kind: "exact",
        patterns: [
          [
            "2"
          ]
        ]
      }
    },
    {
      id: "q3-09",
      sectionId: "q3",
      fields: [
        "q3-ケ"
      ],
      maxPoints: 2,
      rule: {
        kind: "exact",
        patterns: [
          [
            "1"
          ]
        ]
      }
    },
    {
      id: "q3-10",
      sectionId: "q3",
      fields: [
        "q3-コ"
      ],
      maxPoints: 2,
      rule: {
        kind: "exact",
        patterns: [
          [
            "1"
          ]
        ]
      }
    },
    {
      id: "q3-11",
      sectionId: "q3",
      fields: [
        "q3-サ"
      ],
      maxPoints: 2,
      rule: {
        kind: "exact",
        patterns: [
          [
            "0"
          ]
        ]
      }
    },
    {
      id: "q3-12",
      sectionId: "q3",
      fields: [
        "q3-シ"
      ],
      maxPoints: 2,
      rule: {
        kind: "exact",
        patterns: [
          [
            "3"
          ]
        ]
      }
    },
    {
      id: "q3-13",
      sectionId: "q3",
      fields: [
        "q3-ス"
      ],
      maxPoints: 1,
      rule: {
        kind: "exact",
        patterns: [
          [
            "1"
          ]
        ]
      }
    },
    {
      id: "q3-14",
      sectionId: "q3",
      fields: [
        "q3-セ"
      ],
      maxPoints: 1,
      rule: {
        kind: "exact",
        patterns: [
          [
            "0"
          ]
        ]
      }
    },
    {
      id: "q4-01",
      sectionId: "q4",
      fields: [
        "q4-ア"
      ],
      maxPoints: 2,
      rule: {
        kind: "exact",
        patterns: [
          [
            "2"
          ]
        ]
      }
    },
    {
      id: "q4-02",
      sectionId: "q4",
      fields: [
        "q4-イ"
      ],
      maxPoints: 3,
      rule: {
        kind: "exact",
        patterns: [
          [
            "1"
          ]
        ]
      }
    },
    {
      id: "q4-03",
      sectionId: "q4",
      fields: [
        "q4-ウ"
      ],
      maxPoints: 2,
      rule: {
        kind: "exact",
        patterns: [
          [
            "2"
          ]
        ]
      }
    },
    {
      id: "q4-04",
      sectionId: "q4",
      fields: [
        "q4-エ",
        "q4-オ"
      ],
      maxPoints: 4,
      rule: {
        kind: "unordered",
        patterns: [
          [
            "0",
            "3"
          ]
        ]
      }
    },
    {
      id: "q4-05",
      sectionId: "q4",
      fields: [
        "q4-カ"
      ],
      maxPoints: 3,
      rule: {
        kind: "exact",
        patterns: [
          [
            "2"
          ]
        ]
      }
    },
    {
      id: "q4-06",
      sectionId: "q4",
      fields: [
        "q4-キ"
      ],
      maxPoints: 3,
      rule: {
        kind: "exact",
        patterns: [
          [
            "2"
          ]
        ]
      }
    },
    {
      id: "q4-07",
      sectionId: "q4",
      fields: [
        "q4-ク"
      ],
      maxPoints: 3,
      rule: {
        kind: "exact",
        patterns: [
          [
            "1"
          ]
        ]
      }
    },
    {
      id: "q4-08",
      sectionId: "q4",
      fields: [
        "q4-ケ"
      ],
      maxPoints: 2,
      rule: {
        kind: "exact",
        patterns: [
          [
            "0"
          ]
        ]
      }
    },
    {
      id: "q4-09",
      sectionId: "q4",
      fields: [
        "q4-コ"
      ],
      maxPoints: 3,
      rule: {
        kind: "exact",
        patterns: [
          [
            "3"
          ]
        ]
      }
    }
  ]
};

// mock-exams/server/index.ts
Deno.serve(
  createHandler({
    exams: /* @__PURE__ */ new Map([["001@1.0.0", exam_default]]),
    env: (name) => Deno.env.get(name) || ""
  })
);
