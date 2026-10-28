// Failed reads, rapid selection and old-edition restoration; no live RPC writes.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../..");
const original = JSON.parse(
  fs.readFileSync(path.join(root, "mock-exams/exams/001/1/exam.json")),
);
const entries = [
  {
    id: "001",
    version: 1,
    title: original.title,
    manifest: "exams/001/1/exam.json",
  },
  {
    id: "002",
    version: 2,
    title: "検証No.002",
    manifest: "exams/002/2/exam.json",
    versions: [{ version: 1, manifest: "exams/002/1/exam.json" }],
  },
];
let manifestReads = 0,
  q2Reads = 0,
  pendingResponse;
const server = http.createServer((req, res) => {
  let pathname = new URL(req.url, "http://local").pathname;
  const sendJSON = (value) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(value));
  };
  if (pathname === "/mock-exams/catalog.json") return sendJSON(entries);
  if (
    pathname === "/mock-exams/exams/001/1/exam.json" &&
    ++manifestReads === 1
  ) {
    pendingResponse = () => res.writeHead(503).end("temporary failure");
    return;
  }
  if (/\/exams\/002\/[12]\/exam.json$/.test(pathname)) {
    const version = Number(pathname.split("/").at(-2)),
      exam = structuredClone(original);
    exam.id = "002";
    exam.version = version;
    exam.title = "検証No.002";
    if (version === 2) exam.scoring[0].rule.patterns = [["1"]];
    return sendJSON(exam);
  }
  if (pathname.endsWith("/001/1/screen/q2a.html") && ++q2Reads === 1)
    return res.writeHead(503).end();
  pathname = pathname.replace(/\/exams\/002\/[12]\//, "/exams/001/1/");
  let file = path.resolve(root, "." + pathname);
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
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
      }[path.extname(file)] || "application/octet-stream",
    );
    res.end(fs.readFileSync(file));
  } catch {
    res.writeHead(404).end();
  }
});
(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext();
    const writes = [],
      errors = [];
    await context.route("https://*.supabase.co/**", (route) => {
      const data = route.request().postDataJSON();
      if (data.p_results) writes.push(data);
      return route.fulfill({
        json: data.p_results
          ? { updated_count: data.p_results.length }
          : { items: [] },
      });
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    const url = `http://127.0.0.1:${server.address().port}/mock-exams/`;
    await page.goto(url);
    await page.locator('[data-exam-id="001"] button').first().waitFor();
    await page.evaluate(() => {
      const button = document.querySelector('[data-exam-id="001"] button');
      button.click();
      button.click();
      document.querySelector('[data-exam-id="002"] button').click();
    });
    while (!pendingResponse)
      await new Promise((resolve) => setTimeout(resolve, 10));
    pendingResponse();
    await page
      .locator("#notice")
      .filter({ hasText: "問題データを読み込めません" })
      .waitFor();
    assert.equal(manifestReads, 1);
    assert.equal(
      await page.evaluate(
        () =>
          Object.keys(localStorage).filter((k) => k.includes(":attempt:"))
            .length,
      ),
      0,
    );
    await page.locator('[data-exam-id="001"] button').first().click();
    await page
      .frameLocator("#book-frame")
      .locator('[data-field="q1-ア"]')
      .first()
      .waitFor();
    assert.equal(manifestReads, 2, "failed fetch must not poison the cache");
    assert.equal(
      await page.evaluate(
        () =>
          Object.keys(localStorage).filter(
            (k) => k.includes(":attempt:") && !k.endsWith(":backup"),
          ).length,
      ),
      1,
    );
    await page
      .locator(".book-nav")
      .getByRole("button", { name: "第2問A", exact: true })
      .click();
    await page
      .frameLocator("#book-frame")
      .locator('[data-field="q2a-ア"]')
      .first()
      .waitFor();
    assert.equal(q2Reads, 2, "a failed prefetch can be fetched again");
    console.log(
      "PASS: failed manifest/prefetch retry, rapid selections create one attempt",
    );

    const oldId = await page.evaluate(async (original) => {
      const { AttemptStore, createAttempt, submit } =
        await import("./engine/attempt.mjs");
      const exam = { ...original, id: "002", version: 1 },
        store = new AttemptStore();
      const a = createAttempt(exam, "untimed");
      a.answers = { "q1-ア": "0" };
      submit(exam, a);
      store.save(a);
      return a.id;
    }, original);
    await page.goto(url + "#" + oldId);
    await page
      .getByRole("heading", { name: "採点結果", exact: true })
      .waitFor();
    assert.equal(
      (
        await page.locator(".summary-table tfoot td").first().textContent()
      ).trim(),
      "2 / 100点",
    );
    assert.equal(
      await page.evaluate(
        (id) =>
          JSON.parse(localStorage["study-atlas:mock-exams:v1:attempt:" + id])
            .examVersion,
        oldId,
      ),
      1,
    );
    await page.getByRole("button", { name: "一覧に戻る", exact: true }).click();
    await page.locator('[data-exam-id="002"] button').first().click();
    await page
      .frameLocator("#book-frame")
      .locator('[data-field="q1-ア"]')
      .first()
      .waitFor();
    const current = await page.evaluate(() =>
      JSON.parse(
        localStorage[
          "study-atlas:mock-exams:v1:attempt:" + location.hash.slice(1)
        ],
      ),
    );
    assert.equal(current.examId, "002");
    assert.equal(current.examVersion, 2);
    assert.deepEqual(
      writes,
      [],
      "starting/viewing exams does not record stats",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: new edition starts separately; old result keeps its original version and score",
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
