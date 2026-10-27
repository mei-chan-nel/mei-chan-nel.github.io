import { runRpcVerification } from "./tests/rpc-scenario.mjs";
const $ = (s) => document.querySelector(s),
  logs = [];
let report;
$("#run-check").onclick = async () => {
  $("#run-check").disabled = true;
  $("#download-check").disabled = true;
  logs.length = 0;
  $("#check-status").textContent =
    "テスト用模試IDで送信・読戻しを確認しています…";
  report = await runRpcVerification({
    storage: localStorage,
    log: (line) => {
      logs.push(line);
      $("#check-log").textContent = logs.join("\n");
    },
  });
  $("#check-status").textContent = report.passed
    ? "送受信検証に成功しました。"
    : "送受信検証は未完了です。結果を確認してください。";
  $("#download-check").disabled = false;
  $("#run-check").disabled = false;
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
