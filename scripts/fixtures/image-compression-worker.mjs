// Run the production browser Worker in Node, loading its same-origin WASM
// from disk. Remote fetches fail so these tests cannot depend on a codec CDN.
import { parentPort } from "node:worker_threads";
import { readFile } from "node:fs/promises";

globalThis.self = globalThis;
globalThis.location = {
  href: new URL("../../lab/image-compression/worker.mjs", import.meta.url).href,
};
globalThis.importScripts = () => {
  throw new Error("The module Worker must not import classic scripts");
};
globalThis.fetch = async (url) => {
  const local = new URL(url);
  if (local.protocol !== "file:") throw new Error("Remote codec request rejected");
  return new Response(await readFile(local), {
    headers: { "Content-Type": "application/wasm" },
  });
};
globalThis.postMessage = (message) => parentPort.postMessage(message);
await import("../../lab/image-compression/worker.mjs");
parentPort.on("message", (task) => self.onmessage({ data: task }));
parentPort.postMessage({ type: "ready" });
