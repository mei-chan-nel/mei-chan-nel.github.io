// Exercise the actual explanation links and Studio Worker in the Sites bundle.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(
  __dirname,
  "../../../sites/study-atlas-mock-exams-preview/dist",
);
const server = http.createServer((req, res) => {
  let file = path.resolve(
    root,
    "." + decodeURIComponent(req.url.split("?")[0]),
  );
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  try {
    if (fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
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
  const context = await browser.newContext(),
    page = await context.newPage(),
    errors = [];
  context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
  await context.route("https://**", (r) => r.abort());
  try {
    const origin = "http://127.0.0.1:" + server.address().port;
    await page.goto(origin + "/mock-exams/exams/001/1/screen/q3-solution.html");
    for (const number of [2, 4]) {
      const [studio] = await Promise.all([
        context.waitForEvent("page"),
        page.locator(`[data-studio-program="q3-fig${number}"]`).click(),
      ]);
      await studio.locator("#runner-view:not([hidden])").waitFor();
      assert.equal(
        await studio.locator("#status-text").textContent(),
        "準備できました",
      );
      await studio.locator("#speed-button").click();
      await studio.locator("#speed-input").fill("0.001");
      await studio.locator("#speed-input").press("Tab");
      await studio.locator("#speed-button").click();
      await studio.locator("#play-button").click();
      if (number === 4) {
        for (const value of ["1", "4"]) {
          await studio.locator("#input-dialog[open]").waitFor();
          await studio.locator("#input-fields input").fill(value);
          await studio.locator('#input-form button[type="submit"]').click();
          await studio.waitForFunction(
            () =>
              !document.querySelector("#input-dialog").open ||
              !document.querySelector("#input-fields input")?.value,
          );
        }
      }
      await studio.waitForFunction(
        () =>
          document.querySelector("#status-text")?.textContent === "実行完了",
      );
      await studio.locator("#output-full").click();
      const output = await studio
        .locator(".output-lines-full li .output-content")
        .allTextContents();
      assert.deepEqual(
        output,
        number === 2
          ? [1, 2, 4, 8].map((n) => `受付番号${n}の予約を確定する`)
          : ["新たに確定した申込は2件", "新たに確定した申込は1件"],
      );
      assert.equal(await studio.locator("#run-error").isVisible(), false);
      await studio.close();
      assert.ok(page.url().endsWith("q3-solution.html"));
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS: both explanation links → Studio → run to completion; external inputs 1/4; original explanation stays open",
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
