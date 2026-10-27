const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http");
const fixture = require("./rpc-browser-fixture.cjs"),
  root = path.resolve(__dirname, "../..");
const server = http.createServer((req, res) => {
  const p = path.resolve(root, "." + req.url.split("?")[0]);
  if (!p.startsWith(root + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".mjs": "text/javascript",
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
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext(),
      p = await context.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    const { submissions } = await fixture(context);
    await p.goto(
      "http://127.0.0.1:" +
        server.address().port +
        "/mock-exams/connection-check.html",
    );
    await p.getByRole("button", { name: "実際の送受信を検証する" }).click();
    await p.getByText("送受信検証に成功しました。", { exact: true }).waitFor();
    assert.equal(submissions.length, 4);
    assert.ok(submissions.every((x) => x.p_exam_id.startsWith("qa_mock_")));
    assert.deepEqual(errors, []);
    assert.equal(await p.locator("#download-check").isDisabled(), false);
    console.log(
      "PASS: administrator direct-RPC verification page and downloadable report",
    );
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
