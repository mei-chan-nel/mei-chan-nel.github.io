const { startFullExam } = require("./catalog-helpers.cjs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const root = path.resolve(
    __dirname,
    "../../../sites/study-atlas-mock-exams-preview/dist",
  ),
  output = path.resolve(__dirname, "../../../work/mock-exam-review");
fs.mkdirSync(output, { recursive: true });
const exam = JSON.parse(
  fs.readFileSync(path.join(root, "mock-exams/exams/001/1/exam.json")),
);
// Exercise partial-score styling without changing any distributed exam data.
exam.scoring.find((u) => u.id === "q1-03").rule = {
  kind: "cases",
  cases: [
    { answers: ["5", "C"], points: 3 },
    { answers: ["5", ""], points: 1 },
  ],
};
const server = http.createServer((req, res) => {
  let file = path.resolve(
    root,
    "." + decodeURIComponent(req.url.split("?")[0]),
  );
  if (file !== root && !file.startsWith(root + path.sep))
    return res.writeHead(403).end();
  try {
    if (fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
      }[path.extname(file)] || "application/octet-stream",
    );
    res.end(fs.readFileSync(file));
  } catch {
    res.writeHead(404).end();
  }
});
(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
      viewport: { width: 1200, height: 900 },
    }),
    p = await context.newPage(),
    errors = [],
    writes = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await context.route("**/exams/001/1/exam.json", (r) =>
    r.fulfill({ json: exam }),
  );
  await context.route("https://*.supabase.co/**", (r) => {
    const body = r.request().postDataJSON();
    if (body.p_results) writes.push(body);
    return r.fulfill({
      json: body.p_results
        ? { updated_count: body.p_results.length }
        : { items: [] },
    });
  });
  const url = "http://127.0.0.1:" + server.address().port + "/mock-exams/";
  const frame = () => p.frameLocator("#book-frame");
  const row = (id) => p.locator(`[data-attempt-id="${id}"]`);
  const read = (id) =>
    p.evaluate(
      (id) => localStorage["study-atlas:mock-exams:v1:attempt:" + id],
      id,
    );
  try {
    await p.goto(url + "#history");
    await p.locator("#history-list tr").nth(5).waitFor();
    const id = await p.evaluate(async (exam) => {
      const { createAttempt, submit, AttemptStore } =
        await import("./engine/attempt.mjs");
      const a = createAttempt(exam, "untimed");
      a.isSample = true;
      a.answers = { "q1-ア": "0", "q1-イ": "0", "q1-ウ": "5" };
      submit(exam, a);
      a.answers["q1-ア"] = "1";
      new AttemptStore().save(a);
      return a.id;
    }, exam);
    await p.reload();
    await row(id).waitFor();
    assert.equal(
      await p
        .getByRole("button", { name: /履歴を書き出す|履歴を読み込む/ })
        .count(),
      0,
    );
    const grids = await p.locator(".history-row-actions").evaluateAll((rows) =>
      rows.map((r) =>
        [...r.children].map((e) => ({
          x: e.getBoundingClientRect().x,
          w: e.getBoundingClientRect().width,
          h: e.getBoundingClientRect().height,
        })),
      ),
    );
    assert.ok(grids.every((r) => r.length === 4));
    for (const g of grids)
      for (let i = 0; i < 4; i++) {
        assert.ok(Math.abs(g[i].x - grids[0][i].x) < 2);
        assert.ok(Math.abs(g[i].w - grids[0][i].w) < 2);
      }
    await p.screenshot({
      path: path.join(output, "aligned-history.png"),
      fullPage: true,
    });
    await p
      .locator(".history-filters")
      .getByRole("button", { name: "回ごと", exact: true })
      .click();
    assert.equal(await p.locator("#history-list tr").count(), 4);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.locator(".history-page .table-wrap").evaluate((e) => {
      e.scrollLeft = 10000;
    });
    const historyLeft = await p
      .locator(".history-page .table-wrap")
      .evaluate((e) => e.scrollLeft);
    const original = await read(id);
    await row(id).getByRole("button", { name: "復習", exact: true }).click();
    await p.locator(".review-note").waitFor();
    await frame().locator('[data-field="q1-ア"]').first().waitFor();
    assert.equal(
      await p
        .getByRole("button", { name: /採点する|復習を採点する|履歴を書き出す/ })
        .count(),
      0,
    );
    assert.equal(
      await frame().locator('[data-field="q1-ア"]').first().textContent(),
      "ア ⓪",
    );
    const states = {
        "q1-ア": "correct",
        "q1-イ": "incorrect",
        "q1-ウ": "partial",
        "q1-オ": "unanswered",
      },
      colors = [];
    for (const [field, state] of Object.entries(states)) {
      const el = frame().locator(`[data-field="${field}"]`).first();
      assert.equal(await el.getAttribute("data-verdict"), state);
      colors.push(
        await el.evaluate((e) => getComputedStyle(e).backgroundColor),
      );
      await el.click();
      await p.keyboard.press("9");
      assert.equal(
        await p.locator("#answer-dialog").evaluate((d) => d.open),
        false,
      );
    }
    assert.equal(new Set(colors).size, 4);
    assert.equal(
      await read(id),
      original,
      "review cannot alter answers, scores, time or delivery",
    );
    await p.screenshot({
      path: path.join(output, "review-colors-mobile.png"),
      fullPage: true,
    });
    await p
      .locator("#section-navigation")
      .getByRole("button", { name: "第2問A", exact: true })
      .click();
    await frame().locator('[data-field="q2a-ア"]').first().waitFor();
    await p.getByRole("button", { name: "解説を読む", exact: true }).click();
    await p.locator("#back-list").filter({ hasText: "復習に戻る" }).waitFor();
    await p
      .locator("#section-navigation")
      .getByRole("button", { name: "第3問", exact: true })
      .click();
    await frame().locator('[data-reading-problem="q3-05"]').click();
    await frame().locator("html[data-reading-fragment]").waitFor();
    await p.locator("#back-list").click();
    await frame().locator('[data-reading-problem="q3-05"]').waitFor();
    await p.locator("#back-list").click();
    await p.locator(".review-note").waitFor();
    await frame().locator('[data-field="q2a-ア"]').first().waitFor();
    await p.reload();
    await p.locator(".review-note").waitFor();
    await frame().locator('[data-field="q2a-ア"]').first().waitFor();
    assert.equal(await read(id), original);
    await p.locator("#back-list").click();
    await p.getByRole("heading", { name: "学習履歴", exact: true }).waitFor();
    assert.equal(
      await p.locator('.history-filters [aria-pressed="true"]').textContent(),
      "回ごと",
    );
    assert.ok(
      Math.abs(
        (await p
          .locator(".history-page .table-wrap")
          .evaluate((e) => e.scrollLeft)) - historyLeft,
      ) < 2,
    );
    await row(id)
      .getByRole("button", { name: "採点結果", exact: true })
      .click();
    await p.getByRole("heading", { name: "採点結果", exact: true }).waitFor();
    await p.goBack();
    await p.getByRole("heading", { name: "学習履歴", exact: true }).waitFor();
    await p.goForward();
    await p.getByRole("heading", { name: "採点結果", exact: true }).waitFor();
    await p.getByRole("button", { name: "解説を読む", exact: true }).click();
    await p
      .locator("#back-list")
      .filter({ hasText: "採点結果に戻る" })
      .waitFor();
    await p.locator("#back-list").click();
    await p.getByRole("heading", { name: "採点結果", exact: true }).waitFor();
    await p
      .getByRole("button", { name: "学習履歴に戻る", exact: true })
      .click();
    await p.getByRole("heading", { name: "学習履歴", exact: true }).waitFor();
    assert.equal(
      await p.locator('.history-filters [aria-pressed="true"]').textContent(),
      "回ごと",
    );
    assert.equal(await read(id), original);
    assert.equal(
      writes.length,
      0,
      "results, review, solutions and browser navigation never submit statistics",
    );
    await p
      .getByRole("button", { name: "模試一覧に戻る", exact: true })
      .click();
    await startFullExam(p);
    await frame().locator('[data-field="q1-ア"]').first().waitFor();
    await p.getByRole("button", { name: "採点する", exact: true }).click();
    await p.getByRole("heading", { name: "採点結果", exact: true }).waitFor();
    await p.goBack();
    await p.locator("#exam-modes").waitFor();
    assert.equal(
      await p.locator("#book-frame").count(),
      0,
      "browser Back cannot edit a finally graded exam",
    );
    assert.equal(writes.length, 0, "fully unanswered final grade is excluded");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: immutable graded snapshot and 4 verdict colours, no editor/grading/import/export, aligned action slots, results/history/review/solutions return paths, filter and horizontal-scroll restoration, browser back/forward and reload, zero view-only writes",
    );
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
