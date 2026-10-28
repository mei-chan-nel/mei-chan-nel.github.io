import {
  grade,
  normalize,
  validateExam,
  correctPatterns,
  calculateStats,
} from "./engine/scoring.mjs";
import {
  AttemptStore,
  createAttempt,
  elapsed,
  pause,
  resume,
  submit,
  startReview,
  gradeReview,
  restoreAttempt,
  compatibleVersion,
} from "./engine/attempt.mjs";
import { sendUnsentUnits } from "./engine/submission.mjs";
import { fetchStats } from "./engine/stats.mjs";
import {
  catalogSections,
  catalogProgress,
  sortCatalog,
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
  secondaryObserver = null;
const catalogView = { mode: "full", sectionId: "q1", order: "recommended" };
const circle = (value) => "⓪①②③④⑤⑥⑦⑧⑨"[Number(value)] || value;
const resetTop = () =>
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
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
  b.onclick = fn;
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
    notify(
      "保存できません。履歴を書き出してから容量やブラウザの設定を確認してください。",
    );
    return false;
  }
}
function download(name, content, type = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
async function loadExam(entry) {
  const url = new URL(entry.manifest, location.href).href;
  if (!manifests.has(url))
    manifests.set(
      url,
      fetch(url).then((r) => {
        if (!r.ok) throw Error("問題データを読み込めません");
        return r.json();
      }),
    );
  exam = await manifests.get(url);
  validateExam(exam);
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
}
function documentText(url) {
  if (!documents.has(url))
    documents.set(
      url,
      fetch(url).then((r) => {
        if (!r.ok) throw Error("問題を読み込めません");
        return r.text();
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
window.addEventListener("scroll", () => positionKeypad(), { passive: true });

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
function leave() {
  closeAnswer();
  frameObserver?.disconnect();
  secondaryObserver?.disconnect();
  if (attempt?.status === "active" && !reviewing) {
    pause(attempt);
    persist();
  }
  releaseLock?.();
  releaseLock = null;
  attempt = null;
  reviewing = false;
  solution = false;
  readingMode = false;
  location.hash = "";
  renderCatalog();
  resetTop();
}
async function renderCatalog() {
  uiSequence++;
  app.innerHTML = `
    <div class="catalog-page">
      <section class="intro catalog-intro">
        <p class="eyebrow">PRACTICE / INFORMATION I</p>
        <h1>情報Ⅰ 実戦模試</h1>
        <p>大学入学共通テスト「情報Ⅰ」のオリジナル模試。<br>1回分を通して解くことも、大問ごとに練習することもできます。</p>
      </section>
      <nav id="exam-modes" class="mode-choices" aria-label="受験方式を選ぶ"></nav>
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
      <a class="history-entry" href="#history"><span><strong>受験履歴・復習</strong><small>過去の成績を確認し、間違えた問題や未解答の問題を解き直す。</small></span><span aria-hidden="true">↓</span></a>
      <section class="history-card" id="history" aria-labelledby="history-title">
        <h2 id="history-title">このブラウザの学習履歴</h2>
        <p class="muted">回ごと・大問ごとの記録を確認できます。採点結果の「解答に戻る」→「正誤表記あり」で復習できます。</p>
        <div id="history-list"></div>
        <details class="history-backup"><summary>履歴の保存・読み込み</summary><p class="muted">履歴はこの端末に保存されます。ブラウザのデータ削除に備えて書き出して保管できます。</p><div class="actions" id="history-actions"></div></details>
      </section>
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
      : "回ごとに受験";
  $("#catalog-sort").value = catalogView.order;
  $("#catalog-sort").onchange = (e) => {
    catalogView.order = e.target.value;
    renderCatalog();
    $("#catalog-sort").focus({ preventScroll: true });
  };
  // Keep this local navigation out of the attempt-ID URL fragment.
  $(".history-entry").onclick = (e) => {
    e.preventDefault();
    $("#history").scrollIntoView({ block: "start", behavior: "instant" });
    $("#history-title").tabIndex = -1;
    $("#history-title").focus({ preventScroll: true });
  };
  $("#history-actions").append(
    button("履歴を書き出す", () =>
      download("study-atlas-mock-history.json", store.export()),
    ),
  );
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.hidden = true;
  input.onchange = async () => {
    try {
      const data = JSON.parse(await input.files[0].text());
      if (data.schemaVersion !== 1 || !Array.isArray(data.attempts))
        throw Error();
      for (const raw of data.attempts) {
        const entry = entryFor(raw.examId, raw.examVersion);
        if (!entry) throw Error();
        await loadExam(entry);
        const a = restoreAttempt(exam, raw);
        const old = store.load(a.id);
        if (!old || a.updatedAt > old.updatedAt) {
          a.startedAt = null;
          a.status = a.result ? "graded" : "paused";
          store.save(a);
        } else {
          store.saveStatistics(a);
        }
      }
      renderCatalog();
      notify("履歴を読み込みました");
    } catch {
      notify("履歴ファイルを読み込めませんでした。");
    }
  };
  $("#history-actions").append(
    button("履歴を読み込む", () => input.click()),
    input,
  );
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
    card.innerHTML = `<div><div class="exam-card-title"><h3>No.${esc(entry.id)}</h3><span class="exam-status ${progress.status === "中断中" ? "in-progress" : progress.status === "採点済み" ? "completed" : ""}">${progress.status}</span></div><p>${catalogView.mode === "section" ? esc(sectionTitle) + "の演習" : "1回分・全大問"}${entry.publishedAt ? " · " + esc(entry.publishedAt.slice(0, 7).replace("-", "年") + "月") : ""}</p></div><div class="actions exam-card-actions"></div>`;
    card.querySelector(".actions").append(
      button(
        progress.resume ? "再開" : "選択",
        () =>
          progress.resume
            ? openAttempt(progress.resume.id)
            : catalogView.mode === "section"
              ? begin(entry, "section", catalogView.sectionId)
              : renderExamDetail(entry),
        "primary",
      ),
      button("詳細・PDF", () => renderExamDetail(entry), "detail-link"),
    );
    $("#exam-list").append(card);
  }
  if (!history.length)
    $("#history-list").innerHTML =
      '<p class="muted">まだ受験記録がありません。</p>';
  for (const a of history) {
    const row = document.createElement("div");
    row.className = "actions history-row";
    const description = document.createElement("div");
    description.className = "history-description";
    const scope =
      a.mode === "section"
        ? catalogSections.find(([id]) => id === a.sectionIds[0])?.[1] ||
          "大問別"
        : a.mode === "timed"
          ? "回ごと・60分"
          : "回ごと・時間制限なし";
    description.innerHTML = `<strong>No.${esc(a.examId)} · ${scope}</strong><span>${new Date(a.createdAt).toLocaleString("ja-JP")} · ${a.result ? `${a.result.points} / ${a.result.maxPoints}点` : "中断中"}</span>`;
    row.append(
      description,
      button("開く", () => openAttempt(a.id)),
      button(
        "削除",
        () => {
          store.discard(a.id);
          renderCatalog();
        },
        "subtle-danger",
      ),
    );
    $("#history-list").append(row);
  }
}
async function renderExamDetail(entry) {
  const seq = ++uiSequence;
  app.innerHTML =
    '<div class="catalog-page"><p role="status">模試の詳細を読み込んでいます…</p></div>';
  try {
    await loadExam(entry);
    if (seq !== uiSequence) return;
    const section =
      catalogView.mode === "section" &&
      exam.sections.find((s) => s.id === catalogView.sectionId);
    const progress = catalogProgress(
      entry,
      store.list(),
      catalogView.mode,
      catalogView.sectionId,
    );
    app.innerHTML = `<section class="exam-card exam-detail"><button id="back-catalog" class="detail-link">← 模試No.の一覧に戻る</button><p class="eyebrow">${section ? "大問ごとに演習する" : "回ごとに受験する"}</p><h1>${esc(entry.title)}</h1><p class="detail-meta">${section ? `${esc(section.title)} · ${section.maxPoints}点` : `全大問 · ${exam.maxPoints}点 · ${exam.durationSeconds / 60}分`}</p><p>${section ? "選択した大問だけを解答・採点します。時間制限はありません。" : "時間あり・時間なしを選んで、第1問から第4問まで通して解きます。"}</p><div class="actions modes" id="exam-start"></div><section class="detail-print"><h2>PDFで解く・読む</h2><p class="muted">この模試No.の全大問を収録しています。</p><div class="actions print-actions"></div></section></section>`;
    $("#back-catalog").onclick = () => {
      renderCatalog();
      resetTop();
    };
    if (progress.resume)
      $("#exam-start").append(
        button(
          "中断した受験を再開",
          () => openAttempt(progress.resume.id),
          "primary",
        ),
      );
    else if (progress.latest)
      $("#exam-start").append(
        button("前回の採点結果を開く", () => openAttempt(progress.latest.id)),
      );
    if (section)
      $("#exam-start").append(
        button(
          `${section.title}を解く`,
          () => begin(entry, "section", section.id),
          "primary",
        ),
      );
    else
      $("#exam-start").append(
        button("60分で受験する", () => begin(entry, "timed"), "primary"),
        button("時間制限なしで解く", () => begin(entry, "untimed")),
      );
    for (const [kind, title] of [
      ["problem", "問題冊子 PDF"],
      ["solution", "正答・解説 PDF"],
    ]) {
      const a = document.createElement("a");
      a.className = "mock-button";
      a.href = new URL(kind + ".pdf", base).href;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = title;
      $(".print-actions").append(a);
    }
    resetTop();
  } catch {
    if (seq !== uiSequence) return;
    await renderCatalog();
    notify("模試の詳細を読み込めませんでした。もう一度お試しください。");
  }
}
async function begin(entry, mode, sid) {
  catalogView.mode = mode === "section" ? "section" : "full";
  if (sid) catalogView.sectionId = sid;
  await loadExam(entry);
  attempt = createAttempt(exam, mode, sid);
  await lockAttempt(attempt.id);
  reviewing = false;
  solution = false;
  readingMode = false;
  sectionId = attempt.sectionIds[0];
  persist();
  location.hash = attempt.id;
  renderWorkspace();
  resetTop();
}
async function openAttempt(id) {
  const a = store.load(id);
  if (!a || a.discardedAt) {
    location.hash = "";
    await renderCatalog();
    return notify("受験記録が見つかりません。");
  }
  catalogView.mode = a.mode === "section" ? "section" : "full";
  if (a.mode === "section") catalogView.sectionId = a.sectionIds[0];
  const entry = entryFor(a.examId, a.examVersion);
  if (!entry)
    return notify("この履歴に対応する問題バージョンが見つかりません。");
  await loadExam(entry);
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
  sectionId = a.sectionIds[0];
  location.hash = id;
  if (attempt.result) renderResults();
  else {
    if (attempt.status !== "active") resume(attempt);
    persist();
    renderWorkspace();
    resetTop();
  }
}
function visibleFields() {
  return exam.fields.filter((f) => attempt.sectionIds.includes(f.sectionId));
}
function answers() {
  return reviewing ? attempt.review.answers : attempt.answers;
}
function isLocked(id) {
  return reviewing && attempt.review.locked.includes(id);
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
  closeAnswer();
  const seq = ++uiSequence;
  frameObserver?.disconnect();
  secondaryObserver?.disconnect();
  const reading = readingMode,
    split = reading && innerWidth >= 1000;
  app.innerHTML = `<div class="topline"><div><p class="eyebrow">No.${esc(exam.id)} / ${reading ? "解説" : reviewing ? "復習" : "受験"}</p><h1>${reading ? exam.sections.find((s) => s.id === sectionId).title + (split ? " 問題・解説" : solution ? " 正答・解説" : " 問題") : esc(exam.title)}</h1></div><button id="back-list">${reading ? "採点結果に戻る" : "一覧に戻る"}</button></div><div class="workspace ${reading ? "reading-layout" : ""}"><div class="book"><nav class="book-nav" aria-label="大問を選ぶ"></nav>${split ? '<div class="explanation-panes"><section><h2>問題</h2><iframe id="paired-problem" title="問題（比較表示）" sandbox="allow-same-origin"></iframe></section><section><h2>解説</h2>' : ""}<iframe id="book-frame" title="${reading ? (solution ? "正答・解説" : "問題") : "問題冊子"}" sandbox="allow-same-origin"></iframe>${split ? "</section></div>" : ""}<div id="book-next" class="book-next"></div></div><aside class="sidebar"><div id="run-actions" class="actions"></div>${reading ? "" : `<p>${reviewing ? "復習モード" : attempt.mode === "timed" ? "残り時間" : "解答時間"}</p><div id="timer" class="timer"></div>`}<nav id="section-navigation" class="section-navigation" aria-label="大問へ移動"></nav>${reading ? "" : `<details ${innerWidth > 850 ? "open" : ""}><summary>解答状況・見直し</summary><div id="answer-status"></div></details><button id="export-active">履歴を書き出す</button>`}</aside></div>`;
  $("#back-list").onclick = reading
    ? () => {
        readingMode = false;
        solution = false;
        renderResults();
      }
    : () => requestPause(true);
  if (!reading)
    $("#export-active").onclick = () => {
      const all = store.list().filter((a) => a.id !== attempt.id);
      all.unshift(attempt);
      download(
        "mock-history.json",
        JSON.stringify(
          { schemaVersion: 1, exportedAt: Date.now(), attempts: all },
          null,
          2,
        ),
      );
    };
  const sections = exam.sections.filter((s) =>
    attempt.sectionIds.includes(s.id),
  );
  for (const section of sections) {
    if (reading) continue;
    for (const nav of [$(".book-nav"), $("#section-navigation")]) {
      const b = button(section.title, () => navigateSection(section.id));
      b.setAttribute("aria-current", String(section.id === sectionId));
      nav.append(b);
    }
  }
  if (reading) {
    for (const kind of ["solution", "problem"])
      for (const section of sections) {
        const b = button(
          section.title + (kind === "solution" ? "解説" : "問題"),
          () => {
            sectionId = section.id;
            solution = kind === "solution";
            renderWorkspace();
          },
        );
        b.setAttribute(
          "aria-current",
          String(
            section.id === sectionId &&
              (split || solution === (kind === "solution")),
          ),
        );
        $("#section-navigation").append(b);
      }
  }
  const next = sections[sections.findIndex((s) => s.id === sectionId) + 1];
  if (next)
    $("#book-next").append(
      button(next.title + " →", () => navigateSection(next.id), "primary"),
    );
  else
    $("#book-next").append(
      button(
        reading
          ? "採点結果に戻る"
          : reviewing
            ? "復習の結果を見る"
            : "ここまでを採点する",
        reading
          ? () => {
              readingMode = false;
              solution = false;
              renderResults();
            }
          : doGrade,
        reading ? "" : "primary",
      ),
    );
  if (reading)
    $("#run-actions").append(
      button("採点結果に戻る", () => {
        readingMode = false;
        solution = false;
        renderResults();
      }),
      button("一覧に戻る", leave),
    );
  else
    $("#run-actions").append(
      button(reviewing ? "復習を採点する" : "採点する", doGrade, "primary"),
      button("中断", () => requestPause(false)),
    );
  if (!reading && attempt.result)
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
      const html = await documentText(url);
      if (seq !== uiSequence) return resolve();
      frame.onload = () => {
        if (seq !== uiSequence) return resolve();
        const d = frame.contentDocument;
        if (!d?.body) return resolve();
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
        if (!reading) {
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
          syncBook();
        }
        let scheduled = false;
        const resize = () => {
          if (scheduled) return;
          scheduled = true;
          requestAnimationFrame(() => {
            scheduled = false;
            if (seq === uiSequence)
              frame.style.height =
                Math.ceil(d.body.getBoundingClientRect().height) + "px";
          });
        };
        frameObserver = new ResizeObserver(resize);
        frameObserver.observe(d.body);
        frame.style.height =
          Math.ceil(d.body.getBoundingClientRect().height) + "px";
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
    const other = $("#paired-problem"),
      url = new URL(section.screenProblem || section.problem, base).href;
    documentText(url)
      .then((html) => {
        if (seq !== uiSequence) return;
        other.onload = () => {
          if (seq !== uiSequence) return;
          const d = other.contentDocument;
          for (const e of d.querySelectorAll("[data-field]")) {
            const f = exam.fields.find((f) => f.id === e.dataset.field);
            if (f)
              e.textContent = displayValue(f, attempt.gradedAnswers?.[f.id], e);
          }
          d.querySelectorAll("table").forEach((t) => {
            const w = d.createElement("div");
            w.className = "table-scroll";
            t.before(w);
            w.append(t);
          });
          const resize = () => {
            other.style.height =
              Math.ceil(d.body.getBoundingClientRect().height) + "px";
          };
          secondaryObserver = new ResizeObserver(resize);
          secondaryObserver.observe(d.body);
          resize();
        };
        other.srcdoc = html.replace(
          /<head[^>]*>/i,
          (match) => match + `<base href="${url}">`,
        );
      })
      .catch(() => {});
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
  for (const s of exam.sections.filter((s) =>
    attempt.sectionIds.includes(s.id),
  )) {
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

function syncBook() {
  const d = frame?.contentDocument;
  if (!d || solution) return;
  const result = reviewing ? attempt.review.result : attempt.result;
  for (const e of d.querySelectorAll("[data-field]")) {
    const f = exam.fields.find((f) => f.id === e.dataset.field);
    if (!f) continue;
    const value = answers()[f.id] || "";
    e.textContent = displayValue(f, value, e);
    e.dataset.filled = String(!!value);
    e.dataset.locked = String(isLocked(f.id));
    e.setAttribute("aria-label", `解答欄${f.label}: ${value || "未回答"}`);
    e.setAttribute("aria-disabled", String(isLocked(f.id)));
    delete e.dataset.verdict;
    if ((reviewing || attempt.showCorrectness) && result) {
      const u = result.units.find((u) => u.fields.includes(f.id));
      if (u && u.answers.every((v, i) => v === (answers()[u.fields[i]] || "")))
        e.dataset.verdict = u.correct ? "correct" : "incorrect";
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
      answers()["q3-コ"] === e.dataset.position ? " kakuteisu = 0" : "";
  }
  for (const e of d.querySelectorAll("[data-choice-fields]")) {
    const selected = e.dataset.choiceFields
      .split(" ")
      .some((id) => answers()[id] === e.dataset.choiceValue);
    e.dataset.selected = String(selected);
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
  if (isLocked(id)) return notify("この欄は復習で正答済みです。");
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
$("#next-answer").onclick = async () => {
  const fs = visibleFields(),
    i = fs.findIndex((f) => f.id === selectedField),
    next = fs.slice(i + 1).find((f) => !isLocked(f.id));
  if (!next) return closeAnswer();
  closeAnswer();
  if (sectionId !== next.sectionId) {
    sectionId = next.sectionId;
    renderWorkspace();
  }
  await bookReady;
  const anchor = frame.contentDocument.querySelector(
    `[data-field="${next.id}"]`,
  );
  anchor?.scrollIntoView({ block: "center", behavior: "instant" });
  openField(next.id, anchor);
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
  if (reviewing) {
    persist();
    return toList ? leave() : renderResults();
  }
  ask("中断のしかたを選ぶ", [
    [
      "採点せずに中断",
      () => {
        pause(attempt);
        persist();
        leave();
      },
    ],
    ["ここまでを採点して中断", () => doGrade()],
  ]);
}
function doGrade() {
  if ($("#answer-dialog").open) $("#answer-dialog").close();
  if (reviewing) {
    gradeReview(exam, attempt);
    persist();
    renderResults();
    return;
  }
  submit(exam, attempt);
  persist();
  renderResults();
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
window.addEventListener("pagehide", () => {
  if (attempt) persist();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && attempt) persist();
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
function discardAttempt(id) {
  store.discard(id);
  if (attempt?.id === id) {
    releaseLock?.();
    releaseLock = null;
    attempt = null;
    reviewing = false;
    solution = false;
    location.hash = "";
  }
  renderCatalog();
  resetTop();
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
function renderResults() {
  closeAnswer();
  const seq = ++uiSequence;
  frameObserver?.disconnect();
  secondaryObserver?.disconnect();
  solution = false;
  readingMode = false;
  const current = attempt,
    r = current.result;
  if (!r) return renderWorkspace();
  app.innerHTML = `<section class="results"><div class="result-heading"><div><p class="eyebrow">No.${esc(exam.id)} / RESULT</p><h1>採点結果</h1></div><button id="discard-result" class="subtle-danger">この採点結果を破棄する</button></div><div class="score">${r.points}<small> / ${r.maxPoints}</small></div><p>得点率 ${((r.points / r.maxPoints) * 100).toFixed(1)}% · 解答時間 ${time(elapsed(current))}</p><div class="actions result-actions" id="result-actions"></div><div class="table-wrap"><table class="summary-table"><thead><tr><th>大問</th><th>あなたの得点</th><th>あなたの得点率</th><th>平均得点</th><th>平均得点率</th></tr></thead><tbody id="section-results"></tbody><tfoot><tr><th>合計</th><td>${r.points} / ${r.maxPoints}点</td><td>${((r.points / r.maxPoints) * 100).toFixed(1)}%</td><td id="avg-total">—</td><td id="rate-total">—</td></tr></tfoot></table></div><div class="unit-heading"><h2>解答・採点</h2><button id="toggle-history" class="subtle-button">過去の成績も表示する</button></div><div class="table-wrap unit-table-wrap"><table id="unit-table"><thead id="unit-head"></thead><tbody id="unit-results"></tbody></table></div><p class="muted score-footnote">＊は複数の解答欄をまとめて採点します。</p></section>`;
  $("#discard-result").onclick = () => discardAttempt(current.id);
  $("#result-actions").append(
    button("解答に戻る", () =>
      ask("正誤表記を選ぶ", [
        ["正誤表記あり", () => restart(true)],
        ["正誤表記なし", () => restart(false)],
      ]),
    ),
    button("解説を読む", () => {
      if (attempt.status === "active") {
        pause(attempt);
        persist();
      }
      reviewing = false;
      readingMode = true;
      solution = true;
      sectionId = attempt.sectionIds[0];
      renderWorkspace();
      resetTop();
    }),
    button("一覧に戻る", leave, "back-to-catalog"),
  );
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
  if (!reviewing) {
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

function restart(show) {
  solution = false;
  readingMode = false;
  if (show) {
    reviewing = true;
    startReview(exam, attempt);
    persist();
    renderWorkspace();
    resetTop();
    return;
  }
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
          resume(attempt, show);
          persist();
          renderWorkspace();
        },
      ],
    ]);
  } else {
    resume(attempt, show);
    persist();
    renderWorkspace();
  }
}
try {
  catalog = await fetch("catalog.json").then((r) => r.json());
  if (location.hash.slice(1) && store.load(location.hash.slice(1)))
    await openAttempt(location.hash.slice(1));
  else await renderCatalog();
} catch (e) {
  app.innerHTML = `<p class="error-note">読み込みに失敗しました。${esc(e.message)}</p>`;
}
