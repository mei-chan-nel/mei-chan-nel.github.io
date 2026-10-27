/* Direct RPC browser flow with deterministic HTTP responses; real SQL is tested separately. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  assert = require("node:assert/strict");
const fixture = require("./rpc-browser-fixture.cjs");
const root = path.resolve(__dirname, "../..");
const server = http.createServer((req, res) => {
  let p = path.resolve(root, "." + decodeURIComponent(req.url.split("?")[0]));
  if (!p.startsWith(root + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    if (fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".mjs": "text/javascript",
        ".js": "text/javascript",
        ".json": "application/json",
        ".css": "text/css",
      }[path.extname(p)] || "application/octet-stream",
    );
    res.end(fs.readFileSync(p));
  } catch {
    res.writeHead(404).end();
  }
});
(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext(),
      p = await context.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    const { submissions } = await fixture(context, { dropAt: 2 });
    const url = "http://127.0.0.1:" + server.address().port + "/mock-exams/";
    await p.goto(url);
    await p
      .getByRole("button", { name: "時間制限なしで解く", exact: true })
      .click();
    const f = p.frameLocator("iframe");
    const choose = async (id, value) => {
      await f.locator(`[data-field="${id}"]`).first().click();
      await p.locator("#answer-options>button").nth(value).click();
    };
    const grade = () =>
      p.getByRole("button", { name: "採点する", exact: true }).click();
    const resume = async () => {
      await p.getByRole("button", { name: "解答に戻る", exact: true }).click();
      await p
        .getByRole("button", { name: "正誤表記なし", exact: true })
        .click();
    };
    const local = () =>
      p.evaluate(() =>
        JSON.parse(
          localStorage[
            "study-atlas:mock-exams:v1:attempt:" + location.hash.slice(1)
          ],
        ),
      );
    await choose("q1-ア", 1);
    await grade();
    await p.waitForFunction(
      () =>
        JSON.parse(
          localStorage[
            "study-atlas:mock-exams:v1:attempt:" + location.hash.slice(1)
          ],
        ).statsDelivery?.["q1-01"]?.state === "sent",
    );
    assert.equal(submissions.length, 1);
    assert.equal((await local()).examVersion, 1);
    await resume();
    await choose("q1-ア", 0);
    await choose("q1-イ", 3);
    await grade();
    await p.waitForFunction(
      () =>
        JSON.parse(
          localStorage[
            "study-atlas:mock-exams:v1:attempt:" + location.hash.slice(1)
          ],
        ).statsDelivery?.["q1-02"]?.state === "unknown",
    );
    assert.deepEqual(
      submissions[1].p_results.map((x) => x.scoring_id),
      ["q1-02"],
    );
    assert.equal((await local()).result.points, 4);
    assert.equal((await local()).statsDelivery["q1-02"].state, "unknown");
    assert.equal(
      await p.getByRole("button", { name: "再送する", exact: true }).count(),
      0,
    );
    await p.reload();
    await p.waitForFunction(
      () =>
        JSON.parse(
          localStorage[
            "study-atlas:mock-exams:v1:attempt:" + location.hash.slice(1)
          ],
        ).statsDelivery?.["q1-02"]?.state === "unknown",
    );
    assert.equal(submissions.length, 2);
    await p
      .locator('[data-unit-rate="q1-01"]')
      .filter({ hasText: "0.0%" })
      .waitFor();
    await resume();
    await choose("q1-ク", 2);
    await grade();
    await p.waitForFunction(
      () =>
        JSON.parse(
          localStorage[
            "study-atlas:mock-exams:v1:attempt:" + location.hash.slice(1)
          ],
        ).statsDelivery?.["q1-06"]?.state === "sent",
    );
    assert.deepEqual(
      submissions[2].p_results.map((x) => x.scoring_id),
      ["q1-06"],
    );
    await p.getByRole("button", { name: "解答に戻る", exact: true }).click();
    await p.getByRole("button", { name: "正誤表記あり", exact: true }).click();
    await choose("q1-オ", 2);
    await p
      .getByRole("button", { name: "復習を採点する", exact: true })
      .click();
    assert.equal(submissions.length, 3);
    assert.equal((await local()).statsDelivery["q1-04"], undefined);
    await p.reload();
    await p.waitForFunction(
      () =>
        JSON.parse(
          localStorage[
            "study-atlas:mock-exams:v1:attempt:" + location.hash.slice(1)
          ],
        ).statsDelivery?.["q1-06"]?.state === "sent",
    );
    assert.equal(submissions.length, 3);
    const firstId = (await local()).id;
    await p.getByRole("button", { name: "一覧に戻る", exact: true }).click();
    await p
      .getByRole("button", { name: "時間制限なしで解く", exact: true })
      .click();
    await choose("q1-ア", 0);
    await grade();
    await p.waitForFunction(
      () =>
        JSON.parse(
          localStorage[
            "study-atlas:mock-exams:v1:attempt:" + location.hash.slice(1)
          ],
        ).statsDelivery?.["q1-01"]?.state === "sent",
    );
    assert.notEqual((await local()).id, firstId);
    await p
      .locator('[data-unit-rate="q1-01"]')
      .filter({ hasText: "50.0%" })
      .waitFor();
    assert.equal(submissions.length, 4);
    assert.equal(
      (await p.locator(".results").textContent()).includes("参考"),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: direct RPC, first-answer-only, new units after resume, unknown retained/no resend, personal grades, review excluded, repeat attempt, normal average labels",
    );
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
