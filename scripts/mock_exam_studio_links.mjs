// Use Studio's maintained share format and parser; no second interpreter/API.
import { encodeShare } from "../program-trace/studio/sharing.js";
import { validateDraft } from "../program-trace/studio/documents.js";
import { compile } from "../program-trace/studio/runtime.js";
let input = "";
for await (const chunk of process.stdin) input += chunk;
const result = [];
for (const item of JSON.parse(input)) {
  const draft = validateDraft(item);
  compile(draft.source);
  const url = new URL(
    await encodeShare(draft, "https://mei-chan-nel.com/program-trace/studio/"),
  );
  result.push(url.pathname + url.hash);
}
process.stdout.write(JSON.stringify(result));
