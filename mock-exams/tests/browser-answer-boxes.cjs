// Check actual source-specific CSS in every edition; no stats/network writes.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const server = http.createServer((req, res) => {
  const f = path.resolve(root, "." + decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(root + path.sep)) return res.writeHead(403).end();
  try {
    res.setHeader(
      "Content-Type",
      f.endsWith(".css") ? "text/css" : "text/html; charset=utf-8",
    );
    res.end(fs.readFileSync(f));
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
  let occurrences = 0;
  try {
    const page = await browser.newPage();
    for (const id of fs.readdirSync(path.join(root, "exams")))
      for (const version of fs.readdirSync(path.join(root, "exams", id))) {
        const base = path.join("exams", id, version),
          file = path.join(root, base, "exam.json");
        if (!fs.existsSync(file)) continue;
        const exam = JSON.parse(fs.readFileSync(file));
        for (const mode of ["desktop", "mobile", "print"]) {
          await page.setViewportSize({
            width: mode === "mobile" ? 390 : 1333,
            height: 900,
          });
          await page.emulateMedia({
            media: mode === "print" ? "print" : "screen",
          });
          for (const s of exam.sections) {
            const doc = mode === "print" ? s.problem : s.screenProblem;
            await page.goto(
              `http://127.0.0.1:${server.address().port}/${base}/${doc}`,
            );
            await page.evaluate(() => document.fonts.ready);
            const result = await page.evaluate((fields) => {
              const metrics = [];
              for (const e of document.querySelectorAll("[data-field]")) {
                const f = fields.find((f) => f.id === e.dataset.field);
                if (e.dataset.inputType !== f.type)
                  throw Error("Missing input type " + f.id);
                if (f.type !== "text") continue;
                const c = getComputedStyle(e),
                  font = parseFloat(c.fontSize);
                metrics.push({
                  id: f.id,
                  width: e.getBoundingClientRect().width / font,
                  min: parseFloat(c.minWidth) / font,
                  pad: parseFloat(c.paddingLeft) / font,
                });
                e.textContent =
                  f.label + " " + (f.allowed.includes("F") ? "F" : "8");
                e.dataset.filled = "true";
                metrics.at(-1).clipped = e.scrollWidth > e.clientWidth + 1;
              }
              return metrics;
            }, exam.fields);
            for (const m of result) {
              assert.ok(
                m.width <= 1.9,
                JSON.stringify({ id, version, mode, ...m }),
              );
              assert.ok(m.min <= 1.41);
              assert.ok(m.pad <= 0.15);
              assert.equal(m.clipped, false);
            }
            occurrences += result.length;
          }
        }
      }
    console.log(
      `PASS: ${occurrences} direct-answer boxes across all editions in desktop/mobile/print; narrow empty boxes and unclipped filled labels/values`,
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
