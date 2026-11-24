// Apply the same document presentation to answering, focused questions and
// the problem pane shown beside an explanation (including archived editions).
export function prepareBookDocument(document) {
  for (const mark of document.querySelectorAll(".opt-index,.option-index")) {
    const value = mark.textContent.trim();
    if (/^[0-9]$/.test(value)) mark.textContent = "⓪①②③④⑤⑥⑦⑧⑨"[Number(value)];
  }
  for (const table of document.querySelectorAll("table")) {
    if (table.parentElement.classList.contains("table-scroll")) continue;
    const wrapper = document.createElement("div");
    wrapper.className = "table-scroll";
    table.before(wrapper);
    wrapper.append(table);
  }
  enableReadingLinks(document);
  setBookLayout(document);
  updateTableHints(document);
}

// The parent opens learner-selected references and Studio exercises. The
// embedded documents keep their existing sandbox on both reading layouts.
export function enableReadingLinks(document) {
  for (const link of document.querySelectorAll(".studio-program-link a[href], .sources a[href]")) {
    const url = new URL(link.href);
    if (!["http:", "https:"].includes(url.protocol)) continue;
    link.target = "_blank";
    link.rel = "noopener";
    link.addEventListener("click", (event) => {
      if (event.defaultPrevented || !event.isTrusted) return;
      event.preventDefault();
      window.open(url.href, "_blank", "noopener");
    });
  }
}

export function updateTableHints(document) {
  for (const hint of document.querySelectorAll(".table-hint")) {
    const wrapper = hint.parentElement.querySelector(".table-scroll");
    const overflow = !!wrapper && wrapper.scrollWidth > wrapper.clientWidth + 1;
    hint.hidden = !overflow;
    hint.dataset.overflow = String(overflow);
  }
}

// Use the outer viewport: a narrow document pane on a PC is still paper mode.
export function setBookLayout(document, width = globalThis.innerWidth || 1024) {
  if (!document.querySelector("[data-field]")) return;
  const layout = width <= 800 ? "continuous" : "paper";
  if (document.documentElement.dataset.bookLayout !== layout)
    document.documentElement.dataset.bookLayout = layout;
}
