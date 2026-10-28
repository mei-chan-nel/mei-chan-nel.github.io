import {
  grade,
  normalize,
  validateExam,
  calculateStats,
} from "./engine/scoring.mjs";
import {
  AttemptStore,
  createAttempt,
  elapsed,
  pause,
  resume,
  submit,
  createReviewSnapshot,
  restoreAttempt,
  compatibleVersion,
} from "./engine/attempt.mjs";
import {
  historyRows,
  sliceResult,
  emptyGridState,
} from "./engine/history-grid.mjs";
import { renderHistoryGrid, closeHistoryMenu } from "./ui/history-grid.mjs";
import { fitBookFrame } from "./ui/book-frame.mjs";
import { alignReadingPanes } from "./ui/paired-reading.mjs";
import { readingProblemHTML, addProblemLinks } from "./ui/reading-problem.mjs";
import { sendUnsentUnits } from "./engine/submission.mjs";
import { fetchStats } from "./engine/stats.mjs";
import {
  catalogSections,
  catalogProgress,
  sortCatalog,
  isInterrupted,
} from "./engine/catalog.mjs";
const $ = (s) => document.querySelector(s),
  app = $("#app"),
  store = new AttemptStore();
let catalog = [],
  exam,
  base,
  attempt,
  sectionId,
  reviewing = false,
  solution = false,
  frame,
  selectedField,
  frameObserver,
  releaseLock,
  uiSequence = 0;
const manifests = new Map(),
  documents = new Map();
let activeAnchor = null,
  bookReady = Promise.resolve(),
  historyExpanded = false,
  readingMode = false,
  secondaryObserver = null,
  readingAlignment = null;
const catalogView = {
  mode: "full",
  timeMode: "timed",
  sectionId: "q1",
  order: "recommended",
};
const circle = (value) => "⓪①②③④⑤⑥⑦⑧⑨"[Number(value)] || value;
const resetTop = () =>
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
let reviewState = null;
let navigationContext = {
  origin: "catalog",
  reviewReturn: null,
  readingReturn: null,
};
let rootPositions = { catalog: 0, history: 0 };
let historyTableScroll = 0;
let navigationReplay = false,
  navigationReady = false,
  documentLeaving = false;
const navigationKey = "study-atlas:mock-exams:navigation:v1";
const viewScrollPositions = new Map();
window.history.scrollRestoration = "manual";
const restoreScroll = (top = 0) =>
  requestAnimationFrame(() =>
    window.scrollTo({ top, left: 0, behavior: "instant" }),
  );
