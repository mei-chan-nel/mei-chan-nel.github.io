import "./build-render-worker.mjs";
import "./build-audio-worker.mjs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
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
    .map((content) =>
      `<a class="exhibit-link" href="./${esc(content.id)}/"><h3>${esc(content.name)}</h3><p>${esc(content.description)}</p></a>`)
    .join("\n");
const home = `<header class="lab-directory-heading"><h1 id="lab-title">Interactive Lab</h1>
<nav aria-label="ラボの分野">${groups.map((g) => `<a href="#${g.id}">${esc(g.name)}</a>`).join("")}</nav></header>
${groups.map((g) => `<section class="lab-category exhibit-group" id="${g.id}" aria-labelledby="heading-${g.id}"><header><h2 id="heading-${g.id}">${esc(g.name)}</h2><p>${esc(g.hint)}</p></header><div class="exhibit-list">${cards(g)}</div></section>`).join("\n")}`;
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
  if (content.generated === false) {
    await access(new URL(`${content.id}/index.html`, root));
    continue;
  }
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
