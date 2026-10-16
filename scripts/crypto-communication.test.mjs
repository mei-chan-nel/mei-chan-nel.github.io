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
  assert.match(html, /label for="draft"/);
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

test("narrative explains the relay, stops and round-specific goals without revealing content", async () => {
  const { describeSituation, describeItem } =
    await import("../lab/crypto-communication/presentation.mjs");
  const lab = createLab();
  let story = describeSituation(lab.snapshot());
  assert.match(story.text, /中継機/);
  assert.match(story.text, /止まっている/);
  assert.equal(story.recipient, "ボブ");
  assert.equal(JSON.stringify(story).includes("I love you."), false);
  assert.match(describeItem(lab.snapshot().incoming), /復号は不要/);
  lab.start(2);
  story = describeSituation(lab.snapshot());
  assert.equal(story.recipient, "アリス");
  assert.match(story.goal, /盗聴.*改ざん/);
  lab.start(3, true);
  capture(lab);
  lab.setOutgoing(find(lab, "public", "charlie"));
  lab.forward();
  story = describeSituation(lab.snapshot());
  assert.equal(
    story.packet,
    "公開鍵",
    "rejection must not show a message packet that was never sent",
  );
  assert.equal(story.recipient, "アリス");
  assert.equal(JSON.stringify(story).includes("I love you."), false);
});
