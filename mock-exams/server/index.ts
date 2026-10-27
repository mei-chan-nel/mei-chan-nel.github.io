// Build scripts/build_mock_exam_server.cjs for a single dashboard-ready file.
import { createHandler } from "./handler.mjs";
import exam001 from "../exams/001/1.0.0/exam.json" with { type: "json" };
Deno.serve(
  createHandler({
    exams: new Map([["001@1.0.0", exam001]]),
    env: (name: string) => Deno.env.get(name) || "",
  }),
);
