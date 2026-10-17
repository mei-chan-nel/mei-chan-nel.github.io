import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createLab } from "../lab/crypto-communication/model.mjs";
const find = (lab, type, owner) =>
  lab
    .snapshot()
    .inventory.find((a) => a.type === type && (!owner || a.owner === owner))
    ?.id;
function capture(lab) {
  const id = lab.snapshot().incoming.id;
  lab.capture();
  return id;
}
function interceptKey(lab, round) {
  lab.start(round, round !== 3);
  const bob = capture(lab),
    charlie = find(lab, "public", "charlie");
  lab.setOutgoing(charlie);
  lab.forward();
  const sealedKey = capture(lab);
  assert.equal(lab.decrypt(sealedKey, find(lab, "private")).ok, true);
  const key = lab
    .snapshot()
    .inventory.find((a) => a.type === "symmetric" && a.current).id;
  const wrapped = lab.wrapKey(key, bob).id;
  lab.setOutgoing(wrapped);
  lab.forward();
  return { key, bob, sealedKey };
}
function tamper(lab, key, signature = "keep", text = "I hate you.") {
  const msg = capture(lab);
  assert.equal(lab.decrypt(msg, key).ok, true);
  lab.edit(text);
  lab.chooseSignature(signature);
  const created = lab.encryptMessage(key).id;
  lab.setOutgoing(created);
  lab.forward();
  return msg;
}
test("R1: steal the plaintext key, read and replace the message", () => {
  const lab = createLab(),
    key = capture(lab);
  assert.equal(lab.snapshot().original, null);
  lab.forward();
  const msg = capture(lab);
  const opaque = lab.snapshot().inventory.find((a) => a.id === msg);
  assert.equal(JSON.stringify(opaque).includes("I love you."), false);
  assert.equal("payload" in opaque, false);
  assert.equal(lab.decrypt(msg, find(lab, "private")).ok, false);
  assert.equal(lab.snapshot().original, null);
  assert.equal(lab.decrypt(msg, key).ok, true);
  lab.edit("I hate you.");
  const forged = lab.encryptMessage(key).id;
  assert.equal(
    lab.snapshot().outgoing,
    null,
    "encryption must not silently replace the wire data",
  );
  lab.setOutgoing(forged);
  lab.forward();
  assert.equal(lab.snapshot().result.code, "attack-success");
  assert.equal(lab.snapshot().result.message, "I hate you.");
  assert.equal(lab.snapshot().read, true);
});
test("receiving alone never reveals the original to Charlie", () => {
  const lab = createLab();
  lab.forward();
  lab.forward();
  assert.equal(lab.snapshot().original, null);
  assert.equal(lab.snapshot().result.message, null);
  assert.equal(lab.snapshot().result.hiddenMessage, true);
});
test("every attempt gets a fresh key; the old key cannot decrypt the next message", () => {
  const lab = createLab(),
    old = capture(lab);
  lab.forward();
  capture(lab);
  lab.start(1);
  const bob = capture(lab);
  lab.forward();
  const wrapped = capture(lab);
  assert.equal(lab.decrypt(wrapped, old).ok, false);
  assert.equal(
    lab.decrypt(wrapped, bob).ok,
    false,
    "public keys cannot decrypt an envelope",
  );
  assert.equal(lab.decrypt(wrapped, find(lab, "private")).ok, false);
  lab.forward();
  const msg = capture(lab);
  assert.equal(lab.decrypt(msg, old).ok, false);
  assert.equal(lab.snapshot().original, null);
  lab.start(0);
  assert.notEqual(old, lab.snapshot().incoming.id);
  assert.equal(
    lab.snapshot().inventory.some((a) => a.id === old),
    true,
  );
  assert.equal(
    lab.snapshot().inventory.some((a) => a.id === msg),
    false,
    "working data is cleared between attempts",
  );
});
test("R2: public key substitution and rewrapping enables interception and tampering", () => {
  const lab = createLab(),
    { key } = interceptKey(lab, 1);
  tamper(lab, key);
  assert.equal(lab.snapshot().result.code, "attack-success");
});
test("R2: forwarding Charlie-addressed key ciphertext directly fails at Bob", () => {
  const lab = createLab();
  lab.start(1);
  capture(lab);
  lab.setOutgoing(find(lab, "public", "charlie"));
  lab.forward();
  capture(lab);
  lab.forward();
  assert.equal(lab.snapshot().result.code, "bad-key");
});
for (const sig of ["keep", "charlie", "none"])
  test(`R3: eavesdropping succeeds but tampering with signature=${sig} is rejected`, () => {
    const lab = createLab(),
      { key } = interceptKey(lab, 2);
    tamper(lab, key, sig);
    assert.equal(lab.snapshot().read, true);
    assert.equal(lab.snapshot().result.code, "signature-rejected");
    assert.equal(lab.snapshot().result.accepted, false);
    assert.deepEqual(
      lab
        .snapshot()
        .inventory.filter((a) => a.type === "private")
        .map((a) => a.owner),
      ["charlie"],
    );
  });