function setView(view) {
  if (documentLeaving) return;
  closeHistoryMenu();
  readingAlignment?.();
  readingAlignment = null;
  const previous = document.body.dataset.view;
  if (!navigationReplay && previous === "history")
    historyTableScroll = $(".history-page .table-wrap")?.scrollLeft || 0;
  if (
    !navigationReplay &&
    previous !== view &&
    ["catalog", "history"].includes(previous)
  )
    rootPositions[previous] = window.scrollY;
  document.body.dataset.view = view;
  const kind =
    view === "workspace"
      ? readingMode
        ? navigationContext.readingUnitId
          ? "reading-problem"
          : "reading"
        : reviewing
          ? "review"
          : "workspace"
      : view;
  const state = {
    view: kind,
    id: attempt?.id || null,
    sectionId,
    context: structuredClone(navigationContext),
    roots: { ...rootPositions },
    catalog: { ...catalogView },
    filter: historyFilter,
    grids: structuredClone(historyGrids),
    scrollY: window.scrollY,
    historyTableScroll,
    expanded: historyExpanded,
  };
  const old = window.history.state?.studyAtlasMock;
  const same = old?.view === kind && old?.id === state.id;
  const finalGrade =
    kind === "results" &&
    old?.view === "workspace" &&
    old?.id === state.id &&
    attempt?.status === "graded" &&
    attempt?.gradingKind !== "interim";
  state.entryKey =
    (same || navigationReplay || finalGrade) && old?.entryKey
      ? old.entryKey
      : crypto.randomUUID();
  if (!navigationReplay && old?.entryKey)
    viewScrollPositions.set(old.entryKey, window.scrollY);
  state.parent =
    same || navigationReplay || finalGrade
      ? old?.parent || null
      : old
        ? { view: old.view, id: old.id }
        : null;
  const fragment =
    view === "catalog" ? "" : view === "history" ? "#history" : "#" + state.id;
  if (!navigationReady || navigationReplay || same || finalGrade)
    window.history.replaceState(
      { studyAtlasMock: state },
      "",
      fragment || location.pathname + location.search,
    );
  else {
    if (old)
      window.history.replaceState(
        {
          studyAtlasMock: {
            ...old,
            scrollY: window.scrollY,
            historyTableScroll,
            roots: { ...rootPositions },
          },
        },
        "",
        location.href,
      );
    window.history.pushState(
      { studyAtlasMock: state },
      "",
      fragment || location.pathname + location.search,
    );
  }
  navigationReady = true;
  try {
    sessionStorage.setItem(navigationKey, JSON.stringify(state));
  } catch {}
}
function returnToParent(view) {
  if (documentLeaving) return false;
  const parent = window.history.state?.studyAtlasMock?.parent;
  if (
    parent?.view !== view ||
    (!["catalog", "history"].includes(view) && parent.id !== attempt?.id)
  )
    return false;
  const current = window.history.state.studyAtlasMock;
  window.history.replaceState(
    { studyAtlasMock: { ...current, scrollY: window.scrollY } },
    "",
    location.href,
  );
  window.history.back();
  return true;
}
function captureOrigin() {
  if (!navigationReplay)
    navigationContext = {
      origin: document.body.dataset.view === "history" ? "history" : "catalog",
      reviewReturn: null,
      readingReturn: null,
    };
}
function reviewBackLabel() {
  return navigationContext.reviewReturn?.view === "results"
    ? "採点結果に戻る"
    : "学習履歴に戻る";
}
function readingBackLabel() {
  if (navigationContext.readingUnitId) return "解説に戻る";
  return navigationContext.readingReturn?.view === "review"
    ? "復習に戻る"
    : "採点結果に戻る";
}
function openReview() {
  if (!attempt?.result) return;
  if (!navigationReplay)
    navigationContext.reviewReturn = {
      view: document.body.dataset.view === "history" ? "history" : "results",
      scrollY: window.scrollY,
    };
  reviewState = createReviewSnapshot(attempt);
  reviewing = true;
  readingMode = false;
  solution = false;
  renderWorkspace();
  resetTop();
}
function backFromReview() {
  const target = navigationContext.reviewReturn || { view: "history" };
  if (returnToParent(target.view)) return;
  if (target.view === "history") return leave("history");
  reviewing = false;
  reviewState = null;
  renderResults();
  restoreScroll(target.scrollY);
}
function openReading() {
  if (!navigationReplay) {
    navigationContext.readingUnitId = null;
    navigationContext.readingUnitIds = null;
    navigationContext.problemReturn = null;
    navigationContext.readingReturn = {
      view: reviewing ? "review" : "results",
      sectionId,
      scrollY: window.scrollY,
    };
  }
  readingMode = true;
  solution = true;
  renderWorkspace();
  resetTop();
}
function openReadingProblem(unitIds) {
  const unitId = unitIds[0];
  const unit = exam.scoring.find(
    (u) => u.id === unitId && u.sectionId === sectionId,
  );
  if (!unit || !readingMode) return;
  navigationContext.problemReturn = { sectionId, scrollY: window.scrollY };
  navigationContext.readingUnitId = unitId;
  navigationContext.readingUnitIds = unitIds;
  solution = false;
  renderWorkspace();
  resetTop();
}
function backFromReadingProblem() {
  if (returnToParent("reading")) return;
  const target = navigationContext.problemReturn;
  navigationContext.readingUnitId = null;
  sectionId = target?.sectionId || sectionId;
  solution = true;
  renderWorkspace();
  bookReady.then(() => restoreScroll(target?.scrollY || 0));
}
function backFromReading() {
  if (navigationContext.readingUnitId) return backFromReadingProblem();
  const target = navigationContext.readingReturn || { view: "results" };
  if (returnToParent(target.view)) return;
  readingMode = false;
  solution = false;
  sectionId = target.sectionId || sectionId;
  reviewing = target.view === "review";
  if (reviewing) {
    reviewState ||= createReviewSnapshot(attempt);
    renderWorkspace();
    bookReady.then(() => restoreScroll(target.scrollY));
  } else {
    renderResults();
    restoreScroll(target.scrollY);
  }
}
async function restoreNavigation(state) {
  const targetScroll =
    viewScrollPositions.get(state?.entryKey) ?? state?.scrollY;
  navigationReplay = true;
  try {
    closeAnswer();
    frameObserver?.disconnect();
    secondaryObserver?.disconnect();
    if (attempt?.status === "active" && !reviewing && !readingMode) {
      pause(attempt);
      persist();
    }
    releaseLock?.();
    releaseLock = null;
    attempt = null;
    reviewing = false;
    readingMode = false;
    solution = false;
    reviewState = null;
    const ctx = state?.context;
    navigationContext = {
      origin: ctx?.origin === "history" ? "history" : "catalog",
      reviewReturn: ctx?.reviewReturn || { view: "history" },
      readingReturn: ctx?.readingReturn || { view: "results" },
      scopeSectionId: ctx?.scopeSectionId || null,
      readingUnitId: ctx?.readingUnitId || null,
      readingUnitIds: ctx?.readingUnitIds || null,
      problemReturn: ctx?.problemReturn || null,
    };
    historyTableScroll = Number(state?.historyTableScroll) || 0;
    historyExpanded = !!state?.expanded;
    rootPositions = {
      catalog: Number(state?.roots?.catalog) || 0,
      history: Number(state?.roots?.history) || 0,
    };
    if (["all", "full", "section"].includes(state?.filter))
      historyFilter = state.filter;
    if (state?.grids)
      for (const mode of ["all", "full", "section"])
        if (state.grids[mode]?.sort && state.grids[mode]?.filters)
          historyGrids[mode] = structuredClone(state.grids[mode]);
    if (["full", "section"].includes(state?.catalog?.mode))
      Object.assign(catalogView, state.catalog);
    if (state?.view === "history") renderHistory();
    else if (state?.id && store.load(state.id)) {
      await openAttempt(
        state.id,
        state.view === "review"
          ? "review"
          : state.view === "workspace"
            ? "resume"
            : "result",
      );
      if (!attempt) {
        if (navigationContext.origin === "history") renderHistory();
        else renderCatalog();
        return;
      }
      if (exam.sections.some((s) => s.id === state.sectionId))
        sectionId = state.sectionId;
      if (["reading", "reading-problem"].includes(state.view)) {
        reviewing = navigationContext.readingReturn.view === "review";
        if (reviewing) reviewState = createReviewSnapshot(attempt);
        readingMode = true;
        solution = state.view !== "reading-problem";
        if (state.view === "reading") navigationContext.readingUnitId = null;
        renderWorkspace();
      } else if (
        ["review", "workspace"].includes(state.view) &&
        document.body.dataset.view === "workspace"
      )
        renderWorkspace();
      if (document.body.dataset.view === "workspace") await bookReady;
    } else renderCatalog();
    const scrollY = targetScroll ?? rootPositions[state?.view] ?? 0;
    const current = window.history.state?.studyAtlasMock;
    if (current) {
      const saved = { ...current, scrollY };
      window.history.replaceState({ studyAtlasMock: saved }, "", location.href);
      try {
        sessionStorage.setItem(navigationKey, JSON.stringify(saved));
      } catch {}
    }
    restoreScroll(scrollY);
  } finally {
    navigationReplay = false;
  }
}
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const button = (text, fn, cls = "") => {
  const b = document.createElement("button");
  b.textContent = text;
  b.className = cls;
  b.onclick = async (event) => {
    if (b.disabled) return;
    b.disabled = true;
    try {
      await fn(event);
    } catch (error) {
      notify(
        error.message || "操作を完了できませんでした。もう一度お試しください。",
      );
    } finally {
      b.disabled = false;
    }
  };
  return b;
};
const time = (ms) => {
  const n = Math.floor(ms / 1000);
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
};
let noticeTimer;
function notify(text) {
  clearTimeout(noticeTimer);
  $("#notice").textContent = text;
  if (text === "このブラウザに保存しました")
    noticeTimer = setTimeout(() => {
      $("#notice").textContent = "";
    }, 1600);
}
function persist() {
  try {
    attempt.updatedAt = Date.now();
    store.save(attempt);

    return true;
  } catch {
    notify("保存できません。ブラウザの保存容量や設定を確認してください。");
    return false;
  }
}
function entryFor(id, version) {
  version = compatibleVersion(id, version);
  const current = catalog.find((e) => e.id === id && e.version === version);
  if (current) return current;
  for (const e of catalog.filter((e) => e.id === id)) {
    const old = e.versions?.find((v) => v.version === version);
    if (old) return { ...e, ...old };
  }
  return null;
}
let loadingExam = false;
async function loadExam(entry) {
  if (loadingExam) return false;
  loadingExam = true;
  const sequence = uiSequence;
  const url = new URL(entry.manifest, location.href).href;
  try {
    if (!manifests.has(url))
      manifests.set(
        url,
        fetch(url)
          .then((r) => {
            if (!r.ok)
              throw Error(
                "問題データを読み込めません。もう一度お試しください。",
              );
            return r.json();
          })
          .catch((error) => {
            manifests.delete(url);
            throw error;
          }),
      );
    const loaded = await manifests.get(url);
    if (sequence !== uiSequence) return false;
    validateExam(loaded);
    if (loaded.id !== entry.id || loaded.version !== entry.version)
      throw Error("模試一覧と問題データの番号・版が一致しません。");
    exam = loaded;
    base = new URL(".", url);
    for (const section of exam.sections)
      for (const kind of ["problem", "solution"])
        documentText(
          new URL(
            section[kind === "problem" ? "screenProblem" : "screenSolution"] ||
              section[kind],
            base,
          ).href,
        ).catch(() => {});
    return true;
  } catch (error) {
    notify(
      error.message || "問題データを読み込めません。もう一度お試しください。",
    );
    return false;
  } finally {
    loadingExam = false;
  }
}
function documentText(url) {
  if (!documents.has(url))
    documents.set(
      url,
      fetch(url)
        .then((r) => {
          if (!r.ok)
            throw Error("問題を読み込めません。大問を選び直してください。");
          return r.text();
        })
        .catch((error) => {
          documents.delete(url);
          throw error;
        }),
    );
  return documents.get(url);
}
function closeAnswer() {
  if ($("#answer-dialog").open) $("#answer-dialog").close();
  activeAnchor = null;
}
for (const dialog of document.querySelectorAll("dialog"))
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      dialog.close();
  });
document.addEventListener("pointerdown", (event) => {
  const d = $("#answer-dialog");
  if (
    d.open &&
    d.classList.contains("keypad-popup") &&
    !d.contains(event.target)
  )
    closeAnswer();
});
window.addEventListener("resize", () => positionKeypad());
window.addEventListener(
  "scroll",
  () => {
    positionKeypad();
    const key = window.history.state?.studyAtlasMock?.entryKey;
    if (key && !navigationReplay && !documentLeaving)
      viewScrollPositions.set(key, window.scrollY);
  },
  { passive: true },
);

