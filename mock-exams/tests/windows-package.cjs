// POWERSHELL_PATH=/path/to/pwsh PLAYWRIGHT_MODULE=/path/to/playwright node ... [package-dir]
// Runs the packaged PowerShell server. Supabase traffic is simulated here.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const http = require("node:http"),
  path = require("node:path"),
  fs = require("node:fs"),
  assert = require("node:assert/strict"),
  { spawn } = require("node:child_process");
const fixture = require("./rpc-browser-fixture.cjs");
const folder = path.resolve(
  process.argv[2] ||
    path.join(__dirname, "../../../output/StudyAtlas-RPC-Test-Windows"),
);
async function freePort() {
  const s = http.createServer();
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const port = s.address().port;
  await new Promise((r) => s.close(r));
  return port;
}
(async () => {
  const port = await freePort(),
    origin = "http://127.0.0.1:" + port;
  const child = spawn(
    process.env.POWERSHELL_PATH || "pwsh",
    [
      "-NoLogo",
      "-NoProfile",
      "-File",
      path.join(folder, "Start-LocalTest.ps1"),
      "-Port",
      String(port),
      "-NoBrowser",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  child.stdout.on("data", (x) => (output += x));
  child.stderr.on("data", (x) => (output += x));
  let browser;
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(Error("PowerShell startup timeout: " + output)),
        15000,
      );
      child.on("error", reject);
      child.on("exit", (code) => {
        clearTimeout(timeout);
        reject(Error("PowerShell exited " + code + ": " + output));
      });
      child.stdout.on("data", () => {
        if (output.includes("Study Atlas RPC test:")) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
    const response = await fetch(origin),
      html = await response.text();
    assert.equal(response.status, 200);
    assert.ok(html.includes("WindowsローカルRPC検証"));
    assert.ok(html.includes("record_mock_exam_results"));
    const head = await fetch(origin, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    assert.equal(
      Number(head.headers.get("content-length")),
      Buffer.byteLength(html),
    );
    assert.equal((await fetch(origin + "/index.html?v=1")).status, 200);
    assert.equal((await fetch(origin + "/Start-LocalTest.ps1")).status, 404);
    assert.equal((await fetch(origin, { method: "POST" })).status, 405);
    console.log(
      "PASS: packaged PowerShell server serves GET/HEAD over loopback; query string; 404/405",
    );
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      headless: true,
      args: ["--no-sandbox"],
    });
    const context = await browser.newContext({ acceptDownloads: true }),
      p = await context.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    const { submissions } = await fixture(context);
    await p.goto(origin);
    await p.getByRole("button", { name: "実際の送受信を検証する" }).click();
    await p.getByText("送受信検証に成功しました。", { exact: true }).waitFor();
    assert.equal(submissions.length, 4);
    assert.deepEqual(
      submissions.map((b) => b.p_results.length),
      [2, 1, 3, 1],
    );
    assert.ok(submissions.every((b) => b.p_exam_id.startsWith("qa_mock_")));
    const rows = p.locator("#final-stats tr");
    assert.deepEqual(await rows.nth(1).locator("td").allTextContents(), [
      "single",
      "2",
      "1",
      "2",
    ]);
    assert.deepEqual(await rows.nth(2).locator("td").allTextContents(), [
      "pair",
      "2",
      "1",
      "3",
    ]);
    assert.deepEqual(await rows.nth(3).locator("td").allTextContents(), [
      "partial",
      "3",
      "1",
      "7",
    ]);
    assert.match(
      await p.locator("#final-stats").textContent(),
      /4\.83.*53\.70/,
    );
    const [download] = await Promise.all([
      p.waitForEvent("download"),
      p.getByRole("button", { name: "検証結果を保存する" }).click(),
    ]);
    const report = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
    assert.equal(report.passed, true);
    assert.ok(report.requests.every((x) => x.status === 200));
    assert.deepEqual(
      report.requests
        .filter((x) => x.rpc === "record_mock_exam_results")
        .map((x) => x.updatedCount),
      [2, 1, 3, 1],
    );
    assert.ok(Math.abs(report.finalStatistics.total.points - 29 / 6) < 1e-10);
    assert.ok(!JSON.stringify(report).includes("sb_publishable_"));
    assert.deepEqual(errors, []);
    console.log(
      "PASS: packaged page, expected aggregates, average 4.83/9 & 53.70%, downloaded HTTP trace, no key in report (simulated RPCs)",
    );
    for (const mode of ["http403", "unreadable"]) {
      const c = await browser.newContext({ acceptDownloads: true }),
        page = await c.newPage();
      await c.route("https://*.supabase.co/**", (r) =>
        mode === "http403"
          ? r.fulfill({
              status: 403,
              json: {
                code: "42501",
                message: "permission denied for function get_mock_exam_stats",
              },
            })
          : r.abort("failed"),
      );
      await page.goto(origin);
      await page
        .getByRole("button", { name: "実際の送受信を検証する" })
        .click();
      await page
        .getByText("送受信検証は未完了です。結果を確認してください。", {
          exact: true,
        })
        .waitFor();
      const [d] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: "検証結果を保存する" }).click(),
      ]);
      const result = JSON.parse(fs.readFileSync(await d.path(), "utf8"));
      assert.equal(result.passed, false);
      assert.equal(result.requests[0].status, mode === "http403" ? 403 : null);
      if (mode === "http403") assert.equal(result.requests[0].code, "42501");
      else assert.ok(result.requests[0].error);
      await c.close();
    }
    console.log(
      "PASS: browser-visible RPC HTTP 403 is distinguished from unreadable network responses",
    );
  } finally {
    if (browser) await browser.close();
    child.kill("SIGTERM");
    await new Promise((r) =>
      child.exitCode !== null ? r() : child.once("exit", r),
    );
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
