/* PLAYWRIGHT_MODULE=/path/to/playwright node mock-exams/tests/browser.cjs */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs"),
  http = require("node:http"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../.."),
  output =
    process.env.MOCK_QA_OUTPUT || path.resolve(root, "../work/mock-exam-qa");
fs.mkdirSync(output, { recursive: true });
const exam = JSON.parse(
  fs.readFileSync(path.join(root, "mock-exams/exams/001/1.0.0/exam.json")),
);
const perfect = Object.fromEntries(
  exam.scoring.flatMap((u) =>
    u.fields.map((f, i) => [f, u.rule.patterns[0][i]]),
  ),
);
const server = http.createServer((req, res) => {
  let file = path.resolve(
    root,
    "." + decodeURIComponent(req.url.split("?")[0]),
  );
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    if (fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html; charset=utf-8",
        ".mjs": "text/javascript",
        ".js": "text/javascript",
        ".json": "application/json",
        ".css": "text/css",
        ".woff2": "font/woff2",
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
  const url = "http://127.0.0.1:" + server.address().port + "/mock-exams/";
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const context = await b.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.route("https://*.supabase.co/**", (r) =>
      r.fulfill({ json: [] }),
    );
    const p = await context.newPage();
    let errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(url);
    await p.getByText("時間制限なしで解く", { exact: true }).click();
    const f = p.frameLocator("iframe");
    for (const section of exam.sections) {
      await p
        .locator(".book-nav button")
        .filter({ hasText: section.title })
        .first()
        .click();
      await f.locator(`[data-field^="${section.id}-"]`).first().waitFor();
      await p.screenshot({
        path: path.join(output, section.id + "-desktop.png"),
      });
      for (const field of exam.fields.filter(
        (x) => x.sectionId === section.id,
      )) {
        await f.locator(`[data-field="${field.id}"]`).first().click();
        if (field.type === "text") {
          await p
            .locator(".keypad button")
            .filter({ hasText: new RegExp("^" + perfect[field.id] + "$") })
            .click();
          await p.locator("#close-answer").click();
        } else {
          await p
            .locator("#answer-options>button")
            .nth(Number(perfect[field.id]))
            .click();
        }
        assert.ok(
          (
            await f.locator(`[data-field="${field.id}"]`).allTextContents()
          ).every((s) => s.length > 0),
        );
      }
    }
    await p.getByRole("button", { name: "採点する", exact: true }).click();
    await p.getByRole("heading", { name: "採点結果" }).waitFor();
    assert.equal((await p.locator(".score").textContent()).trim(), "100 / 100");
    await p.screenshot({ path: path.join(output, "result.png") });
    console.log("PASS: all 49 answers through UI -> 100/100");
    await p.getByRole("button", { name: "続きから解く" }).click();
    await p.getByRole("button", { name: "正誤表示なし", exact: true }).click();
    await f.locator("[data-field]").first().waitFor();
    assert.equal(await f.locator("[data-verdict]").count(), 0);
    await p.locator(".book-nav button").filter({ hasText: "第1問" }).click();
    await f.locator('[data-field="q1-ウ"]').first().click();
    await p.locator("#clear-answer").click();
    await p.locator("#flag-answer").click();
    await p.locator("#close-answer").click();
    await p.getByRole("button", { name: "中断", exact: true }).click();
    await p
      .getByRole("button", { name: "採点せずに中断", exact: true })
      .click();
    await p.getByRole("button", { name: "前回の受験を開く" }).click();
    await p.getByRole("button", { name: "続きから解く" }).click();
    await p.getByRole("button", { name: "正誤表示なし", exact: true }).click();
    await f.locator('[data-field="q1-ウ"]').first().waitFor();
    assert.equal(
      await f.locator('[data-field="q1-ウ"]').first().textContent(),
      "ウ",
    );
    const other = await context.newPage();
    await other.goto(p.url());
    await other
      .getByText(
        "この受験は別のタブで開かれています。先にそちらを中断してください。",
      )
      .waitFor();
    await other.close();
    console.log("PASS: clear, flag, pause/resume, concurrent-tab lock");
    await p.getByRole("button", { name: "採点する", exact: true }).click();
    assert.equal((await p.locator(".score").textContent()).trim(), "97 / 100");
    await p
      .getByRole("button", { name: "間違えたところを復習", exact: true })
      .click();
    await f.locator('[data-field="q1-ウ"]').first().waitFor();
    assert.equal(
      await f.locator('[data-field="q1-エ"]').first().textContent(),
      "エ",
    );
    assert.equal(
      await f
        .locator('[data-field="q1-ア"]')
        .first()
        .getAttribute("aria-disabled"),
      "true",
    );
    await p.setViewportSize({ width: 390, height: 844 });
    await f.locator('[data-field="q1-ウ"]').first().click();
    await p.getByRole("button", { name: "5", exact: true }).click();
    await p.screenshot({ path: path.join(output, "mobile-keypad.png") });
    const keys = await p.locator(".keypad").boundingBox();
    const dialog = await p.locator("#answer-dialog").boundingBox();
    assert.ok(
      keys.y + keys.height <= dialog.y + dialog.height,
      "4x4 keys must be visible",
    );
    await p.locator("#close-answer").click();
    await f.locator('[data-field="q1-エ"]').first().click();
    await p.getByRole("button", { name: "C", exact: true }).click();
    await p.locator("#close-answer").click();
    await p
      .getByRole("button", { name: "復習を採点する", exact: true })
      .click();
    assert.equal((await p.locator(".score").textContent()).trim(), "97 / 100");
    await p.getByRole("button", { name: "復習完了 · もう一度確認" }).waitFor();
    console.log(
      "PASS: review whole scoring unit, locks correct, keeps original 97 points",
    );
    await p.getByRole("button", { name: "問題・解説", exact: true }).click();
    await p.getByRole("button", { name: "問題に戻る", exact: true }).click();
    for (const s of exam.sections) {
      await p
        .locator(".book-nav button")
        .filter({ hasText: s.title })
        .first()
        .click();
      await f.locator(`[data-field^="${s.id}-"]`).first().waitFor();
      const dims = await f
        .locator("body")
        .evaluate((el) => [el.clientWidth, el.scrollWidth]);
      assert.ok(dims[1] <= dims[0] + 1, s.id + " horizontal overflow");
      await p.screenshot({ path: path.join(output, s.id + "-mobile.png") });
    }
    console.log(
      "PASS: five sections at 390px without document horizontal overflow",
    );
    await f.locator("[data-zoom]").first().click();
    await p.locator("#figure-dialog").waitFor({ state: "visible" });
    assert.ok(await p.locator("#figure-dialog svg,#figure-dialog img").count());
    await p.locator("#close-figure").click();
    console.log("PASS: graph zoom");
    await p.locator(".book-nav button").filter({ hasText: "第3問" }).click();
    await f
      .locator('[data-field="q3-カ"][data-display="content"]')
      .first()
      .waitFor();
    assert.match(
      await f
        .locator('[data-field="q3-カ"][data-display="content"]')
        .first()
        .textContent(),
      /Zaiko/,
    );
    console.log("PASS: selected formula inserted into program");
    await p.getByRole("button", { name: "一覧へ", exact: true }).click();
    await p.getByText("大問を選んで解く", { exact: true }).click();
    await p.getByRole("button", { name: "第2問B", exact: true }).click();
    await f.locator('[data-field="q2b-コ"]').first().waitFor();
    await p.getByRole("button", { name: "採点する", exact: true }).click();
    assert.equal((await p.locator(".score").textContent()).trim(), "0 / 15");
    console.log("PASS: section-only maximum 15");
    await p.getByRole("button", { name: "一覧へ", exact: true }).click();
    await p
      .getByRole("button", { name: "60分で受験する", exact: true })
      .click();
    await f.locator('[data-field="q1-ア"]').first().waitFor();
    // Simulate an interrupted timed exam already past its deadline, then reopen it.
    const expired = await p.evaluate(() => {
      const key = Object.keys(localStorage).find(
        (k) => k.includes(location.hash.slice(1)) && !k.endsWith(":backup"),
      );
      const a = JSON.parse(localStorage[key]);
      a.startedAt = Date.now() - 3601000;
      return { key, a };
    });
    await p.close();
    const timed = await context.newPage();
    await timed.goto(url);
    await timed.evaluate(
      ({ key, a }) => localStorage.setItem(key, JSON.stringify(a)),
      expired,
    );
    await timed.goto(url + "#" + expired.a.id);
    // Fragment-only navigation does not reload a previously loaded document.
    await timed.reload();
    await timed
      .getByRole("heading", { name: "採点結果", exact: true })
      .waitFor();
    assert.equal(
      (await timed.locator(".score").textContent()).trim(),
      "0 / 100",
    );
    console.log("PASS: timed resume auto-grades at deadline");

    assert.deepEqual(errors, []);
    console.log("PASS: no page errors");
    await context.close();
  } finally {
    await b.close();
    server.closeAllConnections();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.closeAllConnections();
  server.close();
  process.exitCode = 1;
});