function ask(title, choices) {
  const d = $("#action-dialog");
  $("#action-title").textContent = title;
  $("#action-options").replaceChildren(
    ...choices.map(([t, fn]) =>
      button(t, () => {
        d.close();
        fn();
      }),
    ),
  );
  d.showModal();
}
$("#close-figure").onclick = () => $("#figure-dialog").close();
$("#close-action").onclick = () => $("#action-dialog").close();
$("#close-answer").onclick = closeAnswer;
async function lockAttempt(id) {
  if (releaseLock) {
    releaseLock();
    releaseLock = null;
  }
  if (!navigator.locks) {
    notify("この受験は同時に複数のタブで開かないでください。");
    return true;
  }
  return new Promise((resolve) =>
    navigator.locks.request(
      "study-atlas-mock-" + id,
      { ifAvailable: true },
      async (lock) => {
        if (!lock) {
          resolve(false);
          return;
        }
        await new Promise((done) => {
          releaseLock = done;
          resolve(true);
        });
      },
    ),
  );
}
function leave(destination = navigationContext.origin) {
  if (!["catalog", "history"].includes(destination))
    destination = navigationContext.origin;
  if (returnToParent(destination)) return;
  closeAnswer();
  frameObserver?.disconnect();
  secondaryObserver?.disconnect();
  if (attempt?.status === "active" && !reviewing && !readingMode) {
    pause(attempt);
    persist();
  }
  releaseLock?.();
  releaseLock = null;
  attempt = null;
  reviewing = false;
  solution = false;
  readingMode = false;
  reviewState = null;
  if (destination === "history") renderHistory();
  else renderCatalog();
  restoreScroll(rootPositions[destination]);
}
async function renderCatalog() {
  setView("catalog");
  uiSequence++;
  app.innerHTML = `
    <div class="catalog-page">
      <section class="intro catalog-intro">
        <p class="eyebrow">PRACTICE / INFORMATION I</p>
        <h1>情報Ⅰ 実戦模試</h1>
        <p>大学入学共通テスト「情報Ⅰ」のオリジナル模試。<br>1回分を通して解くことも、大問ごとに練習することもできます。</p>
      </section>
      <nav id="exam-modes" class="mode-choices" aria-label="受験方式を選ぶ"></nav>
      <section id="time-picker" class="section-picker" aria-labelledby="time-picker-title" ${catalogView.mode === "full" ? "" : "hidden"}>
        <h2 id="time-picker-title">受験時間を選ぶ</h2>
        <div class="time-options" id="catalog-time" role="group" aria-label="受験時間"></div>
      </section>
      <section id="section-picker" class="section-picker" aria-labelledby="section-picker-title" ${catalogView.mode === "section" ? "" : "hidden"}>
        <h2 id="section-picker-title">大問を選ぶ</h2>
        <div class="section-grid" id="catalog-sections" role="group" aria-label="演習する大問"></div>
      </section>
      <section class="exam-picker" aria-labelledby="exam-picker-title">
        <div class="catalog-list-heading">
          <div><p class="eyebrow" id="catalog-context"></p><h2 id="exam-picker-title">模試No.を選ぶ</h2></div>
          <label class="catalog-sort">並び順<select id="catalog-sort"><option value="recommended">おすすめ順</option><option value="newest">新しい順</option><option value="number">番号順</option></select></label>
        </div>
        <div id="exam-list"></div>
      </section>
      <div class="catalog-history-actions"><button id="open-history">学習履歴</button></div>
    </div>`;
  for (const [mode, title, description, meta] of [
    [
      "full",
      "回ごとに受験する",
      "60分・100点の本番形式で実力を確かめる。",
      "1回分を通して",
    ],
    [
      "section",
      "大問ごとに演習する",
      "取り組みたい大問を選んで重点的に練習する。",
      "大問を選んで",
    ],
  ]) {
    const b = button(
      "",
      () => {
        catalogView.mode = mode;
        renderCatalog();
        $('#exam-modes [aria-pressed="true"]').focus({ preventScroll: true });
      },
      "mode-choice",
    );
    b.innerHTML = `<span class="mode-meta">${meta}</span><strong>${title}</strong><span>${description}</span>`;
    b.setAttribute("aria-pressed", String(catalogView.mode === mode));
    $("#exam-modes").append(b);
  }
  for (const [mode, title] of [
    ["timed", "60分で受験する"],
    ["untimed", "時間制限なしで解く"],
  ]) {
    const b = button(title, () => {
      catalogView.timeMode = mode;
      renderCatalog();
      $('#catalog-time [aria-pressed="true"]').focus({ preventScroll: true });
    });
    b.setAttribute("aria-pressed", String(catalogView.timeMode === mode));
    $("#catalog-time").append(b);
  }
  for (const [id, title] of catalogSections) {
    const b = button(title, () => {
      catalogView.sectionId = id;
      renderCatalog();
      $('#catalog-sections [aria-pressed="true"]').focus({
        preventScroll: true,
      });
    });
    b.setAttribute("aria-pressed", String(catalogView.sectionId === id));
    $("#catalog-sections").append(b);
  }
  $("#catalog-context").textContent =
    catalogView.mode === "section"
      ? `${catalogSections.find(([id]) => id === catalogView.sectionId)[1]}の演習`
      : `回ごとに受験 · ${catalogView.timeMode === "timed" ? "60分" : "時間制限なし"}`;
  $("#catalog-sort").value = catalogView.order;
  $("#catalog-sort").onchange = (e) => {
    catalogView.order = e.target.value;
    renderCatalog();
    $("#catalog-sort").focus({ preventScroll: true });
  };
  $("#open-history").onclick = () => renderHistory();
  let history = [];
  try {
    history = store.list();
  } catch {
    notify("ブラウザ保存を利用できません。設定を確認してください。");
  }
  const sectionTitle = catalogSections.find(
    ([id]) => id === catalogView.sectionId,
  )[1];
  for (const entry of sortCatalog(
    catalog,
    history,
    catalogView.mode,
    catalogView.sectionId,
    catalogView.order,
  )) {
    const progress = catalogProgress(
      entry,
      history,
      catalogView.mode,
      catalogView.sectionId,
    );
    const card = document.createElement("article");
    card.className = "exam-card catalog-exam";
    card.dataset.examId = entry.id;
    card.innerHTML = `<div><div class="exam-card-title"><h3>No.${esc(entry.id)}${catalogView.mode === "section" ? "の" + esc(sectionTitle) : ""}</h3><span class="exam-status ${progress.status === "中断中" ? "in-progress" : progress.status === "採点済み" ? "completed" : ""}">${progress.status}</span></div><p>${catalogView.mode === "section" ? esc(sectionTitle) + "の演習" : "1回分・全大問"}${entry.publishedAt ? " · " + esc(entry.publishedAt.slice(0, 7).replace("-", "年") + "月") : ""}</p></div><div class="actions exam-card-actions"></div>`;
    const start = () =>
      begin(
        entry,
        catalogView.mode === "section" ? "section" : catalogView.timeMode,
        catalogView.mode === "section" ? catalogView.sectionId : undefined,
      );
    card
      .querySelector(".actions")
      .append(
        button(
          progress.resume ? "再開" : "選択",
          () =>
            progress.resume
              ? openAttempt(progress.resume.id, "resume")
              : start(),
          "primary",
        ),
      );
    if (progress.resume)
      card
        .querySelector(".actions")
        .append(button("最初から解く", start, "primary"));
    const pdfLinks = document.createElement("div");
    pdfLinks.className = "pdf-links";
    for (const [kind, title] of [
      ["problem", "問題冊子PDF"],
      ["solution", "解答解説PDF"],
    ]) {
      const a = document.createElement("a");
      a.href = new URL(
        kind + ".pdf",
        new URL(".", new URL(entry.manifest, location.href)),
      ).href;
      a.download = `情報Ⅰ_実戦模試_No.${entry.id}_${title}.pdf`;
      a.textContent = title;
      pdfLinks.append(a);
    }
    card.querySelector(".actions").append(pdfLinks);
    $("#exam-list").append(card);
  }
}
let historyFilter = "all";
const historyGrids = Object.fromEntries(
  ["all", "full", "section"].map((mode) => [mode, emptyGridState()]),
);
function renderHistory() {
  setView("history");
  uiSequence++;
  app.innerHTML = `<section class="history-page"><div class="history-page-heading"><div><p class="eyebrow">LEARNING HISTORY</p><h1>学習履歴</h1></div><button id="history-back">模試一覧に戻る</button></div><div class="history-filters" role="group" aria-label="履歴の受験方式"></div><div id="history-grid"></div></section>`;
  $("#history-back").onclick = () => leave("catalog");
  for (const [value, title] of [
    ["all", "すべて"],
    ["full", "回ごと"],
    ["section", "大問ごと"],
  ]) {
    const b = button(title, () => {
      historyFilter = value;
      renderHistory();
      $('.history-filters [aria-pressed="true"]').focus({
        preventScroll: true,
      });
    });
    b.setAttribute("aria-pressed", String(historyFilter === value));
    $(".history-filters").append(b);
  }
  let history = [];
  try {
    history = store.list();
  } catch {
    notify("ブラウザ保存を利用できません。設定を確認してください。");
  }
  renderHistoryGrid($("#history-grid"), {
    rows: historyRows(history, historyFilter),
    state: historyGrids[historyFilter],
    onChange: renderHistory,
    onReset: () => {
      historyGrids[historyFilter] = emptyGridState();
      renderHistory();
    },
    onOpen: (row, action) => openAttempt(row.attempt.id, action, row.sectionId),
    onDelete: (row) =>
      requestDiscard(row.attempt.id, row.derived ? row.sectionId : null),
  });
  $(".history-page .table-wrap").scrollLeft = historyTableScroll;
  resetTop();
}
async function begin(entry, mode, sid) {
  captureOrigin();
  catalogView.mode = mode === "section" ? "section" : "full";
  if (sid) catalogView.sectionId = sid;
  if (mode !== "section") catalogView.timeMode = mode;
  if (!(await loadExam(entry))) return;
  attempt = createAttempt(exam, mode, sid);
  await lockAttempt(attempt.id);
  reviewing = false;
  solution = false;
  readingMode = false;
  sectionId = attempt.sectionIds[0];
  persist();
  renderWorkspace();
  resetTop();
}
async function openAttempt(id, action = "result", scope = null) {
  captureOrigin();
  const a = store.load(id);
  if (!a || a.discardedAt) {
    await renderCatalog();
    return notify("受験記録が見つかりません。");
  }
  if (!navigationReplay)
    navigationContext.scopeSectionId = action === "resume" ? null : scope;
  if (!a.sectionIds.includes(navigationContext.scopeSectionId))
    navigationContext.scopeSectionId = null;
  catalogView.mode = a.mode === "section" ? "section" : "full";
  if (a.mode === "section") catalogView.sectionId = a.sectionIds[0];
  else catalogView.timeMode = a.mode;
  const entry = entryFor(a.examId, a.examVersion);
  if (!entry)
    return notify("この履歴に対応する問題バージョンが見つかりません。");
  if (!(await loadExam(entry))) return;
  if (!(await lockAttempt(id)))
    return notify(
      "この受験は別のタブで開かれています。先にそちらを中断してください。",
    );
  try {
    attempt = restoreAttempt(exam, a);
  } catch {
    return notify(
      "受験記録の形式を確認できません。バックアップを確認してください。",
    );
  }
  reviewing = false;
  solution = false;
  readingMode = false;
  sectionId = scope || navigationContext.scopeSectionId || a.sectionIds[0];
  if (attempt.result && action === "review") openReview();
  else if (attempt.result && action === "resume" && isInterrupted(attempt))
    resumeGraded();
  else if (attempt.result) renderResults();
  else {
    if (attempt.status !== "active") resume(attempt);
    persist();
    renderWorkspace();
    resetTop();
  }
}
function viewSections() {
  return navigationContext.scopeSectionId && (reviewing || readingMode)
    ? [navigationContext.scopeSectionId]
    : attempt.sectionIds;
}
function answers() {
  return reviewing ? reviewState.answers : attempt.answers;
}
function isLocked() {
  return reviewing || readingMode;
}
function navigateSection(id) {
  closeAnswer();
  sectionId = id;
  renderWorkspace();
  bookReady.then(() =>
    frame?.scrollIntoView({ block: "start", behavior: "instant" }),
  );
}
function renderWorkspace() {
  setView("workspace");
  closeAnswer();
  const seq = ++uiSequence;
  frameObserver?.disconnect();
  secondaryObserver?.disconnect();
  const reading = readingMode,
    selectedUnit =
      reading &&
      exam.scoring.find((u) => u.id === navigationContext.readingUnitId),
    readingUnit = selectedUnit && {
      ...selectedUnit,
      fields: (navigationContext.readingUnitIds || [selectedUnit.id]).flatMap(
        (id) =>
          exam.scoring.find((u) => u.id === id && u.sectionId === sectionId)
            ?.fields || [],
      ),
    },
    split = reading && !readingUnit && innerWidth >= 1000;
  if (reading && !readingUnit) solution = true;
  app.innerHTML = `<div class="topline"><div><p class="eyebrow">No.${esc(exam.id)} / ${reading ? "解説" : reviewing ? "復習" : "受験"}</p><h1>${reading ? exam.sections.find((s) => s.id === sectionId).title + (readingUnit ? " " + readingUnit.fields.map((id) => exam.fields.find((f) => f.id === id).label).join("・") + "の問題" : split ? " 問題・解説" : " 解説") : esc(exam.title)}</h1></div></div><div class="workspace-toolbar ${reading ? "reading-toolbar" : ""}"><nav ${reading ? 'id="section-navigation"' : ""} class="book-nav" aria-label="大問を選ぶ"></nav><button id="back-list">${reading ? readingBackLabel() : reviewing ? reviewBackLabel() : navigationContext.origin === "history" ? "学習履歴に戻る" : "一覧に戻る"}</button></div><div class="workspace ${reading ? "reading-layout" : ""}"><div class="book">${split ? '<div class="explanation-panes"><section><h2>問題</h2><iframe id="paired-problem" title="問題（比較表示）" sandbox="allow-same-origin"></iframe></section><section><h2>解説</h2>' : ""}<iframe id="book-frame" title="${reading ? (solution ? "正答・解説" : "問題") : "問題冊子"}" sandbox="allow-same-origin"></iframe>${split ? "</section></div>" : ""}<div id="book-next" class="book-next"></div></div>${reading ? "" : `<aside class="sidebar"><div id="run-actions" class="actions"></div>${reading || reviewing ? "" : `<p>${attempt.mode === "timed" ? "残り時間" : "解答時間"}</p><div id="timer" class="timer"></div>`}<nav id="section-navigation" class="section-navigation" aria-label="大問へ移動"></nav>${reading ? "" : `<details ${innerWidth > 850 ? "open" : ""}><summary>解答状況・見直し</summary><div id="answer-status"></div></details>`}</aside>`}</div>`;
  $("#back-list").onclick = reading
    ? backFromReading
    : reviewing
      ? backFromReview
      : () => requestPause(true);
  if (reviewing && !reading)
    $(".topline").insertAdjacentHTML(
      "afterend",
      '<p class="review-note">復習：採点時の回答と正誤を表示しています。解答は変更できません。</p>',
    );
  const sections = exam.sections.filter((s) => viewSections().includes(s.id));
  for (const section of sections) {
    if (reading) continue;
    for (const nav of [$(".book-nav"), $("#section-navigation")]) {
      const b = button(section.title, () => navigateSection(section.id));
      b.setAttribute("aria-current", String(section.id === sectionId));
      nav.append(b);
    }
  }
  if (reading && !readingUnit) {
    for (const section of sections) {
      const b = button(section.title, () => {
        sectionId = section.id;
        solution = true;
        renderWorkspace();
      });
      b.setAttribute("aria-current", String(section.id === sectionId));
      $("#section-navigation").append(b);
    }
  }
  const next =
    !readingUnit && sections[sections.findIndex((s) => s.id === sectionId) + 1];
  if (next)
    $("#book-next").append(
      button(next.title + " →", () => navigateSection(next.id), "primary"),
    );
  else
    $("#book-next").append(
      button(
        reading
          ? readingBackLabel()
          : reviewing
            ? reviewBackLabel()
            : "ここまでを採点する",
        reading ? backFromReading : reviewing ? backFromReview : doGrade,
        reading || reviewing ? "" : "primary",
      ),
    );
  if (reviewing && !reading)
    $("#run-actions").append(
      button("解説を読む", openReading),
      button(reviewBackLabel(), backFromReview),
    );
  else if (!reading)
    $("#run-actions").append(
      button("採点する", doGrade, "primary"),
      button("中断", () => requestPause(false)),
    );
  if (!reading && !reviewing && attempt.result)
    $(".book-nav").append(
      button("採点結果", () => {
        if (attempt.status === "active" && !reviewing) {
          pause(attempt);
          persist();
        }
        renderResults();
      }),
    );
  frame = $("#book-frame");
  const section = exam.sections.find((s) => s.id === sectionId),
    url = new URL(
      reading && (solution || split)
        ? section.screenSolution || section.solution
        : section.screenProblem || section.problem,
      base,
    ).href;
  bookReady = new Promise(async (resolve) => {
    try {
      let html = await documentText(url);
      if (readingUnit) html = readingProblemHTML(html, readingUnit);
      if (seq !== uiSequence) return resolve();
      frame.onload = () => {
        if (seq !== uiSequence) return resolve();
        const d = frame.contentDocument;
        if (!d?.body) return resolve();
        if (reading && !readingUnit)
          d.documentElement.setAttribute("data-solution-reading", "");
        if (reading && !split && !readingUnit)
          addProblemLinks(d, exam, openReadingProblem);
        d.addEventListener("pointerdown", () => {
          if ($("#answer-dialog").classList.contains("keypad-popup"))
            closeAnswer();
        });
        for (const option of d.querySelectorAll("[data-choice-fields]")) {
          const mark = option.querySelector(
            ":scope > .opt-index,:scope > .option-index",
          );
          if (mark) mark.textContent = circle(option.dataset.choiceValue);
        }
        // External links cannot navigate the application frame.
        d.querySelectorAll('a[href^="http"]').forEach((a) => {
          a.target = "_blank";
          a.rel = "noopener";
        });
        d.querySelectorAll("table").forEach((t) => {
          if (t.parentElement.classList.contains("table-scroll")) return;
          const w = d.createElement("div");
          w.className = "table-scroll";
          t.before(w);
          w.append(t);
        });
        d.querySelectorAll("[data-zoom]").forEach((b) => {
          b.onclick = () => {
            const source = d.getElementById(b.dataset.zoom);
            const visual = source?.matches("svg,img")
              ? source
              : source?.querySelector("svg,img");
            if (!visual) return;
            const clone = visual.cloneNode(true);
            if (clone.tagName === "IMG") clone.src = visual.src;
            $("#figure-dialog .figure-stage").replaceChildren(clone);
            $("#figure-dialog").showModal();
          };
        });
        if (!reading && !reviewing) {
          d.querySelectorAll("[data-field]").forEach((e) => {
            e.tabIndex = 0;
            e.setAttribute("role", "button");
            e.onclick = () => openField(e.dataset.field, e);
            e.onkeydown = (ev) => {
              if (["Enter", " "].includes(ev.key)) {
                ev.preventDefault();
                openField(e.dataset.field, e);
              }
            };
          });
          d.querySelectorAll("[data-choice-fields]").forEach((e) => {
            e.tabIndex = 0;
            e.setAttribute("role", "button");
            const choose = () => {
              const ids = e.dataset.choiceFields.split(" "),
                available = ids.filter((id) => !isLocked(id));
              if (!available.length) return;
              let id = available.includes(selectedField)
                ? selectedField
                : available.find((id) => !answers()[id]);
              if (!id && ids.length > 1) {
                ask(
                  "どの解答欄に入れますか",
                  available.map((id) => [
                    exam.fields.find((f) => f.id === id).label,
                    () => setAnswer(id, e.dataset.choiceValue),
                  ]),
                );
                return;
              }
              setAnswer(id || available[0], e.dataset.choiceValue);
            };
            e.onclick = choose;
            e.onkeydown = (ev) => {
              if (["Enter", " "].includes(ev.key)) {
                ev.preventDefault();
                choose();
              }
            };
          });
        }
        if (!solution || !reading) syncBook();
        let scheduled = false;
        const resize = () => {
          if (scheduled) return;
          scheduled = true;
          requestAnimationFrame(() => {
            scheduled = false;
            if (seq === uiSequence) fitBookFrame(frame);
          });
        };
        frameObserver = new ResizeObserver(resize);
        frameObserver.observe(d.body);
        fitBookFrame(frame);
        resize();
        resolve();
      };
      frame.srcdoc = html.replace(
        /<head[^>]*>/i,
        (match) => match + `<base href="${url}">`,
      );
    } catch (error) {
      if (seq === uiSequence)
        $(".book").prepend(
          Object.assign(document.createElement("p"), {
            textContent: error.message,
          }),
        );
      resolve();
    }
  });
  if (split) {
    let secondaryResolve;
    const secondaryReady = new Promise((resolve) => {
      secondaryResolve = resolve;
    });
    const other = $("#paired-problem"),
      url = new URL(section.screenProblem || section.problem, base).href;
    documentText(url)
      .then((html) => {
        if (seq !== uiSequence) return secondaryResolve();
        other.onload = () => {
          if (seq !== uiSequence) return secondaryResolve();
          const d = other.contentDocument;
          for (const e of d.querySelectorAll("[data-field]")) {
            const f = exam.fields.find((f) => f.id === e.dataset.field);
            if (f)
              e.textContent = displayValue(f, attempt.gradedAnswers?.[f.id], e);
          }
          syncBook(d);
          d.querySelectorAll("table").forEach((t) => {
            const w = d.createElement("div");
            w.className = "table-scroll";
            t.before(w);
            w.append(t);
          });
          const resize = () => {
            fitBookFrame(other);
          };
          secondaryObserver = new ResizeObserver(resize);
          secondaryObserver.observe(d.body);
          resize();
          secondaryResolve();
        };
        other.srcdoc = html.replace(
          /<head[^>]*>/i,
          (match) => match + `<base href="${url}">`,
        );
      })
      .catch(() => secondaryResolve());
    bookReady = Promise.all([bookReady, secondaryReady]).then(() => {
      if (seq === uiSequence)
        readingAlignment = alignReadingPanes(other, frame);
    });
  }
  renderStatus();
  tick();
}
window.matchMedia("(min-width:1000px)").addEventListener("change", () => {
  if (readingMode && attempt) renderWorkspace();
});

