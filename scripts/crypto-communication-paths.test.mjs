import assert from "node:assert/strict";
import test from "node:test";
import { createQuest } from "../lab/crypto-communication/quest.mjs";
test("every offered action and key can progress, demonstrate consequences, and retry safely", (t) => {
  const q = createQuest(),
    seen = new Set(),
    covered = new Set(),
    errors = [],
    endings = {},
    counters = {
      states: 0,
      edges: 0,
      keyEdges: 0,
      wrong: 0,
      retry: 0,
      consequences: 0,
      correct: 0,
      keyBack: 0,
    };
  const role = (k) =>
    k
      ? [k.type, k.owner, k.label?.replace(/\b[KC]\d+\b/g, "N")].join(":")
      : null;
  // Collapse equivalent protocol states across random object IDs and attempts.
  // Retry checks below retain the real IDs to detect unintended regeneration.
  const signature = (v) =>
    JSON.stringify({
      r: v.round,
      phase: v.phase,
      read: v.read,
      draft: v.draft,
      original: v.original,
      public: role(v.publicForAlice),
      incoming: role(v.incoming),
      outgoing: role(v.outgoing),
      keySignature: v.incomingSignature?.owner || v.outgoingSignature?.owner,
      incomingTag: Boolean(v.incomingTag),
      outgoingTag: Boolean(v.outgoingTag),
      attacker: !!v.attackerKey,
      impersonating: v.impersonating,
      pred: v.predictionAnswered,
      payload: role(v.payloadKey),
      stage: v.selectingKey && [v.selectingKey.action, v.selectingKey.stage],
      feedback: v.feedback && [
        v.feedback.correct,
        v.feedback.kind,
        v.feedback.inline,
      ],
      choices: v.choices.map((c) => c.id),
      consequence: v.consequence,
      result: v.result?.code,
    });
  const source = (v) => ({
    r: v.round + 1,
    phase: v.phase,
    stage: v.selectingKey?.stage,
    action: v.selectingKey?.action,
    feedback: v.feedback && [
      v.feedback.kind,
      v.feedback.correct,
      v.feedback.inline,
    ],
    choices: v.choices.map((c) => c.id),
  });
  const retryShape = (v) =>
    JSON.stringify({
      r: v.round,
      phase: v.phase,
      incoming: v.incoming.id,
      keySignature: v.incomingSignature?.id,
      incomingTag: v.incomingTag?.id,
      sessionId: v.incoming.sessionId,
      nonce: v.incoming.nonce,
      outgoing: v.outgoing?.id,
      public: v.publicForAlice?.id,
      attacker: v.attackerKey?.id,
      inventory: v.inventory.map((k) => k.id).sort(),
      read: v.read,
      original: v.original,
      draft: v.draft,
      pred: v.predictionAnswered,
      payload: v.payloadKey?.id,
      staged: v.stagedKey?.id,
      delivered: v.deliveredKey?.id,
      stage: v.selectingKey && [v.selectingKey.action, v.selectingKey.stage],
      consequence: v.consequence,
    });
  const failure = (e, path, v) =>
    errors.push({ error: e.message, path, at: source(v) });
  function run(id) {
    if (id === "key-back") {
      q.cancel();
      counters.keyBack++;
      return [];
    }
    assert(q.select(id), "select available " + id);
    return q.view().selectingKey ? [] : q.confirm();
  }
  function inspectFrames(frames, v, path) {
    assert(Array.isArray(frames));
    for (const f of frames) {
      assert.equal(typeof f.text, "string");
      if (!v.read)
        assert(
          !f.text.includes("I love you."),
          "original leaked into narration",
        );
    }
    if (v.phase === "done") {
      assert(v.result, "done has result");
      if (!v.feedback) {
        const expectedTone =
          v.consequence || !v.result.accepted
            ? "wrong"
            : v.result.code === "attack-success" || v.round === 3
              ? "correct"
              : "";
        assert.equal(
          v.tone,
          expectedTone,
          "terminal result color matches demonstrated outcome",
        );
      }
      if (v.round === 3 && v.result.accepted)
        assert.equal(
          v.deliveredSignature?.owner,
          "alice",
          "accepted channel retains Alice key-delivery signature",
        );
      if (v.round === 3 && v.result.accepted) {
        assert.equal(v.incoming.type, "ciphertext");
        assert.equal(v.incoming.authenticated, true);
        assert(
          v.deliveredTag,
          "Bob verifies an authentication tag before accepting the body",
        );
        assert.equal(
          v.signature,
          null,
          "AEAD body carries no digital signature",
        );
      }
      if (v.result.code === "key-signature-rejected") {
        assert.equal(
          v.bobHasKey,
          false,
          "rejected key signature prevents key adoption",
        );
        assert.equal(
          v.incoming.type,
          "envelope",
          "key rejection occurs before body generation",
        );
      }
      if (v.result.code === "tag-rejected") {
        assert.equal(
          v.deliveredSignature?.owner,
          "alice",
          "tamper demo keeps authenticated Alice key",
        );
        assert.equal(
          v.attackerKey,
          null,
          "body tamper does not regenerate the key",
        );
        assert(
          v.deliveredTag,
          "bad body is rejected against its retained authentication tag",
        );
      }
      if (v.result.code === "attack-success") {
        assert.equal(
          v.read,
          v.round < 2,
          "only R1/R2 attacks read Alice original",
        );
        if (v.round === 2)
          assert(
            v.attackerKey && v.impersonating,
            "R3 forgery replaces both envelope components",
          );
      }
    }
    if (!v.read) {
      assert.equal(v.original, null);
      assert(
        !JSON.stringify(v).includes("I love you."),
        "original plaintext hidden",
      );
    }
    if (v.feedback && !v.feedback.correct)
      assert(
        v.choices.some((c) => c.id === "retry-here") &&
          v.choices.some((c) => c.id === "show-consequence"),
        "wrong feedback has retry + consequence",
      );
    if (v.feedback?.correct && !v.feedback.inline)
      assert.deepEqual(
        v.choices.map((c) => c.id),
        ["continue"],
        "correct feedback proceeds",
      );
  }
  function visit(path = [], depth = 0) {
    const v = q.view(),
      s = signature(v);
    if (seen.has(s)) return;
    seen.add(s);
    counters.states++;
    if (depth > 65) throw new Error("Depth exceeded");
    assert.notEqual(
      v.selectingKey?.stage,
      "payload",
      "no repeated payload choice",
    );
    assert(v.choices.length || v.selectingKey?.keys.length, "no dead end");
    if (v.phase === "done" && !v.feedback) {
      if (v.consequence) {
        const resume = q.checkpoint();
        assert(q.select("retry-here"));
        q.confirm();
        assert.equal(q.view().consequence, false, "terminal retry clears demo");
        assert(!q.view().feedback);
        assert.notEqual(
          q.view().phase,
          "done",
          "terminal retry restores question",
        );
        counters.retry++;
        resume();
      }
      endings[v.result.code] = (endings[v.result.code] || 0) + 1;
      return;
    }
    const root = q.checkpoint();
    const options = v.selectingKey
      ? [...v.selectingKey.keys.map((k) => ({ key: k })), { id: "key-back" }]
      : v.choices.map((c) => ({ id: c.id }));
    for (const option of options) {
      root();
      const before = q.view(),
        desc = option.key ? "KEY " + role(option.key) : option.id;
      if (["next", "first", "retry-round"].includes(option.id)) continue;
      const branch = path.concat(desc);
      let frames = [];
      try {
        counters.edges++;
        if (option.key) {
          counters.keyEdges++;
          assert(q.selectKey(option.key.id));
          frames = q.confirm();
        } else {
          frames = run(option.id);
        }
        const after = q.view();
        covered.add(
          JSON.stringify([
            before.round,
            before.phase,
            before.selectingKey?.action,
            before.selectingKey?.stage,
            desc,
          ]),
        );
        inspectFrames(frames, after, branch);
        if (option.id === "retry-here") {
          counters.retry++;
          assert(!after.feedback, "retry clears feedback");
          assert.equal(after.consequence, false);
          continue;
        }
        if (after.feedback?.correct) counters.correct++;
        else if (after.feedback) {
          counters.wrong++;
          const resume = q.checkpoint();
          assert(q.select("retry-here"));
          q.confirm();
          counters.retry++;
          assert.equal(
            retryShape(q.view()),
            retryShape(before),
            "retry restores question model and key stage",
          );
          resume();
        }
        if (option.id === "show-consequence") {
          counters.consequences++;
          assert.equal(
            after.phase,
            "done",
            "consequence reaches terminal result",
          );
          assert.equal(after.consequence, true);
          assert(
            after.choices.some((c) => c.id === "retry-here"),
            "demo keeps exact question retry",
          );
          assert(
            frames.length || before.phase === "done",
            "demo presents consequences",
          );
        }
        visit(branch, depth + 1);
      } catch (e) {
        failure(e, branch, q.view());
      }
    }
    root();
  }
  for (let r = 0; r < 4; r++) {
    q.start(r);
    visit(["Round " + (r + 1)]);
  }
  t.diagnostic(
    JSON.stringify({ counters, coveredOperations: covered.size, endings }),
  );
  assert(
    // The removed R3 payload picker previously offered four key candidates.
    counters.keyEdges >= 29,
    "all current key-type and operation combinations were traversed",
  );
  assert(
    // Its wrong-type choices shared one consequence demonstration.
    counters.consequences >= 30,
    "all distinct wrong-answer demos were traversed",
  );
  for (const code of [
    "attack-success",
    "original-accepted",
    "bad-key",
    "bad-verification-key",
    "authenticated",
    "bad-message",
    "key-signature-rejected",
    "tag-rejected",
  ])
    assert(endings[code], "reachable terminal " + code);
  assert.deepEqual(
    errors,
    [],
    "choice traversal errors include reproducible action paths",
  );
});
