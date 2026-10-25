// Keep the statistics suites in the repository's standard scripts/*.test.mjs checks.
import "../lab/statistics/shared/test.mjs";
import "../lab/statistics/shared/data-model.test.mjs";
import "../lab/statistics/shared/samples.test.mjs";
import "../lab/statistics/shared/learning.test.mjs";
import "../lab/statistics/shared/table-data.test.mjs";
import "../lab/statistics/correlation/test.mjs";
import "../lab/statistics/histogram/test.mjs";
import "../lab/statistics/histogram/descriptive.test.mjs";
import "../lab/statistics/summary/test.mjs";
import "../lab/statistics/sampling/test.mjs";
import "../lab/statistics/crosstab/test.mjs";
import "../lab/statistics/time-series/test.mjs";
import "../lab/statistics/probability/test.mjs";
import "../lab/statistics/hypothesis-test/test.mjs";
import "../lab/statistics/hypothesis-test/mean-model.test.mjs";
import "../lab/statistics/hypothesis-test/guide.test.mjs";
import "../lab/statistics/hypothesis-test/normal-model.test.mjs";
import "../lab/statistics/lorenz/test.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { labs } from "../lab/statistics/catalog.mjs";
import { renderPage } from "../lab/tools/shell.mjs";
test("all active statistics labs have real modules, data views and valid nested shell assets", async () => {
  for (const [id] of labs) {
    const config = (await import(`../lab/statistics/${id}/lab.mjs`)).default;
    assert.equal(config.id, id);
    assert.equal(typeof config.render, "function");
    assert.match(config.explanation, /<h[23]>.+<\/h[23]>/);
    assert.match(config.explanation, /<p>.+<\/p>/);
    const html = await readFile(
      new URL(`../lab/statistics/${id}/index.html`, import.meta.url),
      "utf8",
    );
    assert.ok(html.includes(id === "graph-reading" ? 'src="./../foundations/app.mjs?v=20261025-graph-choice"' : id === "missing-values" ? 'src="./../foundations/app.mjs?v=20261025-reading-missing"' : 'src="./../app.mjs?v=20261025-final-polish"'));
    assert.ok(html.includes('href="../../../assets/site.css'));
    assert.ok(html.includes('href="../../lab.css'));
    assert.ok(html.includes('id="experiment-insight"'));
    assert.ok(html.includes('id="analysis-flow"'));
    assert.ok(html.includes('id="view-tabs"'));
    for (const removed of [
      "missions",
      "capture",
      "show-comparison",
      "show-tools",
      "open-data",
      "data-name",
    ])
      assert.ok(!html.includes(`id="${removed}"`));
    assert.ok(html.includes('id="academic"'));
    assert.ok(html.includes('class="workspace-intro"'));
    assert.ok(!html.includes('id="learning-dialog"'));
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

import "../lab/statistics/foundations/model.test.mjs";

import "../lab/statistics/graph-reading/lessons.test.mjs";