function renderStatus() {
  const out = $("#answer-status");
  if (!out) return;
  out.replaceChildren();
  for (const s of exam.sections.filter((s) => viewSections().includes(s.id))) {
    const h = document.createElement("h3");
    h.textContent = s.title;
    out.append(h);
    const g = document.createElement("div");
    g.className = "answer-grid";
    for (const f of exam.fields.filter((f) => f.sectionId === s.id)) {
      const val = answers()[f.id] || "",
        flag = attempt.flags.includes(f.id);
      const b = button(
        `${f.label} ${val || "—"}${flag ? " 🏳️" : ""}`,
        async () => {
          closeAnswer();
          if (sectionId !== f.sectionId || solution) {
            sectionId = f.sectionId;
            solution = false;
            renderWorkspace();
          }
          await bookReady;
          const el = frame.contentDocument.querySelector(
            `[data-field="${f.id}"]`,
          );
          if (el) {
            el.scrollIntoView({ block: "center" });
            el.focus({ preventScroll: true });
          }
        },
        `${val ? "answered" : ""} ${flag ? "flagged" : ""}`,
      );
      b.setAttribute(
        "aria-label",
        `${s.title} ${f.label} ${val ? "回答 " + val : "未回答"}${flag ? " 見直し" : ""}`,
      );
      g.append(b);
    }
    out.append(g);
  }
}
function displayValue(f, value, e) {
  const label = e?.dataset.original || f.label;
  if (!value) return label;
  if (f.type === "text") return `${label} ${value}`;
  const c = f.choices.find((c) => c.value === value);
  if (e?.dataset.part !== undefined)
    return `${label} ${c?.parts?.[Number(e.dataset.part)] || value}`;
  if (e?.dataset.display === "content")
    return `${label} ${circle(value)} ${c?.text || value}`;
  return `${label} ${circle(value)}`;
}

