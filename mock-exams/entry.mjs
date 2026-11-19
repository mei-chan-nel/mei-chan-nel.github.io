// Catalog only: exam data, grading, history tables and reading UI load on demand.
import { AttemptStore } from "./engine/attempt.mjs";
import {
  defaultCatalogView,
  renderCatalogContents,
} from "./ui/catalog-page.mjs?v=20261118-card-order";
const target = document.querySelector("#app"),
  store = new AttemptStore();
const entries = JSON.parse(document.querySelector("#exam-catalog").textContent);
// Opening the catalog starts at the top, without replaying a saved scroll offset.
history.scrollRestoration = "manual";
const view = defaultCatalogView();
let application, samples;
const notify = (error) => {
  document.querySelector("#notice").textContent =
    error.message || "操作を完了できませんでした。もう一度お試しください。";
};
function sampleHistory() {
  if (!document.querySelector('meta[name="mock-exams-preview-samples"]'))
    return Promise.resolve();
  return (samples ||= import("./engine/preview-history.mjs")
    .then(({ seedPreviewHistory }) => seedPreviewHistory(entries, store))
    .catch(() => notify(new Error("サンプル履歴を準備できませんでした。"))));
}
async function launch(action) {
  if (application) return application;
  application = (async () => {
    if (action?.kind === "history" || (!action && location.hash))
      await sampleHistory();
    const { initializeApp } = await import("./app.mjs?v=20261118-timed-pause");
    await initializeApp({ entries, view, action });
  })().catch((error) => {
    application = null;
    notify(error);
  });
  return application;
}
function render() {
  if (application) return;
  document.body.dataset.view = "catalog";
  let records = [];
  try {
    records = store.list();
  } catch {
    notify(new Error("ブラウザ保存を利用できません。設定を確認してください。"));
  }
  renderCatalogContents({
    target,
    catalog: entries,
    history: records,
    catalogView: view,
    onChange: render,
    onStart: (entry, mode, sectionId) =>
      launch({ kind: "begin", examId: entry.id, mode, sectionId }),
    onResume: (id) => launch({ kind: "resume", id }),
    onResult: (id) => launch({ kind: "result", id }),
    onHistory: () => launch({ kind: "history" }),
    onError: notify,
  });
}
if (location.hash) launch();
else {
  // Fresh visits start with the catalog defaults. The full app handles in-page navigation.
  render();
  // Preview fixtures are unrelated to first paint. No exam documents or RPCs
  // are requested on the normal catalog path.
  const prepare = () =>
    sampleHistory().then(() => {
      if (!application) render();
    });
  if ("requestIdleCallback" in window)
    requestIdleCallback(prepare, { timeout: 2000 });
  else setTimeout(prepare, 0);
}
window.addEventListener("popstate", () => {
  if (!application) {
    if (location.hash) launch();
    else render();
  }
});
