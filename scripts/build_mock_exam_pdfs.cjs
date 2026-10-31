/* Usage: PLAYWRIGHT_MODULE=/path/to/playwright node scripts/build_mock_exam_pdfs.cjs [solution|problem] [--manifest exams/002/1/exam.json]
   Requires Chromium, Python with PyMuPDF. No network access or secrets. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process");
const http = require("node:http");
const root = path.resolve(__dirname, "../mock-exams");
let selectedManifest, selectedKind;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--manifest") selectedManifest = args[++i];
  else if (!selectedKind) selectedKind = args[i];
  else
    throw Error("Usage: [solution|problem] [--manifest exams/002/1/exam.json]");
}
if (
  args.includes("--manifest") &&
  !/^exams\/[0-9]{3}\/[1-9][0-9]*\/exam\.json$/.test(selectedManifest || "")
)
  throw Error("Invalid manifest path");
const kinds = selectedKind ? [selectedKind] : ["problem", "solution"];
if (kinds.some((k) => !["problem", "solution"].includes(k)))
  throw Error("Invalid PDF kind");
const server = http.createServer((req, res) => {
  const file = path.resolve(
    root,
    "." + decodeURIComponent(req.url.split("?")[0]),
  );
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    res.setHeader(
      "Content-Type",
      file.endsWith(".css") ? "text/css" : "text/html; charset=utf-8",
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
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const entries = selectedManifest
      ? [{ manifest: selectedManifest }]
      : JSON.parse(fs.readFileSync(path.join(root, "catalog.json")));
    for (const entry of entries) {
      const dir = path.dirname(path.join(root, entry.manifest)),
        exam = JSON.parse(fs.readFileSync(path.join(root, entry.manifest)));
      const temp = fs.mkdtempSync("/tmp/atlas-mock-pdf-");
      for (const kind of kinds) {
        const files = [];
        for (const s of exam.sections) {
          const page = await browser.newPage({
            viewport: { width: 794, height: 1123 },
          });
          await page.goto(
            origin + "/" + path.relative(root, path.join(dir, s[kind])),
          );
          await page.emulateMedia({ media: "print" });
          await page.evaluate(() => document.fonts.ready);
          // Running source/version labels are editorial metadata, not booklet content.
          await page.addStyleTag({
            content:
              ".pagehead,.page-head,.running-head,.running-header,.sheet-header,.pagenum,.page-number,.page-foot,.page-footer,.footer{display:none!important}",
          });
          if (kind === "problem" && s.id === "q1") {
            // PDF-only subject heading, following the common-test booklet.
            // Keep the answering/reading HTML and the exam content unchanged.
            await page.evaluate(() => {
              const sheet = document.querySelector(".sheet,.page");
              if (!sheet) throw Error("Missing first problem page");
              const heading = document.createElement("div");
              heading.style.cssText =
                'text-align:center;padding-top:4mm;margin:0 0 12mm;font-family:"Noto Serif CJK JP",serif;color:#000';
              const title = document.createElement("div");
              title.style.cssText =
                "display:flex;justify-content:center;gap:16mm;font-size:25pt;font-weight:700;line-height:1.4";
              for (const char of "情報Ⅰ") {
                const span = document.createElement("span");
                span.textContent = char;
                title.append(span);
              }
              const note = document.createElement("div");
              note.textContent = "（全問必答）";
              note.style.cssText =
                "margin-top:3mm;font-size:12pt;font-weight:700;line-height:1.6;letter-spacing:.55em;text-indent:.55em";
              heading.append(title, note);
              const question = sheet.querySelector("h1,h2");
              const match = question?.textContent.match(/^(第1問)[\s　]+(.+)$/);
              if (match) {
                const number = document.createElement("span");
                number.textContent = match[1];
                number.style.cssText = "font-size:14pt;font-weight:700";
                question.style.cssText =
                  "font-size:10.5pt;font-weight:400;line-height:1.75;margin:0 0 24px";
                question.replaceChildren(
                  number,
                  document.createTextNode("　" + match[2]),
                );
              }
              sheet.prepend(heading);
            });
          }
          if (
            kind === "problem" &&
            exam.id === "001" &&
            exam.version === 2 &&
            s.id === "q2a"
          ) {
            await page.evaluate(() => {
              const part = document.querySelector("h1");
              const heading = document.createElement("h2");
              heading.className = "exam-section-heading";
              heading.innerHTML =
                '<span class="exam-section-number">第2問</span>　次の問い（A・B）に答えよ。（配点30）';
              heading.style.cssText =
                "font-size:12pt;font-weight:700;margin:0 0 24px;text-indent:0";
              part.before(heading);
              part.textContent = "A　次の問い（問1～4）に答えよ。（配点15）";
              part.className = "exam-part-heading";
              part.style.cssText =
                "font-size:10.5pt;font-weight:400;margin:0 0 16px";
            });
          }
          // PDF only: emphasize just the "問n" label, not the question text.
          if (kind === "problem") {
            const boldLabels = await page.evaluate(() => {
              const selector = {
                q1: ".sheet p",
                q2a: ".question-number",
                q2b: "p.question > b:first-child",
                q3: ".qtitle > b:first-child",
                q4: "p.exam-question",
              }[document.body.dataset.section];
              if (!selector) return 0;
              let changed = 0;
              for (const element of document.querySelectorAll(selector)) {
                const first = element.firstChild;
                if (!first || first.nodeType !== Node.TEXT_NODE) continue;
                const match = first.textContent.match(/^(問[0-9]+)(?=[\\s　]|$)/);
                if (!match) continue;
                const bold = document.createElement("strong");
                bold.textContent = match[1];
                bold.style.setProperty("font-weight", "700", "important");
                element.insertBefore(bold, first);
                first.textContent = first.textContent.slice(match[1].length);
                changed++;
              }
              return changed;
            });
            const expected = { q1: 4, q2a: 6, q2b: 4, q3: 3, q4: 5 };
            if (boldLabels !== expected[s.id])
              throw Error("Question-number bolding failed: " + s.id + " (" + boldLabels + ")");
          }
          if (kind === "solution")
            await page.addStyleTag({
              content:
                "@page{size:A4;margin:16mm 18mm 18mm} .sheet,.page,body[data-section] .sheet,body[data-section] .page{width:174mm!important;height:auto!important;min-height:0!important;padding:0!important;margin:0!important;break-after:page}.sheet:last-child,.page:last-child{break-after:auto}.pagehead,.pagenum,.page-foot,.footer{display:none!important}.solution{padding:0!important;width:auto!important;max-width:none!important}.card{box-shadow:none!important}",
            });
          if (kind === "problem") {
            const fits = await page.evaluate(() =>
              Array.from(document.querySelectorAll(".sheet,.page")).map(
                (sheet) => {
                  const wrap = document.createElement("div");
                  wrap.className = "print-content";
                  while (sheet.firstChild) wrap.append(sheet.firstChild);
                  sheet.append(wrap);
                  const css = getComputedStyle(sheet),
                    available =
                      sheet.clientHeight -
                      parseFloat(css.paddingTop) -
                      parseFloat(css.paddingBottom);
                  let scale = 1;
                  for (let i = 0; i < 3; i++) {
                    const h = wrap.getBoundingClientRect().height;
                    if (h <= available + 1) break;
                    scale *= available / h;
                    wrap.style.zoom = scale;
                  }
                  return {
                    scale,
                    height: wrap.getBoundingClientRect().height,
                    available,
                  };
                },
              ),
            );
            console.log(s.id, JSON.stringify(fits));
            if (fits.some((x) => x.scale < 0.8 || x.height > x.available + 2))
              throw Error("Print overflow: " + s.id);
          }
          const file = path.join(temp, kind + "-" + s.id + ".pdf");
          await page.pdf({
            path: file,
            format: "A4",
            preferCSSPageSize: true,
            printBackground: true,
          });
          files.push(file);
          await page.close();
        }
        const args = [
          path.join(__dirname, "merge_mock_exam_pdfs.py"),
          path.join(dir, kind + ".pdf"),
          exam.id,
          ...files,
        ];
        const result = spawnSync("python", args, { encoding: "utf8" });
        if (result.status !== 0) throw Error(result.stderr);
        console.log(result.stdout.trim());
      }
      fs.rmSync(temp, { recursive: true });
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
