/* Generic pre-publication test. The supplied exam need not be in catalog.json.
   PLAYWRIGHT_MODULE=/path/to/playwright node mock-exams/tests/browser-added-exam.cjs exams/002/1/exam.json
   All stats use in-memory responses; no live writes or sample history. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  assert = require("node:assert/strict");
const { startFullExam } = require("./catalog-helpers.cjs");
const root = path.resolve(__dirname, "../.."),
  manifest = process.argv[2] || "exams/001/1/exam.json";
if (!/^exams\/[0-9]{3}\/[1-9][0-9]*\/exam\.json$/.test(manifest))
  throw Error("Invalid manifest path");
const exam = JSON.parse(
  fs.readFileSync(path.join(root, "mock-exams", manifest)),
);
const qa = JSON.parse(
  fs.readFileSync(
    path.join(root, "mock-exams", path.dirname(manifest), "source/qa.json"),
  ),
);
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://local").pathname;
  if (pathname === "/mock-exams/catalog.json") {
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify([
        { id: exam.id, version: exam.version, title: exam.title, manifest },
      ]),
    );
  }
  let file = path.resolve(root, "." + decodeURIComponent(pathname));
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
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
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
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1333, height: 900 },
    });
    const page = await context.newPage(),
      errors = [],
      writes = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await context.route("https://*.supabase.co/**", (route) => {
      const data = route.request().postDataJSON();
      if (data.p_results) writes.push(data);
      return route.fulfill({
        json: data.p_results
          ? { updated_count: data.p_results.length }
          : { items: [] },
      });
    });
    await context.route("https://www.googletagmanager.com/**", (route) =>
      route.fulfill({ body: "", contentType: "text/javascript" }),
    );
    await page.goto(`http://127.0.0.1:${server.address().port}/mock-exams/`);
    await startFullExam(page, "untimed", exam.id);
    await page.locator(".bottom-section-navigation button").first().waitFor();
    assert.equal(
      await page.locator(".bottom-section-navigation button").count(),
      exam.sections.length,
    );
    assert.equal(
      await page
        .locator("#book-next")
        .getByRole("button", { name: /→/ })
        .count(),
      0,
    );
    assert.equal(
      await page.locator("[data-run-timer]").textContent(),
      await page.locator("#timer").textContent(),
    );
    await page
      .locator(".bottom-section-navigation")
      .getByRole("button", { name: exam.sections.at(-1).title, exact: true })
      .click();
    assert.equal(
      await page
        .locator(".bottom-section-navigation [aria-current=true]")
        .textContent(),
      exam.sections.at(-1).title,
    );
    for (const section of exam.sections) {
      await page
        .locator(".book-nav")
        .getByRole("button", { name: section.title, exact: true })
        .click();
      const frame = page.frameLocator("#book-frame");
      for (const field of exam.fields.filter(
        (f) => f.sectionId === section.id,
      )) {
        await frame.locator(`[data-field="${field.id}"]`).first().click();
        if (field.type === "text") {
          await page
            .locator(".keypad")
            .getByRole("button", { name: qa.answers[field.id], exact: true })
            .click();
          await page.locator("#close-answer").click();
        } else {
          const index = field.choices.findIndex(
            (c) => c.value === qa.answers[field.id],
          );
          assert.ok(index >= 0);
          await page.locator("#answer-options>button").nth(index).click();
        }
      }
    }
    await page
      .getByRole("button", { name: "採点する（問題末尾）", exact: true })
      .click();
    const events = await page.evaluate(() =>
      (window.dataLayer || [])
        .filter(
          (args) => args[0] === "event" && args[1].startsWith("mock_exam_"),
        )
        .map((args) => [args[1], args[2]]),
    );
    assert.deepEqual(
      events.map((e) => e[0]),
      ["mock_exam_start", "mock_exam_grade"],
    );
    assert.equal(events[0][1].exam_mode, "untimed");
    assert.equal(events[1][1].grading_type, "final");
    assert.ok(events.every((e) => !new URL(e[1].page_location).hash));
    await page
      .getByRole("heading", { name: "採点結果", exact: true })
      .waitFor();
    assert.equal(
      (
        await page.locator(".summary-table tfoot td").first().textContent()
      ).trim(),
      `${qa.expectedTotal} / ${exam.maxPoints}点`,
    );
    await page.waitForFunction(() => {
      const value = JSON.parse(
        localStorage[
          "study-atlas:mock-exams:v1:attempt:" + location.hash.slice(1)
        ],
      );
      return (
        Object.values(value.statsDelivery).length &&
        Object.values(value.statsDelivery).every((s) => s.state === "sent")
      );
    });
    assert.equal(writes.length, 1);
    assert.equal(writes[0].p_exam_id, exam.id);
    assert.equal(writes[0].p_exam_version, exam.version);
    for (const unit of exam.scoring) {
      const row = writes[0].p_results.find((r) => r.scoring_id === unit.id);
      assert.equal(row.answer, unit.fields.map((f) => qa.answers[f]).join("|"));
      assert.equal(row.earned_points, unit.maxPoints);
    }
    assert.equal(writes[0].p_results.length, exam.scoring.length);
    await page.getByRole("button", { name: "解説を読む", exact: true }).click();
    for (const section of exam.sections) {
      await page
        .locator("#section-navigation")
        .getByRole("button", { name: section.title, exact: true })
        .click();
      const id = exam.scoring.find((u) => u.sectionId === section.id).id;
      await page
        .frameLocator("#book-frame")
        .locator(`[data-reading-units~="${id}"]`)
        .waitFor();
      await page
        .frameLocator("#paired-problem")
        .locator(`[data-reading-units~="${id}"]`)
        .waitFor();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const section of exam.sections) {
      await page
        .locator("#section-navigation")
        .getByRole("button", { name: section.title, exact: true })
        .click();
      const id = exam.scoring.find((u) => u.sectionId === section.id).id;
      const link = page
        .frameLocator("#book-frame")
        .locator(`[data-reading-problem="${id}"]`);
      await link.click();
      const firstField = exam.scoring.find((u) => u.id === id).fields[0];
      await page
        .frameLocator("#book-frame")
        .locator(`[data-field="${firstField}"]`)
        .first()
        .waitFor();
      assert.ok(
        await page
          .frameLocator("#book-frame")
          .locator("body")
          .evaluate((b) => b.scrollWidth <= b.clientWidth + 1),
      );
      await page.locator("#back-list").click();
      await link.waitFor();
    }
    await page.locator("#back-list").click();
    await page.getByRole("button", {name: "一覧に戻る", exact:true}).click();
    await startFullExam(page, "timed", exam.id);
    await page.locator("[data-run-timer]").waitFor();
    assert.equal(await page.locator(".answering-toolbar").isVisible(), false);
    assert.equal(await page.locator("#book-next").isVisible(), true);
    await page.getByRole("button", {name:"中断（問題末尾）", exact:true}).click();
    await page.getByRole("button", {name:"採点せずに中断", exact:true}).click();
    await page.locator("#exam-modes").getByRole("button", {name:/大問ごとに演習する/}).click();
    await page.locator("#catalog-sections").getByRole("button", {name:exam.sections[1].title,exact:true}).click();
    await page.locator("#exam-list").getByRole("button", {name:"選択", exact:true}).click();
    await page.locator("[data-run-timer]").waitFor();
    assert.equal(await page.locator(".bottom-section-navigation button").count(),1);
    await page.getByRole("button", {name:"中断（問題末尾）",exact:true}).click();
    await page.getByRole("button", {name:"ここまでを採点して中断",exact:true}).click();
    await page.getByRole("heading", {name:"採点結果",exact:true}).waitFor();
    const activity = await page.evaluate(() => (window.dataLayer || []).filter(args => args[0] === "event" && args[1].startsWith("mock_exam_")).map(args => [args[1],args[2]]));
    assert.deepEqual(activity.filter(e=>e[0]==="mock_exam_start").map(e=>e[1].exam_mode), ["untimed","timed","section"]);
    assert.deepEqual(activity.filter(e=>e[0]==="mock_exam_pause").map(e=>e[1].pause_type), ["ungraded","graded"]);
    assert.equal(activity.filter(e=>e[0]==="mock_exam_grade").at(-1)[1].grading_type,"interim");
    assert.equal(activity.filter(e=>e[0]==="mock_exam_start").at(-1)[1].section_id,exam.sections[1].id);
    assert.equal(writes.length, 1, "reading must not write statistics");
    assert.deepEqual(errors, []);
    console.log(
      `PASS No.${exam.id} v${exam.version}: all ${exam.fields.length} inputs → ${qa.expectedTotal} points; one exact RPC body; PC/mobile solutions and focused problems`,
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
