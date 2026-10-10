import "./build-render-worker.mjs";
import "./build-audio-worker.mjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { groups, contents } from "../catalog.mjs";
import { renderPage } from "./shell.mjs";
const root = new URL("../", import.meta.url);
const check = process.argv.includes("--check");
const esc = (text) =>
  String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const cards = (group) =>
  contents
    .filter((content) => content.group === group.id)
    .map(
      (content, i) =>
        `<a class="archive-field-card" href="./${esc(content.id)}/"><span aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><div><h3>${esc(content.name)}</h3><p>${esc(content.description)}</p></div><b aria-hidden="true">→</b></a>`,
    )
    .join("\n");
const home = `<header class="lab-hero"><h1 id="lab-title">Interactive <em>Lab.</em></h1><p class="lab-tagline">触って、変えて、仕組みが見えてくる。</p></header>
${groups.map((g, i) => `<section class="lab-category" id="${g.id}" aria-labelledby="heading-${g.id}" style="--lab-accent:var(--${g.color}-strong)"><div class="section-heading lab-category-heading"><div class="category-title"><span class="category-number" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><h2 id="heading-${g.id}">${g.name}</h2></div><p>${g.hint}</p></div><div class="archive-field-grid lab-content-grid">${cards(g)}</div></section>`).join("\n")}`;
const pages = new Map([
  [
    "index.html",
    renderPage({
      description:
        "情報Ⅰの概念を、操作・実験・可視化で理解するInteractive Lab。学習アプリと同じ6分野から、情報処理のしくみを探ります。",
      body: home,
    }),
  ],
]);
for (const content of contents) {
  const body = await readFile(
    new URL(`./templates/${content.id}.html`, import.meta.url),
    "utf8",
  );
  pages.set(
    `${content.id}/index.html`,
    renderPage({
      name: content.name,
      description: content.description,
      slug: content.id,
      body,
      styles: content.styles ?? [],
      scripts: content.scripts ?? [],
    }),
  );
}
for (const [path, html] of pages) {
  const target = new URL(path, root);
  if (check) {
    if ((await readFile(target, "utf8")) !== html)
      throw new Error(`${path} is out of date`);
  } else {
    await mkdir(new URL("./", target), { recursive: true });
    await writeFile(target, html);
  }
}
console.log(
  `${check ? "Checked" : "Built"} ${pages.size} Interactive Lab pages`,
);
