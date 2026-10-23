import { downloadCSV } from "./data-editor.mjs?v=20261023-centered-data";
const target = new URL("./histogram/", new URL("../", location.href));
target.protocol = location.protocol;
target.host = location.host;
const query = new URLSearchParams(location.search);
if (query.get("dataset") === "project") {
  target.searchParams.set("dataset", "project");
  target.searchParams.set("field", query.get("field") === "x" ? "x" : "y");
}
let saved;
try {
  saved = JSON.parse(localStorage.getItem("study-atlas-statistics-summary-v1"));
} catch {}
const s = saved?.state;
if (
  !query.has("dataset") &&
  s?.dataInfo?.origin === "user" &&
  Array.isArray(s.points) &&
  s.points.length >= 2 &&
  s.points.length <= 300 &&
  s.points.every(
    (p) => p && Number.isFinite(p.value) && Math.abs(p.value) <= 1000000,
  )
) {
  const area = document.querySelector("#legacy-summary-data");
  area.hidden = false;
  const name = document.createElement("p");
  name.textContent = `保存済み：${s.dataInfo.name || s.source || "自分のデータ"}（${s.points.length}件）`;
  area.prepend(name);
  const headers = [s.label || "値"],
    rows = s.points.map((p) => [p.value]);
  document.querySelector("#legacy-summary-open").onclick = () => {
    sessionStorage.setItem(
      "study-atlas-distribution-transfer",
      JSON.stringify({
        headers,
        rows,
        x: 0,
        group: -1,
        name: s.dataInfo.name || "代表値ラボのデータ",
        filename: s.dataInfo.filename || "",
      }),
    );
    target.searchParams.set("legacy", "summary");
    location.replace(target.href);
  };
  document.querySelector("#legacy-summary-download").onclick = () =>
    downloadCSV("statistics-summary.csv", headers, rows);
} else location.replace(target.href);
