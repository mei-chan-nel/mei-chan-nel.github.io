const { startFullExam } = require("./catalog-helpers.cjs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../.."),
  exam = JSON.parse(
    fs.readFileSync(path.join(root, "mock-exams/exams/001/1/exam.json")),
  );
const server = http.createServer((req, res) => {
  let p = path.resolve(root, "." + decodeURIComponent(req.url.split("?")[0]));
  if (p !== root && !p.startsWith(root + path.sep)) {
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
        ".css": "text/css",
        ".json": "application/json",
        ".pdf": "application/pdf",
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
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      }),
      p = await context.newPage(),
      errors = [],
      requests = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await context.route("https://*.supabase.co/**", async (route) => {
      const body = route.request().postDataJSON();
      requests.push(body);
      if (body.p_results) {
        await new Promise((r) => setTimeout(r, 500));
        await route.fulfill({ json: { updated_count: body.p_results.length } });
      } else
        await route.fulfill({
          json: {
            items: exam.scoring.map((u) => ({
              section_id: u.sectionId,
              scoring_id: u.id,
              answered_count: 10,
              correct_count: 5,
              points_sum: u.maxPoints * 5,
            })),
          },
        });
    });
    const url = "http://127.0.0.1:" + server.address().port + "/mock-exams/";
    await p.goto(url);
    await startFullExam(p);
    const frame = () => p.frameLocator("#book-frame");
    await frame().locator('[data-field="q1-ア"]').first().click();
    await p.locator("#answer-options>button").nth(1).click();
    assert.equal(
      await frame().locator('[data-field="q1-ア"]').first().textContent(),
      "ア ①",
    );
    await frame().locator('[data-field="q1-ア"]').first().click();
    await p.mouse.click(8, 8);
    assert.equal(
      await p.locator("#answer-dialog").evaluate((d) => d.open),
      false,
    );
    await p
      .locator(".answer-grid button")
      .filter({ hasText: "ウ —" })
      .first()
      .click();
    assert.equal(
      await p.locator("#answer-dialog").evaluate((d) => d.open),
      false,
    );
    await frame().locator('[data-field="q1-ウ"]').first().click();
    const popup = await p.locator("#answer-dialog").boundingBox();
    assert.ok(popup.width <= 311);
    assert.ok(popup.height < 600);
    assert.equal(
      await p.locator("#answer-dialog").evaluate((d) => d.matches(":modal")),
      false,
    );
    await p.getByRole("button", { name: "5", exact: true }).click();
    await p.locator("#flag-answer").click();
    await p.locator("#next-answer").click();
    await p.locator("#answer-title").filter({ hasText: "解答欄 エ" }).waitFor();
    await p.locator("#close-answer").click();
    await p
      .locator(".answer-grid button")
      .filter({ hasText: "ウ 5 🏳️" })
      .first()
      .waitFor();
    const text = await frame().locator("body").textContent();
    assert.ok(!text.includes("ⓐ～ⓓ"));
    assert.ok(text.includes("空欄エには当てはまる文字を答えよ。"));
    await p
      .locator("#section-navigation")
      .getByRole("button", { name: "第2問A", exact: true })
      .click();
    await frame().locator('[data-field="q2a-ア"]').first().waitFor();
    await p
      .locator("#book-next")
      .getByRole("button", { name: "第2問B →", exact: true })
      .click();
    await frame().locator('[data-field="q2b-コ"]').first().waitFor();
    await p
      .locator("#section-navigation")
      .getByRole("button", { name: "第3問", exact: true })
      .click();
    await frame().locator('[data-field="q3-カ"]').first().click();
    await p.locator("#answer-options>button").nth(0).click();
    const geometry = await frame()
      .locator('.code [data-field="q3-カ"]')
      .first()
      .evaluate((e) => {
        const b = e.getBoundingClientRect(),
          r = document.createRange();
        r.selectNodeContents(e);
        const t = r.getBoundingClientRect();
        return Math.abs((t.top + t.bottom) / 2 - (b.top + b.bottom) / 2);
      });
    assert.ok(geometry < 4, "program blank text vertically centred");
    const gap = await frame()
      .locator("fieldset.choices")
      .first()
      .evaluate(
        (e) =>
          e.querySelector(".option").getBoundingClientRect().top -
          e.querySelector("legend").getBoundingClientRect().bottom,
      );
    assert.ok(gap >= 8, "legend separation");
    await p
      .getByRole("button", { name: "採点する", exact: true })
      .first()
      .click();
    await p.getByRole("heading", { name: "採点結果", exact: true }).waitFor();
    assert.equal(await p.evaluate(() => scrollY), 0);
    assert.equal(await p.locator("#submission-status").count(), 0);
    assert.deepEqual(
      await p.locator(".summary-table thead th").allTextContents(),
      ["大問", "あなたの得点", "あなたの得点率", "平均得点", "平均得点率"],
    );
    assert.deepEqual(await p.locator("#unit-head th").allTextContents(), [
      "問題番号（配点）",
      "設問",
      "解答記号",
      "正解",
      "配点",
      "あなたの回答",
      "正誤",
      "平均得点率",
    ]);
    await p
      .locator('[data-unit-rate="q1-01"]')
      .filter({ hasText: "50.0%" })
      .waitFor();
    await p.screenshot({
      path: "/workspace/work/mock-results-new.png",
      fullPage: true,
    });
    await p.getByRole("button", { name: "解説を読む", exact: true }).click();
    await p
      .frameLocator("#paired-problem")
      .locator('[data-field="q1-ア"]')
      .first()
      .waitFor();
    assert.equal(await p.locator(".explanation-panes iframe").count(), 2);
    await frame().locator("body").waitFor();
    await p.screenshot({ path: "/workspace/work/mock-explanation-pc.png" });
    await p.setViewportSize({ width: 390, height: 844 });
    await p
      .locator("#section-navigation")
      .getByRole("button", { name: "第2問A問題", exact: true })
      .click();
    await frame().locator('[data-field="q2a-ア"]').first().waitFor();
    assert.equal(await p.locator("#section-navigation button").count(), 10);
    assert.equal(await p.locator("#paired-problem").count(), 0);
    assert.equal(await p.locator("#timer").count(), 0);
    await p
      .locator("#section-navigation")
      .getByRole("button", { name: "第3問解説", exact: true })
      .click();
    await frame().locator("body").waitFor();
    await p
      .getByRole("button", { name: "採点結果に戻る", exact: true })
      .first()
      .click();
    await p.getByRole("button", { name: "解答に戻る", exact: true }).click();
    await p.getByRole("button", { name: "正誤表記あり", exact: true }).click();
    await p
      .locator("#section-navigation")
      .getByRole("button", { name: "第1問", exact: true })
      .click();
    await frame().locator('[data-field="q1-ア"]').first().waitFor();
    const sent = requests.filter((b) => b.p_results).length;
    await p
      .getByRole("button", { name: "復習を採点する", exact: true })
      .first()
      .click();
    assert.equal(requests.filter((b) => b.p_results).length, sent);
    await p.getByRole("button", { name: "一覧に戻る", exact: true }).click();
    await startFullExam(p);
    await frame().locator('[data-field="q1-ア"]').first().click();
    await p.locator("#answer-options>button").nth(0).click();
    await p
      .getByRole("button", { name: "採点する", exact: true })
      .first()
      .click();
    await p
      .getByRole("button", { name: "過去の成績も表示する", exact: true })
      .click();
    await p
      .getByRole("columnheader", { name: "1回目の回答", exact: true })
      .waitFor();
    await p
      .getByRole("columnheader", { name: "今回の得点", exact: true })
      .waitFor();
    assert.ok(
      await p
        .locator("#unit-table")
        .evaluate((t) => t.scrollWidth > innerWidth),
    );
    await p
      .getByRole("button", { name: "この採点結果を破棄する", exact: true })
      .click();
    await p
      .getByRole("heading", { name: "情報Ⅰ 実戦模試", exact: true })
      .waitFor();
    assert.equal(await p.locator("#history-list .actions").count(), 1);
    await p
      .locator("#history-list")
      .getByRole("button", { name: "削除", exact: true })
      .click();
    assert.equal(await p.locator("#history-list .actions").count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: popovers, labelled answers, jump-only sidebar, section/footer navigation, score tables, paired/mobile explanation, review, history and discard",
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
