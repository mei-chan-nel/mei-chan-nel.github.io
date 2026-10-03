import { traceRedirect } from "./routing.js?v=20261003-seo";

const collection = document.getElementById("video-collection");
const grid = document.getElementById("video-grid");
const status = document.getElementById("video-library-status");
let loaded = false;
let loading = false;

async function loadVideos() {
  if (!collection.open || loaded || loading) return;
  loading = true;
  status.hidden = false;
  status.classList.remove("error-message");
  status.textContent = "動画解説問題を読み込んでいます…";
  try {
    const [{ VIDEO_PROGRAMS, defaultParameters, sourceLines }, { cardMarkup }] = await Promise.all([
      import("./examples.js?v=20261003-perf"),
      import("./card-renderer.js?v=20261003-perf"),
    ]);
    grid.innerHTML = VIDEO_PROGRAMS.map(entry => cardMarkup(entry, sourceLines(entry, defaultParameters(entry)))).join("");
    loaded = true;
    status.hidden = true;
  } catch {
    status.textContent = "動画解説問題を読み込めませんでした。ページを再読み込みしてください。";
    status.classList.add("error-message");
  } finally {
    loading = false;
  }
}

function normalizeLibraryURL() {
  const url = new URL(location.href);
  if (url.hash || url.searchParams.has("from")) {
    url.hash = "";
    url.searchParams.delete("from");
    history.replaceState(history.state, "", `${url.pathname}${url.search}`);
  }
}

async function routeLegacy() {
  const id = location.hash.slice(1);
  if (id === "main-content") return;
  if (!id || id === "examples") {
    normalizeLibraryURL();
    return;
  }
  const { findProgram } = await import("./examples.js?v=20261003-perf");
  if (location.hash.slice(1) !== id) return;
  const entry = findProgram(id);
  const redirect = traceRedirect(location.href, entry?.id);
  if (redirect) location.replace(redirect);
  else normalizeLibraryURL();
}

collection.addEventListener("toggle", loadVideos);
window.addEventListener("hashchange", routeLegacy);
loadVideos();
routeLegacy();
