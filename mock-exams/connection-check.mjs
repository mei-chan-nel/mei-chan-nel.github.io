import {
  fetchStats,
  fetchSubmissionConfig,
  statsConfig,
} from "./engine/stats.mjs";
import {
  createAttempt,
  submit,
  resume,
  startReview,
  gradeReview,
} from "./engine/attempt.mjs";
import { queueSubmission, sendPending } from "./engine/outbox.mjs";
import { mountChallenge } from "./engine/challenge.mjs";
const $ = (s) => document.querySelector(s),
  log = [];
let cleanup = () => {},
  report;
const check = (condition, message) => {
  if (!condition) throw Error(message);
};
const say = (message) => {
  log.push(message);
  $("#check-log").textContent = log.join("\n");
};
$("#download-check").onclick = () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify({ ...report, log }, null, 2)], {
      type: "application/json",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "mock-exam-connection-check.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("#run-check").onclick = async () => {
  $("#run-check").disabled = true;
  $("#download-check").disabled = true;
  log.length = 0;
  const run = crypto.randomUUID();
  report = {
    at: new Date().toISOString(),
    origin: location.origin,
    endpoint: statsConfig.submitUrl,
    verificationRun: run,
    result: "running",
  };
  say("検証ID: " + run);
  try {
    const exam = await fetch("exams/001/1.0.0/exam.json").then((r) => r.json());
    await fetchStats(exam);
    say("PASS 既存 get_mock_exam_stats RPC を公開キーで取得");
    const config = await fetchSubmissionConfig();
    check(
      config.verificationEnabled,
      "Supabaseで MOCK_EXAM_VERIFICATION_ENABLED=true を設定してください。",
    );
    say("PASS Edge Function とSQLの接続・公開設定を確認");
    async function token(label) {
      cleanup();
      $("#check-challenge").replaceChildren();
      $("#check-status").textContent =
        label + "：送信の確認を完了してください。";
      return new Promise((resolve, reject) => {
        mountChallenge($("#check-challenge"), config, {
          success: resolve,
          failure: () =>
            reject(Error("送信確認に失敗しました。検証を再実行してください。")),
        }).then((fn) => (cleanup = fn), reject);
      });
    }
    const rows = () => fetchStats({ id: "__verify_001", version: run });
    async function expect(n, correct, points) {
      const data = await rows(),
        row = data.find((x) => x.scoring_id === "q2a-02");
      check(
        row &&
          Number(row.answered_count) === n &&
          Number(row.correct_count) === correct &&
          Number(row.points_sum) === points,
        "取得した集計が期待値と異なります",
      );
      return row;
    }
    const a = createAttempt(exam, "section", "q2a");
    a.answers = { "q2a-イ": "1" };
    submit(exam, a);
    queueSubmission(exam, a);
    const first = structuredClone(a.pendingSubmission);
    async function send(snapshot, label) {
      const challengeToken = await token(label);
      const r = await fetch(config.submitUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: config.publishableKey,
        },
        body: JSON.stringify({
          ...snapshot,
          verificationRun: run,
          challengeToken,
          challengeRequestId: crypto.randomUUID(),
        }),
        signal: AbortSignal.timeout(15000),
      });
      cleanup();
      return { status: r.status, body: await r.json() };
    }
    let r = await send(first, "1. 途中採点");
    check(r.body.status === "recorded", "初回送信に失敗しました");
    let row = await expect(1, 0, 0);
    check(
      row.answer_counts?.["1|_"] === undefined ||
        row.answer_counts["1|_"] === 1,
      "回答の順序を確認できません",
    );
    say("PASS 途中採点：回答1件・正答0件・0点（完全未回答の単位は除外）");
    // Deliberately keep the exact outbox after a committed response to emulate
    // an acknowledgement lost in transit. Retry obtains a fresh challenge token.
    const retryToken = await token("2. 通信リトライ");
    await sendPending(a, config, retryToken, (_url, init) =>
      fetch(config.submitUrl, {
        ...init,
        body: JSON.stringify({
          ...JSON.parse(init.body),
          verificationRun: run,
        }),
      }),
    );
    cleanup();
    check(!a.pendingSubmission, "再送確認が未完了です");
    await expect(1, 0, 0);
    say("PASS 通信リトライ：二重加算なし");
    resume(a);
    a.answers["q2a-ウ"] = "5";
    submit(exam, a);
    queueSubmission(exam, a);
    r = await send(a.pendingSubmission, "3. 再開後の再採点");
    check(r.body.status === "recorded", "再採点に失敗しました");
    await expect(1, 1, 3);
    say("PASS 再採点：同じ1件を正答・3点に置換");
    r = await send(first, "4. 古い送信の遅延到着");
    check(r.body.status === "stale", "古い送信を無視できません");
    await expect(1, 1, 3);
    say("PASS 古いリビジョン：集計は最新のまま");
    r = await send(
      { ...a.pendingSubmission, answers: { "q2a-イ": "0" } },
      "5. 同じ版の内容衝突",
    );
    check(r.status === 409, "内容衝突を拒否できません");
    await expect(1, 1, 3);
    say("PASS 同じリビジョンの異なる内容を拒否");
    const b = createAttempt(exam, "section", "q2a");
    b.answers = { "q2a-イ": "5", "q2a-ウ": "1" };
    submit(exam, b);
    queueSubmission(exam, b);
    r = await send(b.pendingSubmission, "6. 最初から再受験");
    check(r.body.status === "recorded", "別受験の送信に失敗しました");
    await expect(2, 2, 6);
    say("PASS 再受験：別IDの2件目として加算");
    const old = JSON.stringify(a.pendingSubmission);
    startReview(exam, a);
    a.review.answers = { "q2a-イ": "0" };
    gradeReview(exam, a);
    check(
      queueSubmission(exam, a, { source: "review" }) === false &&
        JSON.stringify(a.pendingSubmission) === old,
      "復習から送信予約されました",
    );
    r = await fetch(config.submitUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.publishableKey,
      },
      body: JSON.stringify({
        ...a.pendingSubmission,
        kind: "review",
        verificationRun: run,
      }),
    });
    check(r.status === 400, "復習送信を拒否できません");
    await expect(2, 2, 6);
    say("PASS 復習：送信予約なし・復習リクエスト拒否・集計不変");
    resume(a);
    a.answers = {};
    submit(exam, a);
    queueSubmission(exam, a);
    r = await send(a.pendingSubmission, "7. 未回答へ戻して再採点");
    check(r.body.status === "recorded", "未回答への置換に失敗しました");
    await expect(1, 1, 3);
    say("PASS 完全未回答へ変更：以前の1件を集計から除外");
    resume(b);
    b.answers = {};
    submit(exam, b);
    queueSubmission(exam, b);
    r = await send(b.pendingSubmission, "8. 検証結果の後片付け");
    check(r.body.status === "recorded", "後片付けに失敗しました");
    await expect(0, 0, 0);
    say("PASS 検証集計を0に戻しました（重複防止記録は保持）");
    report.result = "passed";
    say("全項目成功。MOCK_EXAM_VERIFICATION_ENABLED=false に戻してください。");
    $("#check-status").textContent =
      "送受信検証に成功しました。検証結果を保存してください。";
  } catch (e) {
    report.result = "failed";
    say("FAIL " + e.message);
    $("#check-status").textContent =
      "検証は未完了です。結果ログの項目を確認してください。";
  } finally {
    cleanup();
    $("#run-check").disabled = false;
    $("#download-check").disabled = false;
  }
};
