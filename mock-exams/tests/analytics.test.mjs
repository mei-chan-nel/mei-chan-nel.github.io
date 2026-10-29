import test from "node:test";
import assert from "node:assert/strict";
import { trackExamAction } from "../analytics.mjs";

test("activity events contain only approved categories and tolerate blocked analytics", () => {
  const saved = Object.fromEntries(
    ["location", "document", "gtag"].map((k) => [
      k,
      Object.getOwnPropertyDescriptor(globalThis, k),
    ]),
  );
  const events = [];
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: new URL("https://mei-chan-nel.com/mock-exams/?private=x#uuid"),
  });
  globalThis.document = {
    referrer: "https://mei-chan-nel.com/mock-exams/?private=y#uuid",
  };
  globalThis.gtag = (...args) => events.push(args);
  try {
    for (const mode of ["timed", "untimed", "section"]) {
      const attempt = {
        mode,
        sectionIds: ["q2a"],
        id: "secret-attempt-id",
        answers: { a: "3" },
        result: { points: 99 },
      };
      trackExamAction("start", { id: "001", version: 2 }, attempt);
      trackExamAction("grade", { id: "001", version: 2 }, attempt, "interim");
      trackExamAction("pause", { id: "001", version: 2 }, attempt, "graded");
      assert.equal(events.at(-1)[2].exam_mode, mode);
      assert.equal(
        events.at(-1)[2].section_id,
        mode === "section" ? "q2a" : "all",
      );
    }
    assert.equal(events.length, 9);
    assert.doesNotMatch(
      JSON.stringify(events),
      /secret-attempt-id|answers|points|private|uuid/,
    );
    trackExamAction(
      "start",
      { id: "001", version: 2 },
      { mode: "timed", isSample: true },
    );
    assert.equal(events.length, 9);
    globalThis.gtag = () => {
      throw Error("blocked");
    };
    assert.doesNotThrow(() =>
      trackExamAction("start", { id: "001", version: 2 }, { mode: "timed" }),
    );
  } finally {
    for (const [key, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