test("R3: original signature remains valid after re-encryption of unchanged content", () => {
  const lab = createLab(),
    { key } = interceptKey(lab, 2);
  tamper(lab, key, "keep", "I love you.");
  assert.equal(lab.snapshot().result.code, "original-accepted");
  assert.equal(lab.snapshot().read, true);
});
test("direct edits and encryption with an unrelated symmetric key do not decrypt at Bob", () => {
  const lab = createLab(),
    old = capture(lab);
  const { key } = interceptKey(lab, 1);
  const msg = capture(lab);
  const corrupt = lab.corrupt(msg).id;
  assert.equal(lab.decrypt(corrupt, key).ok, false);
  lab.setOutgoing(corrupt);
  lab.forward();
  assert.equal(lab.snapshot().result.code, "bad-message");
  interceptKey(lab, 1);
  capture(lab);
  lab.edit("I hate you.");
  lab.setOutgoing(lab.encryptMessage(old).id);
  lab.forward();
  assert.equal(lab.snapshot().result.code, "bad-message");
});
test("EXTRA: trusted Bob key check detects substitution before disclosing any key", () => {
  const lab = createLab();
  lab.start(3, true);
  capture(lab);
  lab.setOutgoing(find(lab, "public", "charlie"));
  lab.forward();
  assert.equal(lab.snapshot().result.code, "authenticated");
  assert.equal(lab.snapshot().read, false);
  assert.equal(lab.snapshot().bobHasKey, false);
  assert.equal(find(lab, "symmetric"), undefined);
  assert.equal(lab.snapshot().incoming.type, "public");
});
test("EXTRA: turning authenticity check off permits eavesdropping again", () => {
  const lab = createLab(),
    { key } = interceptKey(lab, 3);
  const msg = capture(lab);
  assert.equal(lab.decrypt(msg, key).ok, true);
  lab.forward();
  assert.equal(lab.snapshot().result.code, "original-accepted");
});
test("EXTRA: genuine Bob key proceeds and original signed message is accepted", () => {
  const lab = createLab();
  lab.start(3, true);
  lab.forward();
  lab.forward();
  lab.forward();
  assert.equal(lab.snapshot().result.accepted, true);
  assert.equal(lab.snapshot().read, false);
});
test("unavailable and incompatible objects are rejected by workbench", () => {
  const lab = createLab();
  assert.equal(lab.decrypt("missing", "missing").ok, false);
  assert.equal(
    lab.wrapKey(find(lab, "private"), find(lab, "public")).ok,
    false,
  );
  assert.equal(lab.encryptMessage(find(lab, "public")).ok, false);
  assert.equal(lab.setOutgoing("missing").ok, false);
});
test("page preserves initial secrecy and accessible responsive controls", async () => {
  const html = await readFile(
    new URL("../lab/crypto-communication/index.html", import.meta.url),
    "utf8",
  );
  assert.equal(html.includes("I love you."), false);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /id="choice-commit"/);
  assert.match(html, /viewport/);
  assert.match(html, /noindex, nofollow/);
});
test("decrypting self-created guessed plaintext does not reveal the original", () => {
  const lab = createLab(),
    key = capture(lab);
  lab.forward();
  lab.edit("I love you.");
  const guess = lab.encryptMessage(key).id;
  lab.decrypt(guess, key);
  assert.equal(lab.snapshot().read, false);
  assert.equal(lab.snapshot().original, null);
});
test("captured original can be decrypted after delivery and updates observation", () => {
  const lab = createLab(),
    key = capture(lab);
  lab.forward();
  const msg = capture(lab);
  lab.forward();
  assert.equal(lab.snapshot().result.hiddenMessage, true);
  lab.decrypt(msg, key);
  assert.equal(lab.snapshot().result.hiddenMessage, false);
  assert.equal(lab.snapshot().result.message, "I love you.");
});

