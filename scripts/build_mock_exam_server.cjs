// ESBUILD_MODULE=/path/to/esbuild node scripts/build_mock_exam_server.cjs
const path = require("node:path"),
  fs = require("node:fs");
const esbuild = require(process.env.ESBUILD_MODULE || "esbuild");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "mock-exams/server/deploy/index.ts");
fs.mkdirSync(path.dirname(output), { recursive: true });
esbuild.buildSync({
  entryPoints: [path.join(root, "mock-exams/server/index.ts")],
  outfile: output,
  bundle: true,
  platform: "neutral",
  format: "esm",
  target: "es2022",
  charset: "utf8",
  legalComments: "none",
  banner: {
    js: "// GENERATED: paste this entire file into Supabase Edge Functions > mock-exam-submit > index.ts.\n// Contains only public exam data and code; set secrets in the Supabase dashboard.",
  },
});
console.log(path.relative(root, output));