function syncBook(d = frame?.contentDocument) {
  if (!d || (d === frame?.contentDocument && solution)) return;
  const result = reviewing ? reviewState.result : attempt.result;
  const values = reviewing
    ? reviewState.answers
    : readingMode
      ? attempt.gradedAnswers || {}
      : attempt.answers;
  for (const e of d.querySelectorAll("[data-field]")) {
    const f = exam.fields.find((f) => f.id === e.dataset.field);
    if (!f) continue;
    const value = values[f.id] || "";
    e.textContent = displayValue(f, value, e);
    e.dataset.filled = String(!!value);
    e.dataset.locked = String(isLocked(f.id));
    e.dataset.readonly = String(reviewing || readingMode);
    e.setAttribute("aria-label", `解答欄${f.label}: ${value || "未回答"}`);
    e.setAttribute("aria-disabled", String(isLocked(f.id)));
    delete e.dataset.verdict;
    if ((reviewing || attempt.showCorrectness) && result) {
      const u = result.units.find((u) => u.fields.includes(f.id));
      if (u && u.answers.every((v, i) => v === (values[u.fields[i]] || "")))
        e.dataset.verdict = !u.answered
          ? "unanswered"
          : u.correct
            ? "correct"
            : u.points > 0
              ? "partial"
              : "incorrect";
    }
  }
  for (const e of d.querySelectorAll("[data-position]")) {
    let label = e.querySelector(".mock-insert");
    if (!label) {
      label = d.createElement("span");
      label.className = "mock-insert";
      e.append(label);
    }
    label.textContent =
      values["q3-コ"] === e.dataset.position ? " kakuteisu = 0" : "";
  }
  for (const e of d.querySelectorAll("[data-choice-fields]")) {
    const selected = e.dataset.choiceFields
      .split(" ")
      .some((id) => values[id] === e.dataset.choiceValue);
    e.dataset.selected = String(selected);
    e.dataset.readonly = String(reviewing || readingMode);
    delete e.dataset.verdict;
    if (selected && reviewing) {
      const ids = e.dataset.choiceFields.split(" "),
        unit = result.units.find((u) => u.fields.includes(ids[0]));
      if (unit)
        e.dataset.verdict = unit.correct
          ? "correct"
          : unit.points > 0
            ? "partial"
            : "incorrect";
    }
    e.setAttribute("aria-pressed", String(selected));
  }
}
function setAnswer(id, value) {
  if (isLocked(id)) return;
  const f = exam.fields.find((f) => f.id === id);
  try {
    answers()[id] = normalize(f, value);
  } catch {
    return;
  }
  persist();
  syncBook();
  renderStatus();
  if (selectedField === id && $("#answer-dialog").open) {
    renderEditor();
    positionKeypad();
  }
}
function positionKeypad() {
  const d = $("#answer-dialog");
  if (
    !d.open ||
    !d.classList.contains("keypad-popup") ||
    !activeAnchor?.isConnected
  )
    return;
  const local = activeAnchor.getBoundingClientRect(),
    fr = frame.getBoundingClientRect();
  const r = {
    left: fr.left + local.left,
    top: fr.top + local.top,
    bottom: fr.top + local.bottom,
  };
  const gap = 8,
    margin = 10,
    width = Math.min(310, innerWidth - margin * 2);
  d.style.width = width + "px";
  d.style.maxHeight = innerHeight - 2 * margin + "px";
  const h = d.getBoundingClientRect().height,
    below = innerHeight - r.bottom - gap - margin,
    above = r.top - gap - margin;
  const bottom = below >= h || below >= above;
  const available = bottom ? below : above;
  if (available > 200) d.style.maxHeight = Math.min(h, available) + "px";
  const height = d.getBoundingClientRect().height;
  d.style.left =
    Math.max(margin, Math.min(r.left, innerWidth - width - margin)) + "px";
  d.style.top =
    Math.max(
      margin,
      Math.min(
        bottom ? r.bottom + gap : r.top - gap - height,
        innerHeight - height - margin,
      ),
    ) + "px";
}
function openField(id, anchor) {
  if (isLocked(id)) return;
  closeAnswer();
  selectedField = id;
  activeAnchor = anchor;
  const f = exam.fields.find((f) => f.id === id);
  if (!f) return;
  const d = $("#answer-dialog");
  d.removeAttribute("style");
  d.classList.toggle("keypad-popup", f.type === "text");
  renderEditor();
  if (f.type === "text") {
    d.show();
    positionKeypad();
  } else d.showModal();
}

