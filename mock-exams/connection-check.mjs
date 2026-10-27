import { runRpcVerification } from "./tests/rpc-scenario.mjs";
const $ = (s) => document.querySelector(s),
  logs = [];
let report;
function showReport() {
  const target = $("#final-stats");
  if (!target) return;
  target.replaceChildren();
  if (!report?.finalRows) return;
  const heading = document.createElement("h2");
  heading.textContent = "最終集計（取得RPCで読戻し済み）";
  target.append(heading);
  const table = document.createElement("table"),
    head = document.createElement("tr");
  for (const label of ["採点単位", "回答数", "満点正答数", "合計得点"]) {
    const th = document.createElement("th");
    th.textContent = label;
    head.append(th);
  }
  table.append(head);
  for (const id of ["single", "pair", "partial"]) {
    const row = report.finalRows.find((x) => x.scoring_id === id),
      tr = document.createElement("tr");
    for (const value of [
      id,
      row.answered_count,
      row.correct_count,
      row.points_sum,
    ]) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.append(td);
    }
    table.append(tr);
  }
  target.append(table);
  const p = document.createElement("p"),
    stats = report.finalStatistics;
  p.textContent = `最終平均得点：${stats.total.points.toFixed(2)} / 9点、平均得点率：${(stats.total.rate * 100).toFixed(2)}%`;
  target.append(p);
}
$("#run-check").onclick = async () => {
  $("#run-check").disabled = true;
  $("#download-check").disabled = true;
  logs.length = 0;
  $("#check-log").textContent = "";
  $("#final-stats")?.replaceChildren();
  $("#check-status").textContent =
    "テスト用模試IDで送信・読戻しを確認しています…";
  try {
    report = await runRpcVerification({
      storage: localStorage,
      log: (line) => {
        logs.push(line);
        $("#check-log").textContent = logs.join("\n");
      },
    });
  } catch (error) {
    report = { passed: false, error: error.message };
    logs.push("FAIL " + error.message);
    $("#check-log").textContent = logs.join("\n");
  } finally {
    $("#check-status").textContent = report?.passed
      ? "送受信検証に成功しました。"
      : "送受信検証は未完了です。結果を確認してください。";
    showReport();
    $("#download-check").disabled = false;
    $("#run-check").disabled = false;
  }
};
$("#download-check").onclick = () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify({ ...report, logs }, null, 2)], {
      type: "application/json",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "mock-exam-rpc-check.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
