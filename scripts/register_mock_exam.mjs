// Run only after authoring/QA: node scripts/register_mock_exam.mjs exams/002/1/exam.json
import path from "node:path";
import { buildEntry } from "./build_mock_exam_entry.mjs";
import { writeFileSync, renameSync, rmSync } from "node:fs";
import {
  mockRoot,
  readJSON,
  catalogVersions,
  checkManifest,
  registerEntry,
} from "./mock_exam_catalog.mjs";
import { checkAssets } from "./check_mock_exams.mjs";

const file = path.join(mockRoot, "catalog.json"),
  temp = file + ".tmp";
try {
  const [manifest, ...extra] = process.argv.slice(2);
  if (!manifest || extra.length)
    throw Error(
      "Usage: node scripts/register_mock_exam.mjs exams/002/1/exam.json",
    );
  const before = readJSON(file),
    exam = checkManifest(manifest);
  checkAssets(manifest);
  const after = registerEntry(before, {
    id: exam.id,
    version: exam.version,
    title: exam.title,
    manifest,
  });
  for (const item of catalogVersions(after)) {
    const saved = readJSON(path.join(mockRoot, item.manifest));
    if (saved.id !== item.id || saved.version !== item.version)
      throw Error("Retained manifest identity mismatch");
  }
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    writeFileSync(temp, JSON.stringify(after, null, 2) + "\n");
    renameSync(temp, file);
  }
  buildEntry();
  console.log(
    `Registered No.${exam.id} v${exam.version}; other exams and old editions retained.`,
  );
} catch (error) {
  rmSync(temp, { force: true });
  console.error(error.message);
  process.exitCode = 1;
}