function renderEditor() {
  const f = exam.fields.find((f) => f.id === selectedField),
    value = answers()[f.id] || "";
  $("#answer-title").textContent =
    `${exam.sections.find((s) => s.id === f.sectionId).title}　解答欄 ${f.label}`;
  const out = $("#answer-options");
  out.replaceChildren();
  if (f.type === "text") {
    const display = document.createElement("div");
    display.className = "key-display";
    display.textContent = value || "—";
    display.setAttribute("aria-live", "polite");
    out.append(display);
    const keys = document.createElement("div");
    keys.className = "keypad";
    for (const c of "0123456789ABCDEF") {
      const b = button(c, () =>
        setAnswer(f.id, (value + c).slice(-f.maxLength)),
      );
      b.disabled = !f.allowed.includes(c);
      keys.append(b);
    }
    out.append(
      keys,
      button("1文字削除", () => setAnswer(f.id, value.slice(0, -1))),
    );
  } else {
    for (const c of f.choices) {
      const b = button(
        `${c.value === value ? "✓ " : ""}${"⓪①②③④⑤⑥⑦⑧⑨"[Number(c.value)] || c.value} ${c.text}`,
        () => {
          setAnswer(f.id, c.value);
          $("#answer-dialog").close();
        },
      );
      b.setAttribute("aria-pressed", String(c.value === value));
      out.append(b);
    }
  }
  $("#flag-answer").textContent = attempt.flags.includes(f.id)
    ? "🏳️ 見直しを解除"
    : "🏳️ 見直し";
}
$("#clear-answer").onclick = () => setAnswer(selectedField, "");
$("#flag-answer").onclick = () => {
  const i = attempt.flags.indexOf(selectedField);
  if (i < 0) attempt.flags.push(selectedField);
  else attempt.flags.splice(i, 1);
  persist();
  renderEditor();
  renderStatus();
};
$("#answer-dialog").addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    e.preventDefault();
    closeAnswer();
    return;
  }
  const f = exam.fields.find((f) => f.id === selectedField);
  if (f?.type !== "text" || e.ctrlKey || e.metaKey || e.altKey) return;
  let value = answers()[f.id] || "";
  if (e.key === "Backspace") {
    e.preventDefault();
    setAnswer(f.id, value.slice(0, -1));
  } else if (e.key.length === 1 && f.allowed.includes(e.key.toUpperCase())) {
    e.preventDefault();
    setAnswer(f.id, (value + e.key.toUpperCase()).slice(-f.maxLength));
  } else if (e.key === "Enter") {
    $("#answer-dialog").close();
  }
});
function requestPause(toList) {
  if (reviewing || readingMode) return;
  ask("中断のしかたを選ぶ", [
    [
      "採点せずに中断",
      () => {
        pause(attempt);
        persist();
        leave();
      },
    ],
    ["ここまでを採点して中断", () => doGrade("interim")],
  ]);
}
function doGrade(kind = "final") {
  if ($("#answer-dialog").open) $("#answer-dialog").close();
  if (reviewing || readingMode) return;
  submit(exam, attempt);
  attempt.gradingKind = kind === "interim" ? "interim" : "final";
  persist();
  renderResults({ record: true });
}
function tick() {
  if (!attempt || !$("#timer")) return;
  const ms = elapsed(attempt);
  $("#timer").textContent = reviewing
    ? "成績には反映しません"
    : time(
        attempt.mode === "timed"
          ? Math.max(0, exam.durationSeconds * 1000 - ms)
          : ms,
      );
  if (
    !reviewing &&
    attempt.status === "active" &&
    attempt.mode === "timed" &&
    ms >= exam.durationSeconds * 1000
  ) {
    attempt.elapsedMs = exam.durationSeconds * 1000;
    attempt.startedAt = null;
    doGrade();
    notify("制限時間になったため採点しました。");
  }
}
setInterval(tick, 1000);
// A restore aborted during unload must not rewrite the next document's URL.
window.addEventListener("beforeunload", () => {
  documentLeaving = true;
});
window.addEventListener("pageshow", () => {
  documentLeaving = false;
});
window.addEventListener("pagehide", () => {
  documentLeaving = true;
  const current = window.history.state?.studyAtlasMock;
  if (current) {
    const saved = {
      ...current,
      scrollY: window.scrollY,
      historyTableScroll:
        document.body.dataset.view === "history"
          ? $(".history-page .table-wrap")?.scrollLeft || 0
          : historyTableScroll,
    };
    window.history.replaceState({ studyAtlasMock: saved }, "", location.href);
    try {
      sessionStorage.setItem(navigationKey, JSON.stringify(saved));
    } catch {}
  }
  if (attempt?.status === "active" && !reviewing && !readingMode) persist();
});
document.addEventListener("visibilitychange", () => {
  if (
    document.hidden &&
    attempt?.status === "active" &&
    !reviewing &&
    !readingMode
  )
    persist();
});
function scoreMark(unit) {
  return unit.correct ? "○" : unit.points > 0 ? `△${unit.points}` : "✕";
}
function fullPatterns(rule, max) {
  if (rule.kind === "cases")
    return rule.cases.filter((c) => c.points === max).map((c) => c.answers);
  if (rule.kind === "conditional")
    return [...fullPatterns(rule.then, max), ...fullPatterns(rule.else, max)];
  return rule.patterns || [];
}
function answerMark(field, value) {
  return value ? (field.type === "choice" ? circle(value) : value) : "—";
}
function requestDiscard(id, scope = null) {
  const remove = () => {
    if (attempt?.id === id) discardAttempt(id);
    else {
      store.discard(id);
      renderHistory();
    }
  };
  if (!scope) return remove();
  const title =
    catalogSections.find(([value]) => value === scope)?.[1] || "この大問";
  ask(
    `${title}は通し受験から表示しています。削除すると元の通し受験全体の履歴が消えます。`,
    [
      ["元の通し受験の履歴を削除する", remove],
      ["キャンセル", () => {}],
    ],
  );
}
function discardAttempt(id) {
  store.discard(id);
  if (attempt?.id === id) {
    releaseLock?.();
    releaseLock = null;
    attempt = null;
    reviewing = false;
    solution = false;
    reviewState = null;
  }
  if (navigationContext.origin === "history") renderHistory();
  else renderCatalog();
  restoreScroll(rootPositions[navigationContext.origin]);
  notify("この端末の履歴から削除しました");
}
function renderUnitTable(r, runs) {
  const out = $("#unit-results"),
    head = $("#unit-head");
  out.replaceChildren();
  const older = historyExpanded ? runs.filter((a) => a.id !== attempt.id) : [];
  head.innerHTML = `<tr><th>問題番号<br>（配点）</th><th>設問</th><th>解答<br>記号</th><th>正解</th><th>配点</th>${older.map((a, i) => `<th>${i + 1}回目の回答</th><th>${i + 1}回目の得点</th>`).join("")}<th>${historyExpanded ? "今回の回答" : "あなたの回答"}</th><th>${historyExpanded ? "今回の得点" : "正誤"}</th><th>平均<br>得点率</th></tr>`;
  const units = r.units;
  for (let n = 0; n < units.length; n++) {
    const u = units[n],
      def = exam.scoring.find((x) => x.id === u.id),
      section = exam.sections.find((x) => x.id === u.sectionId),
      question = def.question || 1;
    const sectionUnits = units.filter((x) => x.sectionId === u.sectionId),
      questionUnits = sectionUnits.filter(
        (x) =>
          (exam.scoring.find((d) => d.id === x.id).question || 1) === question,
      );
    const firstSection = sectionUnits[0].id === u.id,
      firstQuestion = questionUnits[0].id === u.id;
    const patterns = fullPatterns(def.rule, def.maxPoints);
    u.fields.forEach((id, index) => {
      const f = exam.fields.find((x) => x.id === id),
        tr = document.createElement("tr");
      let cells = "";
      if (index === 0 && firstSection)
        cells += `<th rowspan="${sectionUnits.reduce((n, u) => n + u.fields.length, 0)}" scope="rowgroup">${esc(section.title)}<br>（${section.maxPoints}）</th>`;
      if (index === 0 && firstQuestion)
        cells += `<td rowspan="${questionUnits.reduce((n, u) => n + u.fields.length, 0)}">${question}</td>`;
      cells += `<th scope="row"><span class="answer-symbol">${esc(f.label)}</span></th><td>${[...new Set(patterns.map((p) => answerMark(f, p[index])))].map(esc).join(" / ")}</td>`;
      if (index === 0)
        cells += `<td rowspan="${u.fields.length}">${u.maxPoints}${u.fields.length > 1 ? "＊" : ""}</td>`;
      for (const old of older) {
        const unit = old.result.units.find((x) => x.id === u.id);
        cells += `<td>${esc(answerMark(f, unit?.answers[index]))}</td>`;
        if (index === 0)
          cells += `<td rowspan="${u.fields.length}">${unit ? unit.points : "—"}</td>`;
      }
      cells += `<td class="your-answer">${esc(answerMark(f, u.answers[index]))}</td>`;
      if (index === 0)
        cells += `<td rowspan="${u.fields.length}" class="${u.correct ? "correct" : u.points > 0 ? "partial" : "incorrect"}">${historyExpanded ? u.points : scoreMark(u)}</td><td rowspan="${u.fields.length}" data-unit-rate="${u.id}">—</td>`;
      tr.innerHTML = cells;
      out.append(tr);
    });
  }
  const table = $("#unit-table");
  table.classList.toggle("with-history", historyExpanded);
  $("#unit-block").classList.toggle("expanded", historyExpanded);
  $("#toggle-history").textContent = historyExpanded
    ? "過去の成績を閉じる"
    : "過去の成績も表示する";
}
let resultStats = null;
function applyResultStats(stats, r) {
  for (const section of r.sections) {
    const v = stats.sections[section.id];
    $(`#avg-${section.id}`).textContent =
      v.points === null ? "—" : v.points.toFixed(1) + "点";
    $(`#rate-${section.id}`).textContent =
      v.rate === null ? "—" : (v.rate * 100).toFixed(1) + "%";
  }
  for (const u of stats.units) {
    const el = document.querySelector(`[data-unit-rate="${u.id}"]`);
    if (el)
      el.textContent =
        u.averageRate === null ? "—" : (u.averageRate * 100).toFixed(1) + "%";
  }
  const relevant = r.sections.map((s) => stats.sections[s.id]);
  const ready = relevant.every((s) => s.available),
    points = ready ? relevant.reduce((n, s) => n + s.points, 0) : null;
  $("#avg-total").textContent =
    points === null ? "—" : points.toFixed(1) + "点";
  $("#rate-total").textContent =
    points === null ? "—" : ((points / r.maxPoints) * 100).toFixed(1) + "%";
}
function renderResults({ record = false } = {}) {
  setView("results");
  closeAnswer();
  const seq = ++uiSequence;
  frameObserver?.disconnect();
  secondaryObserver?.disconnect();
  solution = false;
  readingMode = false;
  const current = attempt,
    r = sliceResult(current.result, navigationContext.scopeSectionId);
  if (!r) return renderWorkspace();
  app.innerHTML = `<section class="results"><div class="result-heading"><div><p class="eyebrow">No.${esc(exam.id)} / RESULT</p><h1>採点結果</h1></div></div><div class="summary-block"><div class="actions result-actions" id="result-actions"></div><div class="table-wrap"><table class="summary-table"><thead><tr><th>大問</th><th>あなたの得点</th><th>あなたの得点率</th><th>平均得点</th><th>平均得点率</th></tr></thead><tbody id="section-results"></tbody><tfoot><tr><th>合計</th><td>${r.points} / ${r.maxPoints}点</td><td>${((r.points / r.maxPoints) * 100).toFixed(1)}%</td><td id="avg-total">—</td><td id="rate-total">—</td></tr></tfoot></table></div></div><div class="unit-block" id="unit-block"><div class="unit-heading"><h2>解答・採点</h2><button id="toggle-history" class="subtle-button">過去の成績も表示する</button></div><div class="table-wrap unit-table-wrap"><table id="unit-table"><thead id="unit-head"></thead><tbody id="unit-results"></tbody></table></div><p class="muted score-footnote">＊は複数の解答欄をまとめて採点します。</p></div></section>`;
  if (isInterrupted(current))
    $("#result-actions").append(button("解答を再開", () => resumeGraded()));
  $("#result-actions").append(
    button("解説を読む", openReading),
    button("一覧に戻る", () => leave("catalog"), "back-to-catalog"),
    button("学習履歴に戻る", () => leave("history"), "back-to-history"),
    button(
      "この採点結果を破棄する",
      () =>
        requestDiscard(
          current.id,
          navigationContext.scopeSectionId && current.mode !== "section"
            ? navigationContext.scopeSectionId
            : null,
        ),
      "subtle-danger discard-result",
    ),
  );
  $(".discard-result").id = "discard-result";
  for (const section of r.sections)
    $("#section-results").insertAdjacentHTML(
      "beforeend",
      `<tr><th>${esc(section.title)}</th><td>${section.points} / ${section.maxPoints}点</td><td>${((section.points / section.maxPoints) * 100).toFixed(1)}%</td><td id="avg-${section.id}">—</td><td id="rate-${section.id}">—</td></tr>`,
    );
  const runs = store
    .list()
    .filter(
      (a) =>
        a.examId === current.examId &&
        compatibleVersion(a.examId, a.examVersion) === current.examVersion &&
        a.mode === current.mode &&
        a.sectionIds.join() === current.sectionIds.join() &&
        a.result &&
        a.createdAt <= current.createdAt,
    )
    .sort((a, b) => a.createdAt - b.createdAt);
  renderUnitTable(r, runs);
  $("#toggle-history").onclick = () => {
    historyExpanded = !historyExpanded;
    setView("results");
    renderUnitTable(r, runs);
    if (resultStats) applyResultStats(resultStats, r);
  };
  resultStats = null;
  resetTop();
  const activeExam = exam;
  const update = (rows) => {
    if (seq !== uiSequence || attempt !== current) return;
    resultStats = calculateStats(activeExam, rows);
    applyResultStats(resultStats, r);
  };
  fetchStats(activeExam)
    .then(update)
    .catch(() => {});
  // The result screen is already visible. Network requests only update its cells.
  if (record && !reviewing) {
    try {
      store.save(current);
    } catch {
      return;
    }
    sendUnsentUnits(activeExam, current, store)
      .then((ack) => {
        if (ack.status === "sent" && ack.count && seq === uiSequence)
          return fetchStats(activeExam).then(update);
      })
      .catch(() => {});
  }
}

