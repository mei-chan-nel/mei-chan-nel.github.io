// Catalog only: exam data, grading, history tables and reading UI load on demand.
import { AttemptStore } from "./engine/attempt.mjs";
import {
  defaultCatalogView,
  renderCatalogContents,
} from "./ui/catalog-page.mjs";
const target = document.querySelector("#app"),
  store = new AttemptStore();
const entries = JSON.parse(document.querySelector("#exam-catalog").textContent);
const key = "study-atlas:mock-exams:navigation:v1";
const view = defaultCatalogView();
let application, samples;
const notify = (error) => {
  document.querySelector("#notice").textContent =
    error.message || "操作を完了できませんでした。もう一度お試しください。";
};
function savedNavigation() {
  try {
    return (
      history.state?.studyAtlasMock || JSON.parse(sessionStorage.getItem(key))
    );
  } catch {
    return null;
  }
}
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
    const { initializeApp } = await import("./app.mjs?v=20261101-entry");
    await initializeApp({ entries, view, action });
  })().catch((error) => {
    application = null;
    notify(error);
  });
  return application;
}
function render(persist = false) {
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
    onChange: () => render(true),
    onStart: (entry, mode, sectionId) =>
      launch({ kind: "begin", examId: entry.id, mode, sectionId }),
    onResume: (id) => launch({ kind: "resume", id }),
    onHistory: () => launch({ kind: "history" }),
    onError: notify,
  });
  if (persist) {
    const previous = savedNavigation();
    const state = {
      ...(previous?.view === "catalog" ? previous : {}),
      view: "catalog",
      id: null,
      catalog: { ...view },
      scrollY: scrollY,
    };
    history.replaceState({ studyAtlasMock: state }, "", location.href);
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }
}
if (location.hash) launch();
else {
  const saved = savedNavigation();
  if (saved?.view === "catalog") Object.assign(view, saved.catalog);
  render();
  if (saved?.view === "catalog" && saved.scrollY)
    requestAnimationFrame(() => window.scrollTo(0, saved.scrollY));
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
