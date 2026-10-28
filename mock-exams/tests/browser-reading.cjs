// Local browser QA of the distributed Sites bundle. All RPCs are mocked.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(
  __dirname,
  "../../../sites/study-atlas-mock-exams-preview/dist",
);
const output = path.resolve(__dirname, "../../../work/mock-exam-reading");
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
        ".js": "text/javascript",
        ".mjs": "text/javascript",
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
    viewport: { width: 1333, height: 900 },
  });
  const p = await context.newPage(),
    errors = [],
    writes = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await context.route("https://*.supabase.co/**", (r) => {
    const body = r.request().postDataJSON();
    if (body.p_results) writes.push(body);
    return r.fulfill({ json: { items: [] } });
  });
  const url = "http://127.0.0.1:" + server.address().port;
  const sample = "00000000-0000-4000-8000-000000000103";
  const exam = JSON.parse(
    fs.readFileSync(path.join(root, "mock-exams/exams/001/1/exam.json")),
  );
  const frame = () => p.frameLocator("#book-frame");
  const read = () =>
    p.evaluate(
      (id) => localStorage["study-atlas:mock-exams:v1:attempt:" + id],
      sample,
    );
  const currentPair = (id) =>
    p.waitForFunction((id) => {
      const d = document.querySelector("#book-frame")?.contentDocument;
      return (
        d?.documentElement?.hasAttribute("data-paired-reading") &&
        d.querySelector('[data-reading-units^="' + id + '-"]')
      );
    }, id);
  async function verifyPair(section) {
    await currentPair(section);
    await p.waitForFunction(() => {
      const frames = [
        document.querySelector("#paired-problem"),
        document.querySelector("#book-frame"),
      ];
      const ds = frames.map((f) => f.contentDocument);
      return [...ds[0].querySelectorAll("[data-reading-units]")].every((e) => {
        const other = ds[1].querySelector(
          '[data-reading-units="' + e.dataset.readingUnits + '"]',
        );
        return (
          other &&
          Math.abs(
            frames[0].getBoundingClientRect().top +
              e.getBoundingClientRect().top -
              frames[1].getBoundingClientRect().top -
              other.getBoundingClientRect().top,
          ) < 1
        );
      });
    });
    const metrics = await p.evaluate(() => {
      const fs = [
        document.querySelector("#paired-problem"),
        document.querySelector("#book-frame"),
      ];
      return fs.map((f) => {
        const d = f.contentDocument;
        return {
          ids: [...d.querySelectorAll("[data-reading-units]")].flatMap((e) =>
            e.dataset.readingUnits.split(" "),
          ),
          overflow: d.documentElement.scrollWidth - f.clientWidth,
          summary: [...d.querySelectorAll("h1,h2")].some((h) =>
            /^(正答と配点|正答・配点|第1問 正答・配点|正答・詳細解説・配点)$/.test(
              h.textContent.trim(),
            ),
          ),
          spacerHeight: [...d.querySelectorAll(".reading-spacer")].reduce(
            (n, e) => n + e.offsetHeight,
            0,
          ),
        };
      });
    });
    const expected = exam.scoring
      .filter((u) => u.sectionId === section)
      .map((u) => u.id);
    metrics.forEach((m) => {
      assert.deepEqual(m.ids, expected);
      assert.equal(m.summary, false);
      assert.ok(m.overflow < 2);
    });
    assert.ok(metrics.some((m) => m.spacerHeight > 0));
    return metrics[0].ids.length;
  }
  try {
    await p.goto(url + "/");
    const cards = await p.locator(".home-action-card h3").allTextContents();
    assert.equal(
      cards[cards.indexOf("しくみを体験する") + 1],
      "実戦模試に挑戦する",
    );
    assert.ok(
      (await p.locator(".hero-lead").textContent()).includes(
        "すべての教材を無料",
      ),
    );
    assert.equal(await p.locator(".global-nav a").count(), 8);
    assert.equal(await p.locator(".site-footer nav a").count(), 13);
    const navLinks = await p
      .locator(".global-nav a")
      .evaluateAll((as) =>
        as.map((a) => ({ text: a.textContent, href: a.href })),
      );
    assert.equal(new Set(navLinks.map((a) => a.text)).size, 8);
    assert.ok(
      navLinks
        .filter((a) => a.text !== "トップページ")
        .every((a) => a.href.startsWith("https://mei-chan-nel.com/")),
    );
    await p.screenshot({
      path: path.join(output, "latest-home-desktop.png"),
      fullPage: true,
    });
    await p.getByRole("link", { name: /実戦模試に挑戦する/ }).click();
    assert.ok(p.url().endsWith("/mock-exams/"));
    await p.getByRole("button", { name: "学習履歴", exact: true }).click();
    await p.locator('[data-attempt-id="' + sample + '"]').waitFor();
    assert.ok(
      (await p.locator(".history-table").textContent()).includes(
        "回ごと・時間制限なし",
      ),
    );
    const centering = await p
      .locator(".history-table thead button")
      .evaluateAll((bs) =>
        bs.map((b) => {
          const box = b.getBoundingClientRect(),
            label = b.querySelector("span").getBoundingClientRect();
          return Math.abs(
            (box.left + box.right) / 2 - (label.left + label.right) / 2,
          );
        }),
      );
    assert.ok(centering.every((d) => d < 1));
    const original = await read();
    await p
      .locator('[data-attempt-id="' + sample + '"]')
      .getByRole("button", { name: "採点結果", exact: true })
      .click();
    await p.getByRole("button", { name: "解説を読む", exact: true }).click();
    assert.equal(
      await p.locator(".reading-layout .sidebar, #run-actions").count(),
      0,
    );
    assert.equal(await p.locator("#section-navigation button").count(), 5);
    assert.deepEqual(
      await p.locator("#section-navigation button").allTextContents(),
      exam.sections.map((s) => s.title),
    );
    assert.equal(
      await p
        .locator(".reading-toolbar")
        .evaluate((e) => getComputedStyle(e).position),
      "static",
    );
    let coverage = 0;
    for (const s of exam.sections) {
      await p
        .locator("#section-navigation")
        .getByRole("button", { name: s.title, exact: true })
        .click();
      coverage += await verifyPair(s.id);
      if (s.id === "q3") {
        // A longer explanation moves the next question down, symmetrically.
        await p.evaluate(() => {
          const d = document.querySelector("#book-frame").contentDocument;
          const block = d.createElement("div");
          block.style.height = "400px";
          d.querySelector('[data-reading-units="q3-05"]').before(block);
        });
        await verifyPair(s.id);
        await p.setViewportSize({ width: 1050, height: 804 });
        await verifyPair(s.id);
        await p.setViewportSize({ width: 1440, height: 900 });
        await verifyPair(s.id);
        await p.screenshot({
          path: path.join(output, "paired-program-desktop.png"),
        });
      }
    }
    assert.equal(coverage, 44);
    await p.reload();
    await verifyPair("q4");
    await p.evaluate(() => scrollTo(0, 650));
    assert.ok((await p.locator(".reading-toolbar").boundingBox()).y < 0);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForFunction(() => !document.querySelector("#paired-problem"));
    assert.equal(await p.locator("#section-navigation button").count(), 10);
    assert.equal(
      await p
        .locator(".reading-toolbar")
        .evaluate((e) => getComputedStyle(e).position),
      "static",
    );
    for (const s of exam.sections) {
      await p
        .locator("#section-navigation")
        .getByRole("button", { name: s.title + "解説", exact: true })
        .click();
      await frame()
        .locator('[data-reading-units^="' + s.id + '-"]')
        .first()
        .waitFor();
      assert.equal(await frame().locator(".reading-spacer").count(), 0);
      assert.equal(
        await frame()
          .locator("h2")
          .filter({ hasText: /^(正答と配点|正答・配点)$/ })
          .count(),
        0,
      );
      await p
        .locator("#section-navigation")
        .getByRole("button", { name: s.title + "問題", exact: true })
        .click();
      await frame()
        .locator('[data-reading-units^="' + s.id + '-"]')
        .first()
        .waitFor();
      assert.ok(await frame().locator("[data-field]").count());
    }
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await p.screenshot({ path: path.join(output, "reading-mobile.png") });
    await p.locator("#back-list").click();
    await p.getByRole("heading", { name: "採点結果", exact: true }).waitFor();
    await p
      .getByRole("button", { name: "学習履歴に戻る", exact: true })
      .click();
    assert.equal(await read(), original);
    assert.equal(writes.length, 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: latest home and card, centered headers, 44-unit coverage, paired alignment/resizing, nonsticky navigation, mobile switches, summary removal, return paths, unchanged history, no record RPC",
    );
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