function resumeGraded() {
  navigationContext.scopeSectionId = null;
  solution = false;
  readingMode = false;
  reviewing = false;
  if (
    attempt.mode === "timed" &&
    elapsed(attempt) >= exam.durationSeconds * 1000
  ) {
    ask("制限時間後の継続", [
      [
        "時間制限を外して同じ受験を続ける",
        () => {
          attempt.continuedAfterDeadline = true;
          attempt.originalMode ||= attempt.mode;
          attempt.mode = "untimed";
          resume(attempt, false);
          persist();
          renderWorkspace();
        },
      ],
    ]);
  } else {
    resume(attempt, false);
    persist();
    renderWorkspace();
  }
}
try {
  catalog = await fetch("catalog.json").then((r) => r.json());
  if (document.querySelector('meta[name="mock-exams-preview-samples"]')) {
    try {
      const { seedPreviewHistory } =
        await import("./engine/preview-history.mjs");
      await seedPreviewHistory(catalog, store);
    } catch {
      notify("サンプル履歴を準備できませんでした。");
    }
  }
  let saved = window.history.state?.studyAtlasMock;
  if (!saved) {
    try {
      saved = JSON.parse(sessionStorage.getItem(navigationKey));
    } catch {}
  }
  const fragment = location.hash.slice(1);
  if (
    saved &&
    ((fragment === "history" && saved.view === "history") ||
      (fragment && fragment === saved.id) ||
      (!fragment && saved.view === "catalog"))
  )
    await restoreNavigation(saved);
  else if (fragment === "history") renderHistory();
  else if (fragment && store.load(fragment)) await openAttempt(fragment);
  else await renderCatalog();
  window.addEventListener("popstate", (event) => {
    const fragment = location.hash.slice(1);
    const stored =
      fragment && fragment !== "history" ? store.load(fragment) : null;
    const routed = event.state?.studyAtlasMock;
    const matches =
      routed &&
      (fragment === "history"
        ? routed.view === "history"
        : fragment
          ? routed.id === fragment
          : routed.view === "catalog");
    const state =
      (matches ? routed : null) ||
      (fragment === "history"
        ? { view: "history" }
        : stored
          ? { view: stored.result ? "results" : "workspace", id: fragment }
          : { view: "catalog" });
    restoreNavigation(state).catch(() => {
      navigationReplay = false;
      if (!documentLeaving) leave("catalog");
    });
  });
} catch (e) {
  app.innerHTML = `<p class="error-note">読み込みに失敗しました。${esc(e.message)}</p>`;
}
