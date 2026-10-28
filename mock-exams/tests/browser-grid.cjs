const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs"),
  http = require("node:http"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const root = path.resolve(
    __dirname,
    "../../../sites/study-atlas-mock-exams-preview/dist",
  ),
  output = path.resolve(__dirname, "../../../work/mock-exam-grid");
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
    const b = r.request().postDataJSON();
    if (b.p_results) writes.push(b);
    return r.fulfill({
      json: b.p_results ? { updated_count: b.p_results.length } : { items: [] },
    });
  });
  const url =
      "http://127.0.0.1:" + server.address().port + "/mock-exams/#history",
    rows = () => p.locator("#history-list tr"),
    menu = () => p.locator("#history-column-menu");
  const tab = (name) =>
    p
      .locator(".history-filters")
      .getByRole("button", { name, exact: true })
      .click();
  const column = (key) => p.locator(`[data-history-column="${key}"]`).click();
  const apply = () =>
    menu().getByRole("button", { name: "適用", exact: true }).click();
  const reset = () =>
    p.getByRole("button", { name: "表示条件をリセット", exact: true }).click();
  const original = () =>
    p.evaluate(() =>
      JSON.stringify(
        Object.fromEntries(
          Object.keys(localStorage)
            .filter((k) => k.includes(":attempt:"))
            .sort()
            .map((k) => [k, localStorage[k]]),
        ),
      ),
    );
  try {
    await p.goto(url);
    await rows().nth(5).waitFor();
    const initial = await original();
    assert.equal(await rows().count(), 6);
    await tab("回ごと");
    assert.equal(await rows().count(), 3);
    await tab("大問ごと");
    assert.equal(await rows().count(), 18);
    assert.equal(await p.locator('[data-derived="true"]').count(), 15);
    await p.screenshot({
      path: path.join(output, "sections-desktop.png"),
      fullPage: true,
    });
    await column("scope");
    await menu().getByRole("searchbox", { name: "値を検索" }).fill("第3問");
    await apply();
    assert.equal(await rows().count(), 5);
    assert.ok(
      (await rows().locator("td:nth-of-type(2)").allTextContents()).every((v) =>
        v.includes("第3問"),
      ),
    );
    await column("points");
    await menu()
      .getByRole("spinbutton", { name: "下限", exact: true })
      .fill("20");
    await apply();
    assert.equal(await rows().count(), 2);
    await column("points");
    await menu().getByRole("button", { name: "↓ 降順", exact: true }).click();
    const points = await rows().evaluateAll((es) =>
      es.map((e) => Number(e.children[4].textContent.split("/")[0])),
    );
    assert.deepEqual(points, [25, 21]);
    await column("points");
    await menu().getByRole("button", { name: "↑ 昇順", exact: true }).click();
    assert.deepEqual(
      await rows().evaluateAll((es) =>
        es.map((e) => Number(e.children[4].textContent.split("/")[0])),
      ),
      [21, 25],
    );
    const derived = p.locator('#history-list tr[data-derived="true"]').first(),
      id = await derived.getAttribute("data-attempt-id");
    await derived
      .getByRole("button", { name: "採点結果", exact: true })
      .click();
    await p.getByRole("heading", { name: "採点結果", exact: true }).waitFor();
    assert.deepEqual(await p.locator("#section-results th").allTextContents(), [
      "第3問",
    ]);
    assert.match(
      await p.locator(".summary-table tfoot").textContent(),
      /25 \/ 25点/,
    );
    await p
      .getByRole("button", { name: "学習履歴に戻る", exact: true })
      .click();
    await rows().nth(1).waitFor();
    assert.equal(await rows().count(), 2);
    await p.reload();
    await rows().nth(1).waitFor();
    assert.equal(await rows().count(), 2);
    const derivedAgain = p.locator(
      `#history-list tr[data-attempt-id="${id}"][data-section-id="q3"]`,
    );
    await derivedAgain
      .getByRole("button", { name: "復習", exact: true })
      .click();
    await p.locator(".review-note").waitFor();
    assert.equal(await p.locator(".book-nav button").count(), 1);
    assert.equal(await p.locator(".book-nav button").textContent(), "第3問");
    await p
      .frameLocator("#book-frame")
      .locator('[data-field="q3-ア"]')
      .first()
      .waitFor();
    await p.reload();
    await p.locator(".review-note").waitFor();
    assert.equal(await p.locator(".book-nav button").textContent(), "第3問");
    await p.locator("#back-list").click();
    await rows().nth(1).waitFor();
    assert.equal(
      await original(),
      initial,
      "slicing, filters, sorting and scoped views do not change saved attempts",
    );
    await tab("すべて");
    assert.equal(
      await rows().count(),
      6,
      "all stays uncut with independent display settings",
    );
    await column("status");
    await menu().getByRole("searchbox", { name: "値を検索" }).fill("採点済み");
    await apply();
    assert.equal(await rows().count(), 5);
    await reset();
    assert.equal(await rows().count(), 6);
    await tab("回ごと");
    assert.equal(await rows().count(), 3);
    const date = await p.evaluate(() => {
      const a = Object.keys(localStorage)
          .filter((k) => k.includes(":attempt:") && !k.endsWith(":backup"))
          .map((k) => JSON.parse(localStorage[k]))
          .filter((a) => a.mode !== "section")
          .sort((a, b) => b.createdAt - a.createdAt)[0],
        d = new Date(a.createdAt);
      return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0"),
      ].join("-");
    });
    await column("date");
    await menu().getByLabel("下限", { exact: true }).fill(date);
    await menu().getByLabel("上限", { exact: true }).fill(date);
    await apply();
    assert.equal(await rows().count(), 1);
    await column("date");
    await menu()
      .getByRole("button", { name: "この列の絞り込みを解除", exact: true })
      .click();
    assert.equal(await rows().count(), 3);
    await column("rate");
    await menu().getByLabel("下限", { exact: true }).fill("50");
    await menu().getByLabel("上限", { exact: true }).fill("80");
    await apply();
    assert.equal(await rows().count(), 2);
    await column("rate");
    await menu().getByLabel("下限", { exact: true }).fill("90");
    await menu().getByLabel("上限", { exact: true }).fill("10");
    await apply();
    assert.match(await menu().locator(".column-error").textContent(), /下限/);
    await menu()
      .getByRole("button", { name: "キャンセル", exact: true })
      .click();
    await reset();
    await column("exam");
    await menu()
      .getByRole("checkbox", { name: "すべて選択", exact: true })
      .uncheck();
    await apply();
    assert.equal(await rows().count(), 0);
    assert.equal(await p.locator("#history-empty").isVisible(), true);
    await reset();
    await column("duration");
    await p.keyboard.press("Escape");
    assert.equal(await menu().evaluate((d) => d.open), false);
    await column("scope");
    await p.mouse.click(2, 2);
    assert.equal(await menu().evaluate((d) => d.open), false);
    await tab("大問ごと");
    assert.equal(
      await rows().count(),
      2,
      "section settings survive switching tabs",
    );
    await reset();
    assert.equal(await rows().count(), 18);
    await p.setViewportSize({ width: 390, height: 844 });
    await column("scope");
    const box = await menu().boundingBox();
    assert.ok(
      box.x >= 0 &&
        box.x + box.width <= 391 &&
        box.y >= 0 &&
        box.y + box.height <= 845,
    );
    await menu().getByRole("searchbox", { name: "値を検索" }).fill("第2問B");
    await apply();
    assert.equal(await rows().count(), 4);
    await p.screenshot({
      path: path.join(output, "sections-mobile.png"),
      fullPage: true,
    });
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    const cutRow = p.locator('#history-list tr[data-derived="true"]').first();
    await cutRow.getByRole("button", { name: "削除", exact: true }).click();
    await p.locator("#action-dialog").waitFor({ state: "visible" });
    await p.getByRole("button", { name: "キャンセル", exact: true }).click();
    assert.equal(await original(), initial);
    await p
      .locator('#history-list tr[data-derived="false"]')
      .getByRole("button", { name: "再開", exact: true })
      .click();
    await p
      .frameLocator("#book-frame")
      .locator('[data-field="q2b-コ"]')
      .first()
      .waitFor();
    await p.getByRole("button", { name: "中断", exact: true }).click();
    await p
      .getByRole("button", { name: "採点せずに中断", exact: true })
      .click();
    await rows().nth(3).waitFor();
    const resumedId = await p.evaluate(async () => {
      const { createAttempt, submit, AttemptStore } =
          await import("./engine/attempt.mjs"),
        exam = await fetch("./exams/001/1/exam.json").then((r) => r.json());
      const a = createAttempt(exam, "untimed");
      a.isSample = true;
      a.answers = { "q1-ア": "0" };
      submit(exam, a);
      a.gradingKind = "interim";
      new AttemptStore().save(a);
      return a.id;
    });
    await p.reload();
    await p
      .locator(`[data-attempt-id="${resumedId}"][data-section-id="q2b"]`)
      .waitFor();
    await p
      .locator(`[data-attempt-id="${resumedId}"][data-section-id="q2b"]`)
      .getByRole("button", { name: "再開", exact: true })
      .click();
    await p
      .frameLocator("#book-frame")
      .locator('[data-field="q2b-コ"]')
      .first()
      .waitFor();
    assert.equal(
      await p.locator(".book-nav button[aria-current]").count(),
      5,
      "a sliced row resumes its original complete exam",
    );
    await p.getByRole("button", { name: "採点する", exact: true }).click();
    await p.getByRole("heading", { name: "採点結果", exact: true }).waitFor();
    assert.equal(await p.locator("#section-results tr").count(), 5);
    assert.match(
      await p.locator(".summary-table tfoot").textContent(),
      /2 \/ 100点/,
    );
    assert.equal(writes.length, 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: all/full/section projection, section scores and immutable scoped review/results, header sorts and combined value/range filters, per-tab/reload/return persistence, blank selection/reset, invalid ranges, mobile popup/overflow, deletion scope and resume, zero statistics writes",
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
