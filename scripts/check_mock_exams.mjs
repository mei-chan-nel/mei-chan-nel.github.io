// No network or DB writes. Checks current AND retained old editions by default.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  mockRoot,
  readJSON,
  catalogVersions,
  checkManifest,
} from "./mock_exam_catalog.mjs";

export function checkAssets(manifest, skipPDF = false) {
  const result = spawnSync(
    process.env.PYTHON || "python3",
    [
      fileURLToPath(new URL("validate_mock_exam_assets.py", import.meta.url)),
      path.join(mockRoot, manifest),
      ...(skipPDF ? ["--skip-pdf"] : []),
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) throw Error(`Asset validation failed: ${manifest}`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const args = process.argv.slice(2),
      skipPDF = args.includes("--skip-pdf");
    const paths = args.filter((a) => a !== "--skip-pdf");
    const entries = paths.length
      ? paths.map((manifest) => ({ manifest }))
      : catalogVersions(readJSON(path.join(mockRoot, "catalog.json")));
    for (const entry of entries) {
      const exam = checkManifest(entry.manifest);
      if (entry.id && (entry.id !== exam.id || entry.version !== exam.version))
        throw Error("Catalog identity mismatch");
      checkAssets(entry.manifest, skipPDF);
      console.log(
        `PASS No.${exam.id} v${exam.version}: ${exam.fields.length} fields, ${exam.scoring.length} units, reviewed answers/points/questions/RPC format`,
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
