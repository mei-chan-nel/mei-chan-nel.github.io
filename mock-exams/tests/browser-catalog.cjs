const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const root = process.env.MOCK_SITE_ROOT || path.resolve(__dirname, "../..");
const output = path.resolve(__dirname, "../../../work/mock-exam-catalog");
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
  const origin = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const errors = [],
    submissions = [];
  async function newPage(width) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
    });
    await context.route("https://*.supabase.co/**", (r) => {
      const body = r.request().postDataJSON();
      if (body.p_results) submissions.push(body);
      return r.fulfill({
        json: body.p_results
          ? { updated_count: body.p_results.length }
          : { items: [] },
      });
    });
    const p = await context.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    return p;
  }
  const pause = async (p) => {
    await p.getByRole("button", { name: "中断", exact: true }).click();
    await p
      .getByRole("button", { name: "採点せずに中断", exact: true })
      .click();
    await p.locator("#exam-list").waitFor();
  };
  const attempt = (p) =>
    p.evaluate(() =>
      JSON.parse(
        localStorage[
          "study-atlas:mock-exams:v1:attempt:" + location.hash.slice(1)
        ],
      ),
    );
  const mode = (p, section = false) =>
    p
      .locator("#exam-modes")
      .getByRole("button", {
        name: section ? /大問ごとに演習する/ : /回ごとに受験する/,
      })
      .click();
  const choose = (p) =>
    p
      .locator("#exam-list")
      .getByRole("button", { name: "選択", exact: true })
      .click();
  const noOverflow = async (p) =>
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
  try {
    const p = await newPage(1440);
    await p.goto(origin + "/");
    await p.locator('a[href="./mock-exams/"]').first().click();
    await p
      .getByRole("heading", { name: "情報Ⅰ 実戦模試", exact: true })
      .waitFor();
    await p.locator("#exam-list .catalog-exam").waitFor();
    assert.equal(await p.locator(".mode-choice").count(), 2);
    assert.equal(await p.locator("#section-picker").isVisible(), false);
    assert.equal(await p.locator(".catalog-exam").count(), 1);
    assert.equal(await p.locator(".exam-status").textContent(), "未受験");
    assert.equal(await p.locator("#time-picker").isVisible(), true);
    assert.equal(
      await p.locator('#catalog-time [aria-pressed="true"]').textContent(),
      "60分で受験する",
    );
    assert.equal(await p.locator(".exam-detail").count(), 0);
    // Both are true same-origin downloads, rather than links to a PDF viewer.
    for (const title of ["問題冊子PDF", "解答解説PDF"]) {
      const a = p.getByRole("link", { name: title, exact: true });
      assert.match(
        await a.getAttribute("href"),
        /exams\/001\/1\/(problem|solution)\.pdf$/,
      );
      assert.equal(await a.getAttribute("target"), null);
      const waiting = p.waitForEvent("download");
      await a.click();
      const file = await waiting;
      assert.equal(await file.failure(), null);
      assert.equal(
        file.suggestedFilename(),
        `情報Ⅰ_実戦模試_No.001_${title}.pdf`,
      );
      const data = fs.readFileSync(await file.path());
      assert.equal(data.subarray(0, 4).toString(), "%PDF");
      assert.ok(data.length > 1_000_000);
    }
    assert.equal(await p.locator("#exam-list").isVisible(), true);
    assert.equal(await p.evaluate(() => location.hash), "");
    assert.equal(
      await p.evaluate(
        () =>
          Object.keys(localStorage).filter((k) => k.includes(":attempt:"))
            .length,
      ),
      0,
    );
    await p
      .getByRole("button", { name: "時間制限なしで解く", exact: true })
      .click();
    assert.equal(
      await p.locator('#catalog-time [aria-pressed="true"]').textContent(),
      "時間制限なしで解く",
    );
    await noOverflow(p);
    await p.screenshot({
      path: path.join(output, "catalog-desktop.png"),
      fullPage: true,
    });
    await choose(p);
    await p
      .frameLocator("#book-frame")
      .locator('[data-field="q1-ア"]')
      .first()
      .waitFor();
    const full = await attempt(p);
    assert.equal(full.mode, "untimed");
    assert.equal(full.examId, "001");
    assert.equal(full.sectionIds.length, 5);
    await pause(p);
    assert.equal(await p.locator(".exam-status").textContent(), "中断中");
    await mode(p, true);
    assert.equal(await p.locator("#catalog-sections button").count(), 5);
    assert.equal(await p.locator("#time-picker").isVisible(), false);
    assert.equal(await p.locator(".exam-status").textContent(), "未受験");
    await p
      .locator("#catalog-sections")
      .getByRole("button", { name: "第3問", exact: true })
      .click();
    assert.equal(
      await p.locator("#catalog-context").textContent(),
      "第3問の演習",
    );
    await p.screenshot({
      path: path.join(output, "catalog-section-desktop.png"),
      fullPage: true,
    });
    await choose(p);
    await p
      .frameLocator("#book-frame")
      .locator('[data-field="q3-ア"]')
      .first()
      .waitFor();
    const section = await attempt(p);
    assert.equal(section.examId, full.examId);
    assert.deepEqual(section.sectionIds, ["q3"]);
    await p.getByRole("button", { name: "採点する", exact: true }).click();
    await p.getByRole("heading", { name: "採点結果", exact: true }).waitFor();
    assert.equal(
      (await p.locator(".summary-table tfoot td").first().textContent()).trim(),
      "0 / 25点",
    );
    await p.getByRole("button", { name: "一覧に戻る", exact: true }).click();
    assert.equal(await p.locator(".exam-status").textContent(), "採点済み");
    await p
      .locator("#catalog-sections")
      .getByRole("button", { name: "第1問", exact: true })
      .click();
    assert.equal(await p.locator(".exam-status").textContent(), "未受験");
    await p
      .locator("#catalog-sections")
      .getByRole("button", { name: "第3問", exact: true })
      .click();
    await choose(p);
    await p
      .frameLocator("#book-frame")
      .locator('[data-field="q3-ア"]')
      .first()
      .waitFor();
    assert.notEqual((await attempt(p)).id, section.id);
    await pause(p);
    await mode(p);
    assert.equal(await p.locator(".exam-status").textContent(), "中断中");
    await p
      .locator("#exam-list")
      .getByRole("button", { name: "再開", exact: true })
      .click();
    await p
      .frameLocator("#book-frame")
      .locator('[data-field="q1-ア"]')
      .first()
      .waitFor();
    assert.equal((await attempt(p)).id, full.id);
    await p.reload();
    await p
      .frameLocator("#book-frame")
      .locator('[data-field="q1-ア"]')
      .first()
      .waitFor();
    assert.equal((await attempt(p)).id, full.id);
    await pause(p);
    await p.getByRole("button", { name: "学習履歴", exact: true }).click();
    assert.equal(await p.evaluate(() => location.hash), "#history");
    assert.equal(await p.locator("#history-list tr").count(), 3);
    assert.match(
      await p.locator("#history-list").textContent(),
      /No.001.*第3問/s,
    );
    await p
      .locator("#history-list tr")
      .filter({ hasText: "0 / 25点" })
      .getByRole("button", { name: "復習", exact: true })
      .click();
    await p.getByText("復習モード", { exact: true }).waitFor();
    assert.equal(
      submissions.length,
      0,
      "ungraded and wholly blank/review attempts do not submit",
    );
    const mobile = await newPage(390);
    await mobile.goto(origin + "/mock-exams/");
    await mobile.locator("#exam-list").waitFor();
    await noOverflow(mobile);
    await mobile.screenshot({
      path: path.join(output, "catalog-mobile.png"),
      fullPage: true,
    });
    await mode(mobile, true);
    await mobile
      .locator("#catalog-sections")
      .getByRole("button", { name: "第2問B", exact: true })
      .click();
    await noOverflow(mobile);
    await mobile.screenshot({
      path: path.join(output, "catalog-section-mobile.png"),
      fullPage: true,
    });
    await choose(mobile);
    await mobile
      .frameLocator("#book-frame")
      .locator('[data-field="q2b-コ"]')
      .first()
      .waitFor();
    assert.deepEqual((await attempt(mobile)).sectionIds, ["q2b"]);
    await pause(mobile);
    await mode(mobile);
    await mobile
      .getByRole("button", { name: "60分で受験する", exact: true })
      .click();
    await choose(mobile);
    await mobile
      .frameLocator("#book-frame")
      .locator('[data-field="q1-ア"]')
      .first()
      .waitFor();
    assert.equal((await attempt(mobile)).mode, "timed");
    const many = await newPage(390);
    const fixtures = Array.from({ length: 20 }, (_, i) => ({
      id: String(i + 1).padStart(3, "0"),
      version: 1,
      title: "情報Ⅰ 実戦模試 No." + String(i + 1).padStart(3, "0"),
      manifest: "exams/001/1/exam.json",
    }));
    await many.route("**/mock-exams/catalog.json", (r) =>
      r.fulfill({ json: fixtures }),
    );
    await many.goto(origin + "/mock-exams/");
    await many.locator(".catalog-exam").nth(19).waitFor();
    assert.deepEqual((await many.locator(".catalog-exam").all()).length, 20);
    assert.equal(
      await many.locator(".catalog-exam").first().getAttribute("data-exam-id"),
      "020",
    );
    await many.locator("#catalog-sort").selectOption("number");
    assert.equal(
      await many.locator(".catalog-exam").first().getAttribute("data-exam-id"),
      "001",
    );
    await many.evaluate(() => {
      const a = {
        schemaVersion: 1,
        id: "qa-catalog-only",
        examId: "020",
        examVersion: 1,
        mode: "untimed",
        sectionIds: ["q1", "q2a", "q2b", "q3", "q4"],
        createdAt: 100,
        updatedAt: 100,
        status: "graded",
        result: { points: 5, maxPoints: 100 },
      };
      localStorage.setItem(
        "study-atlas:mock-exams:v1:attempt:" + a.id,
        JSON.stringify(a),
      );
    });
    await many.locator("#catalog-sort").selectOption("recommended");
    assert.equal(
      await many.locator(".catalog-exam").last().getAttribute("data-exam-id"),
      "020",
    );
    await many.locator("#catalog-sort").selectOption("newest");
    assert.equal(
      await many.locator(".catalog-exam").first().getAttribute("data-exam-id"),
      "020",
    );
    await mode(many, true);
    assert.equal(
      await many.locator(".catalog-exam").count(),
      20,
      "no exams × sections expansion",
    );
    assert.equal(await many.locator("#catalog-sections button").count(), 5);
    assert.equal(await many.locator(".exam-status.completed").count(), 0);
    await noOverflow(many);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: portal entry, two modes, No.001 only, time selection/direct start/PDF downloads, section-first same exam, separate statuses, resume/reload, repeat, shared history/review, mobile and 20-exam sorting (fixtures only)",
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
