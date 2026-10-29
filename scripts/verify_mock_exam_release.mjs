// Checks the deployed static files. --rpc-write explicitly enables the existing
// connection-check scenario, which writes only a fresh qa_mock_<UUID> exam ID.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { fetchStats } from "../mock-exams/engine/stats.mjs";
import { runRpcVerification } from "../mock-exams/tests/rpc-scenario.mjs";

const root = new URL("../", import.meta.url);
const origin = "https://mei-chan-nel.com/";
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
const waitSeconds = Number(option("--wait-seconds", "0"));
if (!Number.isFinite(waitSeconds) || waitSeconds < 0 || waitSeconds > 900)
  throw Error("--wait-seconds must be between 0 and 900");
const reportPath = option("--report", null);
const report = {
  at: new Date().toISOString(),
  origin,
  revision: process.env.GITHUB_SHA || null,
  passed: false,
  files: [],
};
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJSON = async (path) =>
  JSON.parse(await readFile(new URL(path, root)));

try {
  const catalog = await readJSON("mock-exams/catalog.json");
  const paths = new Set([
    "index.html",
    "about.html",
    "study-guide.html",
    "privacy.html",
    "sitemap.html",
    "sitemap.xml",
    "mock-exams/index.html",
    "mock-exams/app.mjs",
    "mock-exams/app.css",
    "mock-exams/booklet.css",
    "mock-exams/catalog.json",
    "mock-exams/engine/stats.mjs",
  ]);
  for (const entry of catalog) {
    const manifest = "mock-exams/" + entry.manifest;
    paths.add(manifest);
    const directory = manifest.slice(0, manifest.lastIndexOf("/") + 1);
    const exam = await readJSON(manifest);
    for (const section of exam.sections) {
      paths.add(directory + (section.screenProblem || section.problem));
      paths.add(directory + (section.screenSolution || section.solution));
    }
    paths.add(directory + "problem.pdf");
    paths.add(directory + "solution.pdf");
  }
  const expected = await Promise.all(
    [...paths].map(async (path) => ({
      path,
      sha256: digest(await readFile(new URL(path, root))),
    })),
  );
  const deadline = Date.now() + waitSeconds * 1000;
  for (;;) {
    try {
      const verified = [];
      for (const file of expected) {
        const url = new URL(file.path, origin);
        url.searchParams.set("release", report.revision || report.at);
        const response = await fetch(url, {
          cache: "no-store",
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) throw Error(`${file.path}: HTTP ${response.status}`);
        if (digest(Buffer.from(await response.arrayBuffer())) !== file.sha256)
          throw Error(`${file.path}: deployed content has not caught up`);
        verified.push(file);
      }
      report.files = verified;
      console.log(
        `PASS production: ${verified.length} published files match this release, including PDFs`,
      );
      break;
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      console.log(`Waiting for GitHub Pages: ${error.message}`);
      await delay(Math.min(15000, deadline - Date.now()));
    }
  }
  // Read current real statistics without changing them.
  report.statistics = [];
  for (const entry of catalog) {
    const exam = await readJSON("mock-exams/" + entry.manifest);
    const rows = await fetchStats(exam);
    report.statistics.push({
      examId: exam.id,
      version: exam.version,
      rows: rows.length,
    });
  }
  console.log("PASS production RPC reads using the existing publishable key");
  if (args.includes("--rpc-write")) {
    report.rpc = await runRpcVerification({ log: console.log });
    if (!report.rpc.passed)
      throw Error(report.rpc.error || "RPC scenario failed");
  }
  report.passed = true;
} catch (error) {
  report.error = error.message;
  console.error("FAIL release verification: " + error.message);
  process.exitCode = 1;
} finally {
  if (reportPath)
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
}
