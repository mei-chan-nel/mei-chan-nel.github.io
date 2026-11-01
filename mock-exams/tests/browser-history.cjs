const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { startFullExam } = require("./catalog-helpers.cjs");
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const root = path.resolve(
  __dirname,
  "../../../sites/study-atlas-mock-exams-preview/dist",
);
const output = path.resolve(__dirname, "../../../work/mock-exam-history");
fs.mkdirSync(output, { recursive: true });
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
        ".mjs": "text/javascript",
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".pdf": "application/pdf",
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
      viewport: { width: 1200, height: 1000 },
    }),
    p = await context.newPage(),
    errors = [],
    writes = [];
  p.on("pageerror", (e) => errors.push(e.message));
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
  const row = (suffix) =>
    p.locator(
      `[data-attempt-id="00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}"]`,
    );
  const history = async () => {
    await p.getByRole("button", { name: "学習履歴", exact: true }).click();
    await p.getByRole("heading", { name: "学習履歴", exact: true }).waitFor();
  };
  const screenshot = (name) =>
    p.screenshot({ path: path.join(output, name + ".png"), fullPage: true });
  async function rightEdges() {
    return p.evaluate(() => {
      const box = (s) => document.querySelector(s).getBoundingClientRect();
      const table = box("#unit-table"),
        wrap = box(".unit-table-wrap"),
        summary = box(".summary-table"),
        summaryWrap = box(".summary-block .table-wrap"),
        toggle = box("#toggle-history"),
        discard = box("#discard-result"),
        back = box(".back-to-catalog");
      return {
        toggle: toggle.right,
        expected: Math.min(table.right, wrap.right),
        discard: discard.right,
        summary: Math.min(summary.right, summaryWrap.right),
        back: back.right,
        discardLeft: discard.left,
      };
    });
  }
  try {
    await p.goto(url);
    await p.locator("#exam-list").waitFor();
    assert.equal(await p.locator("#history-list").count(), 0);
    assert.equal(await p.locator(".history-entry").count(), 0);
    await p
      .locator("#exam-modes")
      .getByRole("button", { name: /大問ごとに演習する/ })
      .click();
    await p
      .locator("#catalog-sections")
      .getByRole("button", { name: "第2問B", exact: true })
      .click();
    const card = p.locator('[data-exam-id="001"]');
    assert.equal(
      await card
        .getByRole("button", { name: "再開", exact: true })
        .getAttribute("class"),
      await card
        .getByRole("button", { name: "最初から解く", exact: true })
        .getAttribute("class"),
    );
    await history();
    assert.equal(await p.locator("#history-list tr").count(), 6);
    assert.equal(await p.locator(".sample-label").count(), 6);
    assert.equal(await p.evaluate(() => location.hash), "#history");
    await screenshot("history-desktop");
    await p
      .locator(".history-filters")
      .getByRole("button", { name: "回ごと", exact: true })
      .click();
    assert.equal(await p.locator("#history-list tr").count(), 3);
    await p
      .locator(".history-filters")
      .getByRole("button", { name: "大問ごと", exact: true })
      .click();
    assert.equal(await p.locator("#history-list tr").count(), 18);
    await p.reload();
    await p.locator("#history-list tr").nth(17).waitFor();
    assert.equal(await p.locator("#history-list tr").count(), 18);
    await p
      .locator(".history-filters")
      .getByRole("button", { name: "すべて", exact: true })
      .click();
    await row(103)
      .getByRole("button", { name: "採点結果", exact: true })
      .click();
    await p.getByRole("heading", { name: "採点結果", exact: true }).waitFor();
    assert.equal(
      await p.getByRole("button", { name: "解答に戻る", exact: true }).count(),
      0,
    );
    assert.equal(await p.locator(".score").count(), 0);
    assert.ok(
      !(await p.locator(".results").textContent()).includes("解答時間"),
    );
    let edges = await rightEdges();
    assert.ok(
      Math.abs(edges.toggle - edges.expected) < 2,
      JSON.stringify(edges),
    );
    assert.ok(
      Math.abs(edges.discard - edges.summary) < 2,
      JSON.stringify(edges),
    );
    assert.ok(edges.back < edges.discardLeft);
    await screenshot("result-compact");
    for (const width of [1045, 390]) {
      await p.setViewportSize({ width, height: 900 });
      edges = await rightEdges();
      assert.ok(
        Math.abs(edges.toggle - edges.expected) < 2,
        JSON.stringify(edges),
      );
      assert.ok(
        Math.abs(edges.discard - edges.summary) < 2,
        JSON.stringify(edges),
      );
      await p
        .getByRole("button", { name: "過去の成績も表示する", exact: true })
        .click();
      edges = await rightEdges();
      assert.ok(
        Math.abs(edges.toggle - edges.expected) < 2,
        JSON.stringify(edges),
      );
      await p.locator(".unit-table-wrap").evaluate((e) => {
        e.scrollLeft = 10000;
      });
      const moved = await p.locator("#toggle-history").boundingBox();
      assert.ok(Math.abs(moved.x + moved.width - edges.toggle) < 2);
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await screenshot("result-history-" + width);
      await p
        .getByRole("button", { name: "過去の成績を閉じる", exact: true })
        .click();
    }
    await p.getByRole("button", { name: "一覧に戻る", exact: true }).click();
    await history();
    await screenshot("history-mobile");
    await row(103).getByRole("button", { name: "削除", exact: true }).click();
    await p.reload();
    await p.locator("#history-list tr").nth(4).waitFor();
    assert.equal(
      await p.locator("#history-list tr").count(),
      5,
      "deleted sample not revived",
    );
    await row(104).getByRole("button", { name: "復習", exact: true }).click();
    await p.locator(".review-note").waitFor();
    assert.equal(await p.locator(".site-header").isVisible(), false);
    await p.locator("#back-list").click();
    await row(106)
      .getByRole("button", { name: "採点結果", exact: true })
      .click();
    await p.getByRole("button", { name: "解答を再開", exact: true }).click();
    await p
      .frameLocator("#book-frame")
      .locator('[data-field="q2b-コ"]')
      .first()
      .waitFor();
    await p.setViewportSize({ width: 1200, height: 1000 });
    await p.evaluate(() => window.scrollTo(0, 0));
    const layout = await p.evaluate(() => {
      const box = (s) => document.querySelector(s).getBoundingClientRect();
      return {
        frame: box("#book-frame").top,
        sidebar: box(".sidebar").top,
        nav: box(".book-nav button").top,
        back: box("#back-list").top,
      };
    });
    assert.ok(
      Math.abs(layout.frame - layout.sidebar) < 2,
      JSON.stringify(layout),
    );
    assert.ok(
      Math.abs(
        await p
          .frameLocator("#book-frame")
          .locator(".page,.sheet")
          .first()
          .evaluate((e) => e.getBoundingClientRect().top),
      ) < 2,
      "first paper page aligns with the frame",
    );
    assert.ok(Math.abs(layout.nav - layout.back) < 2, JSON.stringify(layout));
    assert.equal(await p.locator(".site-header").isVisible(), false);
    assert.equal(await p.locator(".preview-banner").isVisible(), false);
    await screenshot("workspace-aligned");
    await p.evaluate(() => window.scrollTo(0, 600));
    await p.waitForTimeout(100);
    const sticky = await p.locator(".sidebar").boundingBox();
    assert.ok(
      sticky.y >= 10 && sticky.y <= 14,
      "sticky sidebar: " + JSON.stringify(sticky),
    );
    await p.setViewportSize({ width: 390, height: 900 });
    assert.equal(await p.locator(".site-header").isVisible(), false);
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await p.getByRole("button", { name: "採点する", exact: true }).click();
    await p.getByRole("heading", { name: "採点結果", exact: true }).waitFor();
    assert.equal(
      await p.getByRole("button", { name: "解答に戻る", exact: true }).count(),
      0,
    );
    assert.equal(
      writes.length,
      0,
      "all sample views, review, resume and grades excluded",
    );
    await p.getByRole("button", { name: "一覧に戻る", exact: true }).click();
    await startFullExam(p);
    await p
      .frameLocator("#book-frame")
      .locator('[data-field="q1-ア"]')
      .first()
      .click();
    await p.locator("#answer-options>button").nth(0).click();
    await p.getByRole("button", { name: "採点する", exact: true }).click();
    await p.waitForFunction(() =>
      Object.keys(localStorage).some(
        (k) =>
          k.includes(location.hash.slice(1)) &&
          !k.endsWith(":backup") &&
          JSON.parse(localStorage[k]).statsDelivery?.["q1-01"]?.state ===
            "sent",
      ),
    );
    assert.equal(writes.length, 1, "ordinary final grading still submits");
    assert.equal(
      await p.getByRole("button", { name: "解答に戻る", exact: true }).count(),
      0,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: separate history, 6 persistent samples, filters/reload/delete/review/resume, final/interim actions, table-edge geometry and scrolling, hidden header, aligned/sticky sidebar, no sample statistics, ordinary final transmission",
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
