// Keep the statistics suites in the repository's standard scripts/*.test.mjs checks.
import "../lab/statistics/shared/test.mjs";
import "../lab/statistics/shared/data-model.test.mjs";
import "../lab/statistics/correlation/test.mjs";
import "../lab/statistics/histogram/test.mjs";
import "../lab/statistics/summary/test.mjs";
import "../lab/statistics/sampling/test.mjs";
import "../lab/statistics/crosstab/test.mjs";
import "../lab/statistics/time-series/test.mjs";
import "../lab/statistics/probability/test.mjs";
import "../lab/statistics/hypothesis-test/test.mjs";
import "../lab/statistics/lorenz/test.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { labs } from "../lab/statistics/catalog.mjs";
import { renderPage } from "../lab/tools/shell.mjs";
test("all nine independent labs have real modules, three inquiry missions and valid nested shell assets", async () => {
  for (const [id] of labs) {
    const config = (await import(`../lab/statistics/${id}/lab.mjs`)).default;
    assert.equal(config.id, id);
    assert.equal(typeof config.render, "function");
    assert.equal(config.missions.length, 3);
    assert.ok(config.explanation.length > 500);
    const html = await readFile(
      new URL(`../lab/statistics/${id}/index.html`, import.meta.url),
      "utf8",
    );
    assert.ok(html.includes('src="./../app.mjs?v=20261015-ui2"'));
    assert.ok(html.includes('href="../../../assets/site.css'));
    assert.ok(html.includes('href="../../lab.css'));
    assert.ok(html.includes('href="../projects/?start=records"'));
    assert.ok(html.includes('id="open-data"'));
    assert.ok(html.includes('id="analysis-flow"'));
    assert.ok(html.includes('id="view-tabs"'));
    assert.ok(html.includes('id="learning-dialog"'));
    assert.ok(!html.includes('class="stat-badge"'));
    assert.ok(html.includes(`data-stat-lab="${id}"`));
  }
});
test("nested shell adds statistics breadcrumb and preserves original one-level assets", () => {
  const nested = renderPage({
    name: "Test",
    description: "Test",
    slug: "statistics/test",
    body: "",
  });
  assert.ok(nested.includes('href="../../icon.svg"'));
  assert.ok(nested.includes('href="../../../lab/"'));
  const old = renderPage({
    name: "Test",
    description: "Test",
    slug: "old",
    body: "",
  });
  assert.ok(old.includes('href="../icon.svg"'));
  assert.ok(old.includes('href="../../assets/site.css'));
});
