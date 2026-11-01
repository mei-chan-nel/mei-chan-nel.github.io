// Generate first-paint HTML and its catalog from the same runtime renderer.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalogMarkup } from "../mock-exams/ui/catalog-page.mjs";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../mock-exams",
);
export function buildEntry() {
  const file = path.join(root, "index.html"),
    entries = JSON.parse(fs.readFileSync(path.join(root, "catalog.json")));
  const data = JSON.stringify(entries).replace(/</g, "\\u003c");
  let content = fs.readFileSync(file, "utf8");
  content = content.replace(
    /<main id="app">[\s\S]*?<\/main>/,
    `<main id="app">${catalogMarkup(entries, [], undefined, null)}</main>`,
  );
  const embedded = `<script id="exam-catalog" type="application/json">${data}</script>`;
  if (content.includes('id="exam-catalog"'))
    content = content.replace(
      /<script id="exam-catalog" type="application\/json">[\s\S]*?<\/script>/,
      embedded,
    );
  else content = content.replace("</head>", embedded + "\n</head>");
  content = content.replace(
    /src="(?:app|entry)\.mjs[^\"]*"/,
    'src="entry.mjs?v=20261101-fast-catalog"',
  );
  content = content.replace(
    /<body(?: data-view="catalog")?>/,
    '<body data-view="catalog">',
  );
  fs.writeFileSync(file, content);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) buildEntry();
