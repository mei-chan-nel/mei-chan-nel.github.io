// ESBUILD_MODULE=/path/to/esbuild node scripts/build_mock_exam_windows_qa.cjs [output-dir]
// esbuild is needed only for creating the package; Windows users need no Node/Python.
const fs = require("node:fs"),
  path = require("node:path");
const esbuild = require(process.env.ESBUILD_MODULE || "esbuild");
const root = path.resolve(__dirname, ".."),
  source = path.join(root, "tools/mock-exams-windows");
const output = path.resolve(
  process.argv[2] || path.join(root, "../output/StudyAtlas-RPC-Test-Windows"),
);
const bundle = esbuild
  .buildSync({
    entryPoints: [path.join(root, "mock-exams/connection-check.mjs")],
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    target: "es2022",
    charset: "utf8",
  })
  .outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
fs.mkdirSync(output, { recursive: true });
const template = fs.readFileSync(path.join(source, "index.html.in"), "utf8");
if (!template.includes("/* BUNDLED_SCRIPT */"))
  throw Error("Missing script insertion point");
fs.writeFileSync(
  path.join(output, "index.html"),
  template.replace("/* BUNDLED_SCRIPT */", () => bundle),
);
for (const name of ["start.cmd", "Start-LocalTest.ps1"]) {
  const text = fs
    .readFileSync(path.join(source, name), "utf8")
    .replace(/\r?\n/g, "\r\n");
  fs.writeFileSync(path.join(output, name), text);
}
fs.writeFileSync(
  path.join(output, "README.txt"),
  "\ufeff" +
    fs
      .readFileSync(
        path.join(root, "docs/mock-exams/WINDOWS-LOCAL-TEST.md"),
        "utf8",
      )
      .replace(/\r?\n/g, "\r\n"),
);
fs.copyFileSync(
  path.join(root, "docs/mock-exams/network-diagnosis.json"),
  path.join(output, "network-diagnosis.json"),
);
console.log("Created Windows test package:", output);
