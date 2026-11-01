// Initial catalog must remain visible without JavaScript or exam/RPC requests.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../.."),
  requests = [];
let rejectManifest = true;
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://local").pathname;
  requests.push(pathname);
  const file = path.resolve(
    root,
    "." +
      decodeURIComponent(pathname) +
      (pathname.endsWith("/") ? "index.html" : ""),
  );
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  if (pathname.endsWith("/002/1/exam.json") && rejectManifest) {
    rejectManifest = false;
    return res.writeHead(503).end();
  }
  try {
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html; charset=utf-8",
        ".mjs": "text/javascript",
        ".js": "text/javascript",
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
  const url = `http://127.0.0.1:${server.address().port}/mock-exams/`;
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const staticContext = await browser.newContext({
      javaScriptEnabled: false,
    });
    const staticPage = await staticContext.newPage();
    await staticPage.goto(url);
    assert.equal(await staticPage.locator(".catalog-exam").count(), 2);
    assert.equal(
      await staticPage.getByText("模試を読み込んでいます…").count(),
      0,
    );
    assert.equal(await staticPage.locator("#time-picker").isVisible(), true);
    await staticContext.close();
    requests.length = 0;
    const context = await browser.newContext({
      viewport: { width: 1200, height: 900 },
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await context.route("https://**/*", (r) =>
      r.fulfill({ body: "", contentType: "text/javascript" }),
    );
    await page.goto(url);
    await page
      .locator("#exam-modes")
      .getByRole("button", { name: /大問ごとに演習する/ })
      .click();
    await page
      .locator("#catalog-sections")
      .getByRole("button", { name: "第2問A", exact: true })
      .click();
    assert.equal(
      await page.locator('[data-exam-id="002"] h3').textContent(),
      "No.002の第2問A",
    );
    assert.ok(
      !requests.some(
        (p) =>
          p.endsWith("/catalog.json") ||
          p.endsWith("/exam.json") ||
          /\/app\.mjs$|\/screen\/|\/ui\/(paired-reading|history-grid)/.test(p),
      ),
      JSON.stringify(requests),
    );
    const paints = await page.evaluate(() =>
      performance
        .getEntriesByType("paint")
        .map((p) => ({ name: p.name, ms: Math.round(p.startTime) })),
    );
    await page.reload();
    assert.equal(
      await page
        .locator('#catalog-sections [aria-pressed="true"]')
        .textContent(),
      "第2問A",
    );
    // Losing the first manifest response must leave a usable catalog and retry.
    await page.locator('[data-exam-id="002"] [data-start]').click();
    await page
      .locator("#notice")
      .filter({ hasText: "問題データを読み込めません" })
      .waitFor();
    await page.locator('[data-exam-id="002"] [data-start]').click();
    await page
      .frameLocator("#book-frame")
      .locator('[data-field="q2a-ア"]')
      .first()
      .waitFor();
    assert.equal(
      await page.locator(".bottom-section-navigation button").count(),
      1,
    );
    assert.ok(
      !requests.some((p) => /\/screen\/.*-solution\.html$/.test(p)),
      "Answering must not load solutions",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: static first paint; modes without app/manifests/RPCs; selection survives reload; failed start retries; solutions deferred",
      JSON.stringify(paints),
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