import { createQuest } from "../lab/crypto-communication/quest.mjs";
import {
  roundFrames,
  createStoryPlayer,
} from "../lab/crypto-communication/storyboard.mjs";
import { explanations } from "../lab/crypto-communication/explanations.mjs";
function choose(q, id, predicate) {
  assert.ok(q.view().choices.length <= 2);
  assert.ok(q.select(id), `available: ${id}`);
  if (q.view().selectingKey) {
    const key = q
      .view()
      .selectingKey.keys.find(
        predicate ||
          ((key) =>
            id === "open-key"
              ? key.type === "private"
              : id === "rewrap"
                ? key.owner === "bob"
                : key.type === "symmetric"),
      );
    assert.ok(key);
    assert.ok(q.selectKey(key.id));
  }
  return q.confirm();
}
function correct(q, id, predicate) {
  choose(q, id, predicate);
  assert.equal(q.view().feedback.correct, true, id);
  assert.equal(q.view().tone, "correct");
  return choose(q, "continue");
}
function body(q, round) {
  q.start(round);
  if (round) {
    correct(q, "swap");
    choose(q, "forward");
    correct(q, "open-key");
    correct(q, "rewrap");
  }
  choose(q, "forward");
}
test("all rounds retain hybrid cryptography and require a prediction after reading", () => {
  for (const round of [0, 1, 2]) {
    const q = createQuest();
    body(q, round);
    assert.equal(q.view().original, null);
    correct(q, "read");
    assert.equal(q.view().original, "I love you.");
    assert.deepEqual(
      q.view().choices.map((x) => x.id),
      ["predict-safe", "predict-detected"],
    );
    correct(q, round === 2 ? "predict-detected" : "predict-safe");
    correct(q, "edit");
    choose(q, "forward");
    assert.equal(
      q.view().result.code,
      round === 2 ? "signature-rejected" : "attack-success",
    );
    assert.equal(q.view().tone, "correct");
  }
});
test("wrong decryption is immediate red and retries at the same key question", () => {
  const q = createQuest();
  body(q, 1);
  const before = q.view();
  choose(q, "read", (k) => k.type === "public");
  assert.equal(q.view().tone, "wrong");
  assert.equal(q.view().read, false);
  choose(q, "retry-here");
  const after = q.view();
  assert.equal(after.incoming.id, before.incoming.id);
  assert.equal(after.count, before.count);
  assert.equal(after.original, null);
  assert.equal(after.selectingKey.action, "read");
  assert.ok(
    q.selectKey(after.selectingKey.keys.find((k) => k.type === "symmetric").id),
  );
  q.confirm();
  assert.equal(q.view().feedback.correct, true);
});
test("wrong prediction can demonstrate real Bob outcome then retry exact question", () => {
  for (const round of [0, 2]) {
    const q = createQuest();
    body(q, round);
    correct(q, "read");
    const before = q.view();
    choose(q, round === 2 ? "predict-safe" : "predict-detected");
    assert.equal(q.view().tone, "wrong");
    const frames = choose(q, "show-consequence");
    assert.ok(frames.every((f) => f.tone === "wrong"));
    assert.equal(
      q.view().result.code,
      round === 2 ? "signature-rejected" : "attack-success",
    );
    choose(q, "retry-here");
    assert.equal(q.view().phase, "message");
    assert.equal(q.view().draft, "I love you.");
    assert.equal(q.view().incoming.id, before.incoming.id);
    assert.equal(q.view().count, before.count);
    assert.equal(q.view().state, "predict");
  }
});
test("forward unchanged is available inside key picker, and Bob can read what Charlie did not read", () => {
  const q = createQuest();
  body(q, 0);
  const before = q.view();
  q.select("read");
  assert.equal(q.view().selectingKey.allowPass, true);
  q.selectPass();
  q.confirm();
  assert.equal(q.view().feedback.correct, false);
  choose(q, "show-consequence");
  assert.equal(q.view().result.code, "original-accepted");
  assert.equal(q.view().read, false);
  assert.equal(q.view().original, null);
  choose(q, "retry-here");
  assert.equal(q.view().incoming.id, before.incoming.id);
  assert.equal(q.view().selectingKey.action, "read");
});
test("wrong recipient wrapping is valid encryption but fails for Bob and can be retried", () => {
  const q = createQuest();
  q.start(1);
  correct(q, "swap");
  choose(q, "forward");
  correct(q, "open-key");
  choose(q, "rewrap", (k) => k.type === "public" && k.owner === "charlie");
  assert.equal(q.view().feedback.correct, false);
  choose(q, "show-consequence");
  assert.equal(q.view().result.code, "bad-key");
  choose(q, "retry-here");
  assert.equal(q.view().phase, "key");
  assert.equal(q.view().selectingKey.action, "rewrap");
});
test("passing Charlie-wrapped key without rewrapping prevents Bob from opening it", () => {
  const q = createQuest();
  q.start(1);
  correct(q, "swap");
  choose(q, "forward");
  correct(q, "open-key");
  q.select("rewrap");
  q.selectPass();
  q.confirm();
  choose(q, "show-consequence");
  assert.equal(q.view().result.code, "bad-key");
});
test("leaving authentic Bob key stops Charlie reading, without inventing Bob failure", () => {
  const q = createQuest();
  q.start(1);
  choose(q, "send-public");
  assert.equal(q.view().feedback.correct, false);
  choose(q, "show-consequence");
  assert.equal(q.view().result.code, "original-accepted");
  assert.equal(q.view().read, false);
  choose(q, "retry-here");
  assert.equal(q.view().phase, "public");
  assert.equal(q.view().outgoing, null);
});
test("checkpoint restores real protocol state across forwarding, reading, and new rounds", () => {
  const q = createQuest();
  q.start(0);
  const before = q.view();
  const undo = q.checkpoint();
  choose(q, "forward");
  const unread = q.checkpoint();
  correct(q, "read");
  q.start(2);
  unread();
  assert.equal(q.view().phase, "message");
  assert.equal(q.view().original, null);
  assert.equal(q.view().read, false);
  correct(q, "read");
  undo();
  assert.equal(q.view().incoming.id, before.incoming.id);
  assert.equal(q.view().phase, "key");
  assert.equal(q.view().result, null);
});
test("no previous symmetric keys or private Alice/Bob keys enter picker", () => {
  const q = createQuest();
  body(q, 0);
  correct(q, "read");
  const old = q
    .view()
    .inventory.find((k) => k.type === "symmetric" && k.current).id;
  body(q, 1);
  q.select("read");
  const keys = q.view().selectingKey.keys;
  assert.equal(
    keys.some((k) => k.id === old),
    false,
  );
  assert.equal(keys.filter((k) => k.type === "symmetric").length, 1);
  assert.equal(
    keys.some((k) => k.type === "private" && k.owner !== "charlie"),
    false,
  );
});
test("authenticated public-key check blocks theft before key delivery", () => {
  const q = createQuest();
  q.start(3);
  correct(q, "swap");
  choose(q, "forward");
  assert.equal(q.view().result.code, "authenticated");
  assert.equal(q.view().original, null);
  choose(q, "compare");
  correct(q, "swap");
  choose(q, "forward");
  correct(q, "open-key");
  assert.equal(q.view().phase, "key");
});
test("public key starts at Bob and crosses relay before Alice; storyboard restores frames", () => {
  const q = createQuest();
  q.start(1);
  const frames = roundFrames(q.view());
  assert.equal(frames[0].at, "bob");
  assert.equal(frames[0].kind, "public");
  assert.ok(frames.some((f) => f.at === "relay"));
  assert.ok(frames.every((f) => f.route === "Bob → 中継機 → Alice"));
  const story = createStoryPlayer();
  story.play(frames);
  const saved = story.checkpoint();
  story.next();
  story.restore(saved);
  assert.equal(story.current().at, "bob");
});
test("explanations show full sections without revealing unread plaintext", () => {
  const q = createQuest();
  for (const round of [0, 1, 2, 3]) {
    q.start(round);
    const full = explanations(q.view());
    assert.ok(full.length >= 5);
    assert.ok(full.map((x) => x.text).join("").length > 800);
    assert.equal(JSON.stringify(full).includes("I love you."), false);
  }
});
