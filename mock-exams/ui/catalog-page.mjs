// The same catalog renderer is used by the fast entry page and the full app.
import {
  catalogSections,
  examLabel, filterExams,
  catalogProgress,
  sortCatalog,
} from "../engine/catalog.mjs";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const defaultCatalogView = () => ({
  mode: "full",
  timeMode: "untimed",
  sectionId: "q1",
  order: "recommended",
  examType: "all",
});
const pressed = (a, b) => String(a === b);
export function catalogMarkup(
  catalog,
  history = [],
  catalogView = defaultCatalogView(),
  pageURL = "https://mei-chan-nel.com/mock-exams/",
) {
  const modes = [
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
  ]
    .map(
      ([value, title, description, meta]) =>
        `<button class="mode-choice" data-mode="${value}" aria-pressed="${pressed(catalogView.mode, value)}"><span class="mode-meta">${meta}</span><strong>${title}</strong><span>${description}</span></button>`,
    )
    .join("");
  const times = [
    ["untimed", "時間制限なしで解く"],
    ["timed", "60分で受験する"],
  ]
    .map(
      ([value, title]) =>
        `<button data-time="${value}" aria-pressed="${pressed(catalogView.timeMode, value)}">${title}</button>`,
    )
    .join("");
  const sections = catalogSections
    .map(
      ([value, title]) =>
        `<button data-section="${value}" aria-pressed="${pressed(catalogView.sectionId, value)}">${title}</button>`,
    )
    .join("");
  const sectionTitle = catalogSections.find(
    ([id]) => id === catalogView.sectionId,
  )[1];
  const context =
    catalogView.mode === "section"
      ? `${sectionTitle}の演習`
      : `回ごとに受験 · ${catalogView.timeMode === "timed" ? "60分" : "時間制限なし"}`;
  const cards = sortCatalog(
    filterExams(catalog, catalogView.examType),
    history,
    catalogView.mode,
    catalogView.sectionId,
    catalogView.order,
  )
    .map((entry) => {
      const progress = catalogProgress(
        entry,
        history,
        catalogView.mode,
        catalogView.sectionId,
      );
      const statusClass =
        progress.status === "中断中"
          ? "in-progress"
          : progress.status === "採点済み"
            ? "completed"
            : "";
      const fresh = `<button class="primary" data-start="${esc(entry.id)}">${progress.resume ? "最初から解く" : "選択"}</button>`;
      const resume = progress.resume
        ? `<button class="primary" data-resume="${esc(progress.resume.id)}">再開</button>`
        : "";
      const result = progress.latestResult
        ? `<button data-result="${esc(progress.latestResult.id)}">結果</button>`
        : "";
      const links = [
        ["problem", "問題冊子PDF"],
        ["solution", "解答解説PDF"],
      ]
        .map(
          ([kind, title]) =>
            `<a href="${esc(pageURL ? new URL(kind + ".pdf", new URL(".", new URL(entry.manifest, pageURL))).href : entry.manifest.replace("exam.json", kind + ".pdf"))}" download="情報Ⅰ_実戦演習_${esc(examLabel(entry))}_${title}.pdf">${title}</a>`,
        )
        .join("");
      const cardId = "catalog-exam-" + esc(entry.id);
      return `<article class="exam-card catalog-exam" data-exam-id="${esc(entry.id)}">
        <div class="exam-card-title">
          <h3 id="${cardId}-title">${esc(examLabel(entry))}${catalogView.mode === "section" ? "の" + esc(sectionTitle) : ""}</h3>
          <span id="${cardId}-status" class="exam-status ${statusClass}">${progress.status}</span>
        </div>
        <button type="button" class="exam-card-trigger" aria-haspopup="dialog" aria-controls="catalog-exam-dialog" aria-labelledby="${cardId}-title ${cardId}-status"></button>
        <div class="actions exam-card-actions">${resume}${fresh}${result}<div class="pdf-links">${links}</div></div>
      </article>`;
    })
    .join("");
  return `
    <div class="catalog-page">
      <nav class="breadcrumb" aria-label="パンくずリスト"><a href="../">学習トップ</a><span aria-hidden="true">/</span><span aria-current="page">実戦演習</span></nav>
      <h1 class="visually-hidden">情報Ⅰ 実戦演習</h1>
      <nav id="exam-modes" class="mode-choices" aria-label="受験方式を選ぶ">${modes}</nav>
      <section class="section-picker" aria-labelledby="exam-type-title">
        <h2 id="exam-type-title">試験選択</h2>
        <div id="catalog-type" class="time-options" role="group" aria-label="試験選択">${[["all","すべて"],["original","オリジナル模試のみ","模試のみ"],["past","共通テスト過去問のみ","過去問のみ"]].map(([value,label,short])=>`<button data-exam-type="${value}" aria-pressed="${pressed(catalogView.examType || "all",value)}">${short ? `<span class="filter-label-full">${label}</span><span class="filter-label-short">${short}</span>` : label}</button>`).join("")}</div>
      </section>
      <section id="time-picker" class="section-picker" aria-labelledby="time-picker-title" ${catalogView.mode === "full" ? "" : "hidden"}>
        <h2 id="time-picker-title">受験時間を選ぶ</h2>
        <div class="time-options" id="catalog-time" role="group" aria-label="受験時間">${times}</div>
      </section>
      <section id="section-picker" class="section-picker" aria-labelledby="section-picker-title" ${catalogView.mode === "section" ? "" : "hidden"}>
        <h2 id="section-picker-title">大問を選ぶ</h2>
        <div class="section-grid" id="catalog-sections" role="group" aria-label="演習する大問">${sections}</div>
      </section>
      <section class="exam-picker" aria-labelledby="exam-picker-title">
        <div class="catalog-list-heading">
          <div><p class="eyebrow" id="catalog-context">${context}</p><h2 id="exam-picker-title">試験を選ぶ</h2></div>
          <div class="catalog-list-tools"><label class="catalog-sort">並び順<select id="catalog-sort"><option value="recommended" ${catalogView.order === "recommended" ? "selected" : ""}>おすすめ順</option><option value="newest" ${catalogView.order === "newest" ? "selected" : ""}>新しい順</option><option value="number" ${catalogView.order === "number" ? "selected" : ""}>番号順</option></select></label><button id="open-history">学習履歴</button></div>
        </div>
        <div id="exam-list">${cards}</div>
      </section>
      <dialog id="catalog-exam-dialog" aria-labelledby="catalog-exam-dialog-title">
        <header><h2 id="catalog-exam-dialog-title"></h2><button type="button" class="exam-dialog-close" autofocus>閉じる</button></header>
      </dialog>
      <details class="past-exam-permission">
        <summary>共通テスト過去問掲載について</summary>
        <p>大学入学共通テストの過去問は、独立行政法人大学入試センターの許諾を得て掲載しています。</p>
        <p>過去問の「問題冊子PDF」からは、大学入試センターが公表した本試験・追・再試験の問題冊子を原本のままダウンロードできます。サイトの画面では、解答・閲覧に合わせてレイアウトや解答欄などの体裁を整えています。</p>
        <p>解説はStudy Atlasが独自に作成しています。</p>
        <p>このサイトに掲載している過去問は、ダウンロードした問題冊子PDFを含め、再配布できません。二次利用については、大学入試センターへお問い合わせください。<a href="https://www.dnc.ac.jp/about_site.html">大学入試センター「試験問題の利用について」</a></p>
      </details>
    </div>`;
}
export function renderCatalogContents({
  target,
  catalog,
  history,
  catalogView,
  onChange,
  onStart,
  onResume,
  onResult,
  onHistory,
  onError = () => {},
  pageURL = location.href,
}) {
  target.innerHTML = catalogMarkup(catalog, history, catalogView, pageURL);
  const dialog = target.querySelector("#catalog-exam-dialog");
  let openCard;
  dialog.addEventListener("close", () => {
    openCard?.append(dialog.querySelector(".exam-card-actions"));
    openCard = null;
  });
  dialog.querySelector(".exam-dialog-close").onclick = () => dialog.close();
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const { left, right, top, bottom } = dialog.getBoundingClientRect();
    if (
      event.clientX < left || event.clientX > right ||
      event.clientY < top || event.clientY > bottom
    )
      dialog.close();
  });
  for (const trigger of target.querySelectorAll(".exam-card-trigger")) {
    trigger.onclick = () => {
      if (openCard) return;
      openCard = trigger.closest(".catalog-exam");
      dialog.querySelector("h2").textContent = openCard.querySelector("h3").textContent;
      dialog.append(openCard.querySelector(".exam-card-actions"));
      trigger.focus({ preventScroll: true });
      dialog.showModal();
    };
  }
  const change = (key, value, focus) => {
    catalogView[key] = value;
    onChange();
    target.querySelector(focus)?.focus({ preventScroll: true });
  };
  const bind = (selector, fn) => {
    for (const b of target.querySelectorAll(selector))
      b.onclick = async () => {
        if (b.disabled) return;
        if (dialog.contains(b)) dialog.close();
        b.disabled = true;
        try {
          await fn(b);
        } catch (e) {
          onError(e);
        } finally {
          b.disabled = false;
        }
      };
  };
  bind("[data-exam-type]", b => change("examType",b.dataset.examType,'#catalog-type [aria-pressed="true"]'));
  bind("[data-mode]", (b) =>
    change("mode", b.dataset.mode, '#exam-modes [aria-pressed="true"]'),
  );
  bind("[data-time]", (b) =>
    change("timeMode", b.dataset.time, '#catalog-time [aria-pressed="true"]'),
  );
  bind("[data-section]", (b) =>
    change(
      "sectionId",
      b.dataset.section,
      '#catalog-sections [aria-pressed="true"]',
    ),
  );
  target.querySelector("#catalog-sort").onchange = (e) =>
    change("order", e.target.value, "#catalog-sort");
  bind("[data-start]", (b) =>
    onStart(
      catalog.find((e) => e.id === b.dataset.start),
      catalogView.mode === "section" ? "section" : catalogView.timeMode,
      catalogView.mode === "section" ? catalogView.sectionId : undefined,
    ),
  );
  bind("[data-resume]", (b) => onResume(b.dataset.resume));
  bind("[data-result]", (b) => onResult(b.dataset.result));
  bind("#open-history", onHistory);
}
