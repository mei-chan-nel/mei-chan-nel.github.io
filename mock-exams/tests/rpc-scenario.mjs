// Used by the administrator page and integration tests; never writes exam 001.
import {
  createAttempt,
  submit,
  resume,
  pause,
  createReviewSnapshot,
  restoreAttempt,
  AttemptStore,
} from "../engine/attempt.mjs";
import { sendUnsentUnits } from "../engine/submission.mjs";
import { fetchStats, statsConfig } from "../engine/stats.mjs";
import { calculateStats, validateExam } from "../engine/scoring.mjs";
export function verificationExam(id) {
  if (!/^qa_mock_[A-Za-z0-9_-]+$/.test(id))
    throw Error("検証専用の模試IDが必要です");
  const choice = (id, sectionId) => ({
    id,
    sectionId,
    type: "choice",
    choices: ["0", "1", "2"].map((value) => ({ value, text: value })),
  });
  const exam = {
    schemaVersion: 1,
    id,
    version: 1,
    durationSeconds: 3600,
    maxPoints: 9,
    sections: [
      { id: "q1", title: "第1問", maxPoints: 5 },
      { id: "q2a", title: "第2問A", maxPoints: 4 },
    ],
    fields: [
      choice("a", "q1"),
      choice("b", "q1"),
      choice("c", "q1"),
      choice("d", "q2a"),
    ],
    scoring: [
      {
        id: "single",
        sectionId: "q1",
        fields: ["a"],
        maxPoints: 2,
        rule: { kind: "exact", patterns: [["0"]] },
      },
      {
        id: "pair",
        sectionId: "q1",
        fields: ["b", "c"],
        maxPoints: 3,
        rule: { kind: "unordered", patterns: [["1", "2"]] },
      },
      {
        id: "partial",
        sectionId: "q2a",
        fields: ["d"],
        maxPoints: 4,
        rule: {
          kind: "cases",
          cases: [
            { answers: ["1"], points: 1.5 },
            { answers: ["2"], points: 4 },
          ],
        },
      },
    ],
  };
  validateExam(exam);
  return exam;
}
export async function runRpcVerification({
  request = fetch,
  log = () => {},
  storage,
} = {}) {
  const id = "qa_mock_" + crypto.randomUUID().replaceAll("-", ""),
    exam = verificationExam(id);
  if (!storage) {
    const m = new Map();
    storage = {
      get length() {
        return m.size;
      },
      key: (i) => [...m.keys()][i],
      getItem: (k) => m.get(k) ?? null,
      setItem: (k, v) => m.set(k, v),
    };
  }
  const store = new AttemptStore(storage),
    report = {
      examId: id,
      examVersion: 1,
      at: new Date().toISOString(),
      passed: false,
      project: statsConfig.url,
      origin: globalThis.location?.origin || "node",
      requests: [],
      checkpoints: [],
      expectedFinalRows: [
        {
          scoring_id: "single",
          section_id: "q1",
          answered_count: 2,
          correct_count: 1,
          points_sum: 2,
        },
        {
          scoring_id: "pair",
          section_id: "q1",
          answered_count: 2,
          correct_count: 1,
          points_sum: 3,
        },
        {
          scoring_id: "partial",
          section_id: "q2a",
          answered_count: 3,
          correct_count: 1,
          points_sum: 7,
        },
      ],
    };
  const output = log;
  log = (message) => {
    report.checkpoints.push(message);
    output(message);
  };
  const transport = request;
  request = async (url, options) => {
    const body = JSON.parse(options.body),
      rpc = new URL(url).pathname.split("/").at(-1);
    if (
      body.p_exam_id !== id ||
      body.p_exam_version !== 1 ||
      !["record_mock_exam_results", "get_mock_exam_stats"].includes(rpc) ||
      url !== statsConfig.url + "/rest/v1/rpc/" + rpc
    )
      throw Error("検証用ID以外への通信を中止しました");
    const trace = {
      rpc,
      examId: body.p_exam_id,
      examVersion: body.p_exam_version,
      status: null,
    };
    report.requests.push(trace);
    try {
      const response = await transport(url, options);
      trace.status = response.status;
      try {
        const data = await response.clone().json();
        if (response.ok) {
          if (rpc === "get_mock_exam_stats")
            trace.itemCount = Array.isArray(data?.items)
              ? data.items.length
              : null;
          else trace.updatedCount = data?.updated_count ?? null;
        } else {
          trace.code = typeof data?.code === "string" ? data.code : null;
          trace.message =
            typeof data?.message === "string"
              ? data.message.slice(0, 400)
              : null;
        }
      } catch {
        trace.bodyUnreadable = true;
      }
      if (!response.ok)
        log(
          `通信失敗: ${rpc} HTTP ${response.status}${trace.code ? " / " + trace.code : ""}${trace.message ? " / " + trace.message : ""}`,
        );
      return response;
    } catch (error) {
      trace.error = error.message;
      log("通信失敗: " + rpc + " / HTTP応答を読めません / " + error.message);
      throw error;
    }
  };
  const check = (ok, message) => {
    if (!ok) throw Error(message);
  };
  const send = (a) => sendUnsentUnits(exam, a, store, { request });
  const read = () => fetchStats(exam, request);
  const expect = async (expected) => {
    const rows = await read();
    for (const [id, n, c, p] of expected) {
      const row = rows.find((x) => x.scoring_id === id);
      check(
        row &&
          Number(row.answered_count) === n &&
          Number(row.correct_count) === c &&
          Math.abs(Number(row.points_sum) - p) < 1e-9,
        "集計不一致: " + id,
      );
    }
    return rows;
  };
  log("検証用模試ID: " + id);
  try {
    check((await read()).length === 0, "新規の検証IDが空ではありません");
    log("PASS 公開キー・取得RPC・整数版1");
    let a = createAttempt(exam, "untimed");
    store.save(a);
    await send(a);
    check((await read()).length === 0, "未採点の送信");
    submit(exam, a);
    store.save(a);
    await send(a);
    check((await read()).length === 0, "完全未回答の送信");
    log("PASS 未採点・完全未回答を除外");
    resume(a);
    a.answers = { a: "1", b: "1" };
    submit(exam, a);
    store.save(a);
    check((await send(a)).status === "sent", "初回送信失敗");
    let rows = await expect([
      ["single", 1, 0, 0],
      ["pair", 1, 0, 0],
    ]);
    check(rows.length === 2, "未回答単位が加算されました");
    log("PASS 途中採点・複数マークの一部空欄");
    resume(a);
    a.answers = { a: "0", b: "1", c: "2", d: "1" };
    submit(exam, a);
    store.save(a);
    check((await send(a)).count === 1, "未送信単位だけになっていません");
    rows = await expect([
      ["single", 1, 0, 0],
      ["pair", 1, 0, 0],
      ["partial", 1, 0, 1.5],
    ]);
    check(a.result.points === 6.5, "個人成績が最新ではありません");
    log("PASS 新規単位だけ送信・既送信の変更は不反映・部分点1.5");
    a = restoreAttempt(exam, store.load(a.id));
    pause(a);
    store.save(a);
    check((await send(a)).count === 0, "再読込み後に再送されました");
    const reviewed = createReviewSnapshot(a);
    check(Object.isFrozen(reviewed.answers), "復習が閲覧専用ではありません");
    check(
      reviewed.result.points === a.result.points,
      "復習で元の成績が変わりました",
    );
    check(
      (await sendUnsentUnits(exam, a, store, { request, source: "review" }))
        .count === 0,
      "復習が送信されました",
    );
    await expect([
      ["single", 1, 0, 0],
      ["pair", 1, 0, 0],
      ["partial", 1, 0, 1.5],
    ]);
    log("PASS 再読込み・中断再開・復習で再送なし");
    const b = createAttempt(exam, "untimed");
    b.answers = { a: "0", b: "2", c: "1", d: "2" };
    submit(exam, b);
    store.save(b);
    check((await send(b)).count === 3, "再受験の新規送信に失敗");
    rows = await expect([
      ["single", 2, 1, 2],
      ["pair", 2, 1, 3],
      ["partial", 2, 1, 5.5],
    ]);
    const stats = calculateStats(exam, rows);
    check(
      stats.total.points === 5.25 &&
        Math.abs(stats.total.rate - 5.25 / 9) < 1e-10 &&
        stats.sections.q1.points === 2.5 &&
        stats.sections.q2a.points === 2.75,
      "平均計算が不一致",
    );
    report.beforeResponseLoss = {
      rows: structuredClone(rows),
      statistics: stats,
    };
    log("PASS 再受験・正答数・平均得点5.25/9・平均得点率58.33%");
    const lost = createAttempt(exam, "section", "q2a");
    lost.answers = { d: "1" };
    submit(exam, lost);
    store.save(lost);
    await sendUnsentUnits(exam, lost, store, {
      request: async (...args) => {
        const r = await request(...args);
        check(r.ok, "応答消失試験の送信に失敗");
        await r.text();
        throw Error("simulate lost response");
      },
    });
    const recovered = restoreAttempt(exam, store.load(lost.id));
    check(
      recovered.statsDelivery.partial.state === "unknown",
      "不明状態が失われました",
    );
    check((await send(recovered)).count === 0, "結果不明を再送しました");
    const finalRows = await expect([
      ["single", 2, 1, 2],
      ["pair", 2, 1, 3],
      ["partial", 3, 1, 7],
    ]);
    check(finalRows.length === 3, "想定外の採点単位が集計されています");
    report.finalRows = finalRows;
    report.finalStatistics = calculateStats(exam, finalRows);
    check(
      Math.abs(report.finalStatistics.total.points - 29 / 6) < 1e-10,
      "最終平均得点が不一致",
    );
    check(recovered.result.points === 1.5, "通信失敗で個人成績が失われました");
    log("PASS 記録後の応答消失・不明状態保持・再送なし・個人成績保持");
    report.passed = true;
    log("全項目成功。検証データは専用模試IDにのみ保存されています。");
  } catch (error) {
    report.error = error.message;
    log("FAIL " + error.message);
  }
  return report;
}
