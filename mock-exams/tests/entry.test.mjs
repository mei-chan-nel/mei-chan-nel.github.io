import assert from "node:assert/strict";
import fs from "node:fs";
import { catalogMarkup } from "../ui/catalog-page.mjs";
const root = new URL("../", import.meta.url),
  catalog = JSON.parse(fs.readFileSync(new URL("catalog.json", root)));
const index = fs.readFileSync(new URL("index.html", root), "utf8");
const embedded = JSON.parse(
  index.match(
    /<script id="exam-catalog" type="application\/json">([\s\S]*?)<\/script>/,
  )[1],
);
assert.deepEqual(
  embedded,
  catalog,
  "First-paint data must match the registered catalog",
);
assert.equal(
  index.match(/<main id="app">([\s\S]*?)<\/main>/)[1],
  catalogMarkup(catalog, [], undefined, null),
);
assert.ok(!index.includes("模試を読み込んでいます"));
