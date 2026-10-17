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
  introFrames,
  roundFrames,
  createStoryPlayer,
  forwardFrames,
} from "../lab/crypto-communication/storyboard.mjs";
import {
  screenLayout,
  paginateText,
} from "../lab/crypto-communication/screen-layout.mjs";
function decide(q, action, predicate) {
  assert.ok(q.view().choices.length <= 2);
  assert.equal(
    q.select(action),
    true,
    action + " must be offered in this scene",
  );
  if (q.view().selectingKey) {
    const keys = q.view().selectingKey.keys;
    const test =
      predicate ||
      ((key) =>
        action === "open-key"
          ? key.type === "private"
          : action === "rewrap"
            ? key.type === "public" && key.owner === "bob"
            : key.type === "symmetric" && key.detail === "この通信で入手");
    const key =
      keys.find(test) ||
      (!predicate && keys.find((key) => key.type === "symmetric"));
    assert.ok(key, "test must select a key explicitly");
    assert.equal(q.selectKey(key.id), true);
  }
  return q.confirm();
}
function questKey(q, round) {
  q.start(round);
  decide(q, "swap");
  decide(q, "forward");
  decide(q, "open-key");
  decide(q, "rewrap");
  decide(q, "forward");
}
test("arriving data is automatically recorded in every phase without capture choices", () => {
  const q = createQuest();
  for (const round of [0, 1, 2, 3]) {
    q.start(round);
    for (let i = 0; i < 3 && q.view().phase !== "done"; i++) {
      const s = q.view();
      assert.equal(s.recorded, true);
      assert.ok(s.inventory.some((a) => a.id === s.incoming.id));
      assert.equal(
        s.choices.some((a) => a.id === "capture"),
        false,
      );
      if (s.phase === "message") break;
      decide(q, "forward");
    }
  }
});
test("choosing and canceling is inert, and unavailable operations cannot be confirmed", () => {
  const q = createQuest();
  q.start(1);
  const before = q.view();
  assert.equal(q.select("edit"), false);
  assert.deepEqual(q.confirm(), []);
  assert.deepEqual(q.view(), before);
  q.select("swap");
  assert.equal(q.view().outgoing, null);
  q.cancel();
  assert.deepEqual(q.view(), before);
  decide(q, "swap");
  assert.equal(q.view().outgoing.owner, "charlie");
  decide(q, "undo");
  assert.equal(q.view().outgoing, null);
  const after = q.view();
  assert.deepEqual(q.confirm(), []);
  assert.deepEqual(q.view(), after);
});
test("the idea to reverse the message appears only after successful decryption", () => {
  const q = createQuest();
  assert.equal(JSON.stringify(introFrames()).includes("hate"), false);
  assert.equal(JSON.stringify(introFrames()).includes("I love you."), false);
  assert.equal(JSON.stringify(q.view()).includes("I hate you."), false);
  assert.equal(
    q.view().choices.some((a) => a.id === "edit"),
    false,
  );
  decide(q, "forward");
  assert.equal(JSON.stringify(q.view()).includes("I love you."), false);
  assert.equal(JSON.stringify(q.view()).includes("hate"), false);
  q.select("read");
  assert.equal(q.view().original, null);
  q.cancel();
  const frames = decide(q, "read");
  assert.equal(q.view().original, "I love you.");
  assert.equal(q.view().state, "idea");
  assert.ok(
    frames.findIndex((f) => f.scene === "idea") >
      frames.findIndex((f) => f.scene === "decrypt"),
  );
  assert.match(frames.at(-1).text, /Charlie.*love.*hate.*思いついた/);
  assert.deepEqual(
    q.view().choices.map((a) => a.id),
    ["edit", "forward"],
  );
});
test("guided R1 groups edit, re-encryption and replacement and allows undo before delivery", () => {
  const q = createQuest();
  decide(q, "forward");
  decide(q, "read");
  const first = q
    .view()
    .inventory.find((a) => a.type === "symmetric" && a.current).id;
  decide(q, "edit");
  assert.equal(q.view().draft, "I hate you.");
  assert.equal(q.view().outgoing.type, "ciphertext");
  assert.equal(q.view().result, null);
  decide(q, "undo");
  assert.equal(q.view().outgoing, null);
  assert.equal(q.view().draft, "I love you.");
  decide(q, "edit");
  decide(q, "forward");
  assert.equal(q.view().result.code, "attack-success");
  assert.equal(q.view().result.message, "I hate you.");
  q.start(0);
  assert.notEqual(
    q.view().inventory.find((a) => a.type === "symmetric" && a.current).id,
    first,
  );
});
test("R2: the previous common key fails, then public-key substitution and rewrapping work", () => {
  const q = createQuest();
  q.start(1);
  decide(q, "forward");
  decide(q, "open-key", (key) => key.type === "symmetric");
  assert.equal(q.view().state, "blocked");
  assert.equal(q.view().original, null);
  const oldCount = q.view().count;
  decide(q, "restart");
  assert.ok(q.view().count > oldCount);
  decide(q, "swap");
  decide(q, "forward");
  decide(q, "open-key");
  assert.match(q.view().keyLabel, /^共通鍵/);
  decide(q, "rewrap");
  assert.equal(q.view().outgoing.type, "envelope");
  decide(q, "forward");
  decide(q, "read");
  decide(q, "edit");
  decide(q, "forward");
  assert.equal(q.view().result.code, "attack-success");
});
test("sending the Charlie-addressed envelope without rewrapping still fails at Bob", () => {
  const q = createQuest();
  q.start(1);
  decide(q, "swap");
  decide(q, "forward");
  decide(q, "open-key");
  decide(q, "forward");
  assert.equal(q.view().result.code, "bad-key");
});
test("R3: the same guided attack reads the message but the trusted signature rejects edits", () => {
  const q = createQuest();
  questKey(q, 2);
  decide(q, "read");
  assert.equal(q.view().read, true);
  const signature = q.view().signature.id;
  decide(q, "edit");
  assert.equal(q.view().signature.id, signature);
  const before = q.view();
  const frames = decide(q, "forward");
  assert.equal(q.view().result.code, "signature-rejected");
  assert.equal(q.view().result.accepted, false);
  assert.ok(
    frames.findIndex((f) => f.scene === "verify") <
      frames.findIndex((f) => f.revealOutcome),
  );
  assert.deepEqual(
    before.inventory.filter((a) => a.type === "private").map((a) => a.owner),
    ["charlie"],
  );
});
test("the learner can forward the unchanged signed message after reading it", () => {
  const q = createQuest();
  questKey(q, 2);
  decide(q, "read");
  decide(q, "forward");
  assert.equal(q.view().result.code, "original-accepted");
  assert.equal(q.view().read, true);
});
test("genuine public key plus the old symmetric key cannot expose this round's message", () => {
  const q = createQuest();
  q.start(1);
  decide(q, "forward");
  decide(q, "forward");
  decide(q, "read");
  assert.equal(q.view().original, null);
  assert.equal(q.view().read, false);
  assert.equal(
    q.view().choices.some((a) => a.id === "edit"),
    false,
  );
  assert.equal(q.select("forward"), false);
  assert.equal(q.view().phase, "message");
  assert.equal(q.view().result, null);
  assert.ok(q.view().choices.some((action) => action.id === "retry"));
  decide(q, "retry");
  assert.equal(q.view().phase, "public");
});
test("authenticating Bob's key stops before sharing a key; toggling the check permits eavesdropping", () => {
  const q = createQuest();
  q.start(3);
  decide(q, "swap");
  decide(q, "forward");
  assert.equal(q.view().result.code, "authenticated");
  assert.equal(q.view().read, false);
  assert.equal(
    q.view().inventory.some((a) => a.type === "symmetric" && a.current),
    false,
  );
  decide(q, "compare");
  assert.equal(q.view().authenticate, false);
  decide(q, "swap");
  decide(q, "forward");
  decide(q, "open-key");
  decide(q, "rewrap");
  decide(q, "forward");
  decide(q, "read");
  decide(q, "forward");
  assert.equal(q.view().read, true);
  assert.equal(q.view().result.code, "original-accepted");
});
test("round restart clears a pending choice and all revealed text", () => {
  const q = createQuest();
  decide(q, "forward");
  decide(q, "read");
  q.select("edit");
  q.start(1);
  assert.equal(q.view().pending, null);
  assert.equal(q.view().original, null);
  assert.equal(JSON.stringify(q.view()).includes("I love you."), false);
  assert.equal(JSON.stringify(q.view()).includes("I hate you."), false);
});
test("short narration keeps the same stage, explains recording once and preserves secrecy", () => {
  const frames = introFrames();
  assert.equal(frames.length, 4);
  assert.equal(frames[0].connected, false);
  assert.equal(frames[2].connected, true);
  assert.match(frames[3].text, /自動で記録/);
  for (const round of [0, 1, 2, 3]) {
    const q = createQuest();
    q.start(round);
    assert.ok(roundFrames(q.view()).length <= 2);
    const player = createStoryPlayer();
    const source = [...frames, ...roundFrames(q.view())];
    player.play(source);
    const pages = [];
    while (player.active()) {
      assert.ok(Array.from(player.current().text).length <= 64);
      pages.push(player.current().text);
      player.next();
    }
    assert.equal(pages.join(""), source.map((f) => f.text).join(""));
    assert.equal(pages.join("").includes("hate"), false);
  }
});
test("a short sentence before a long sentence never orphans the actor or action", () => {
  const a = "Charlieは、暗号文を受け取った。",
    b =
      "Charlieは、AliceからBobへ送られた本文の暗号文を、中継機の記録装置にコピーした。";
  const player = createStoryPlayer();
  player.play([{ text: a + b }]);
  assert.equal(player.current().text, a);
  player.next();
  assert.equal(player.current().text, b);
});
test("fullscreen composition follows orientation and explanation pages preserve all characters", () => {
  assert.deepEqual(screenLayout(1366, 768), {
    layout: "wide",
    density: "comfortable",
  });
  assert.deepEqual(screenLayout(390, 844), {
    layout: "narrow",
    density: "comfortable",
  });
  assert.deepEqual(screenLayout(375, 667), {
    layout: "narrow",
    density: "compact",
  });
  assert.deepEqual(screenLayout(844, 390), { layout: "wide", density: "tiny" });
  assert.deepEqual(screenLayout(320, 480), {
    layout: "narrow",
    density: "tiny",
  });
  const text = "公開鍵と秘密鍵。🙂署名も確認。".repeat(30),
    pages = paginateText(text, 64);
  assert.equal(pages.join(""), text);
  assert.ok(pages.every((p) => Array.from(p).length <= 64));
});

test("opening a key operation never chooses a key or runs it automatically", () => {
  const q = createQuest();
  decide(q, "forward");
  const initial = q.view();
  q.select("read");
  assert.equal(q.view().pending, null);
  assert.equal(q.view().selectingKey.selectedId, null);
  assert.match(q.view().selectingKey.title, /本文.*復号.*鍵/);
  assert.deepEqual(q.confirm(), []);
  assert.equal(q.view().original, null);
  assert.deepEqual(q.view().log, initial.log);
  assert.equal(q.selectKey("unknown-key"), false);
  const key = q.view().selectingKey.keys.find((a) => a.type === "symmetric");
  q.selectKey(key.id);
  assert.match(q.view().pending.summary, /共通鍵.*本文.*復号/);
  assert.equal(q.view().original, null);
  q.cancel();
  assert.equal(q.view().pending, null);
  assert.equal(q.view().selectingKey.selectedId, key.id);
  q.cancel();
  assert.equal(q.view().selectingKey, null);
  assert.deepEqual(q.view(), initial);
});
test("public and private keys fail on a symmetric message, then the chosen symmetric key succeeds without restarting", () => {
  const q = createQuest();
  decide(q, "forward");
  const packet = q.view().incoming.id,
    count = q.view().count;
  for (const type of ["public", "private"]) {
    decide(q, "read", (key) => key.type === type);
    assert.equal(q.view().lastAttempt.ok, false);
    assert.equal(q.view().lastAttempt.key.type, type);
    assert.match(q.view().lastAttempt.reason, /共通鍵/);
    assert.equal(q.view().phase, "message");
    assert.equal(q.view().incoming.id, packet);
    assert.equal(q.view().count, count);
    assert.equal(q.view().original, null);
  }
  decide(q, "read", (key) => key.type === "symmetric");
  assert.equal(q.view().original, "I love you.");
});
test("a Charlie-addressed envelope needs Charlie's private key, not either public key or the old shared key", () => {
  const q = createQuest();
  q.start(1);
  decide(q, "swap");
  decide(q, "forward");
  for (const predicate of [
    (key) => key.type === "public" && key.owner === "bob",
    (key) => key.type === "public" && key.owner === "charlie",
    (key) => key.type === "symmetric",
  ]) {
    decide(q, "open-key", predicate);
    assert.equal(q.view().lastAttempt.ok, false);
    assert.match(q.view().lastAttempt.reason, /Charlieの秘密鍵/);
    assert.equal(
      q.view().inventory.some((a) => a.type === "symmetric" && a.current),
      false,
    );
  }
  decide(q, "open-key", (key) => key.type === "private");
  assert.equal(q.view().lastAttempt.ok, true);
  assert.equal(
    q.view().inventory.some((a) => a.type === "symmetric" && a.current),
    true,
  );
});
test("all held keys fail on Bob's envelope and Bob's private key is never available", () => {
  const q = createQuest();
  q.start(1);
  decide(q, "forward");
  q.select("open-key");
  const keys = q.view().selectingKey.keys;
  assert.equal(
    keys.some((a) => a.type === "private" && a.owner !== "charlie"),
    false,
  );
  q.cancel();
  for (const key of keys) {
    decide(q, "open-key", (a) => a.id === key.id);
    assert.equal(q.view().lastAttempt.ok, false);
  }
  assert.equal(
    q.view().inventory.some((a) => a.type === "symmetric" && a.current),
    false,
  );
});
test("wrapping rejects non-public keys, and choosing Charlie's public key produces an envelope Bob cannot open", () => {
  const q = createQuest();
  q.start(1);
  decide(q, "swap");
  decide(q, "forward");
  decide(q, "open-key");
  for (const type of ["private", "symmetric"]) {
    decide(q, "rewrap", (key) => key.type === type);
    assert.equal(q.view().lastAttempt.ok, false);
    assert.equal(q.view().outgoing, null);
    assert.match(q.view().lastAttempt.reason, /配送先の公開鍵/);
  }
  decide(
    q,
    "rewrap",
    (key) => key.type === "public" && key.owner === "charlie",
  );
  assert.equal(q.view().lastAttempt.ok, true);
  assert.equal(q.view().stagedKey.owner, "charlie");
  assert.match(q.view().outgoingDescription, /Charlieの公開鍵/);
  decide(q, "forward");
  assert.equal(q.view().result.code, "bad-key");
});
test("a wrong encryption key type leaves the message intact; an old shared key creates ciphertext Bob cannot read", () => {
  const q = createQuest();
  questKey(q, 1);
  decide(q, "read");
  for (const type of ["public", "private"]) {
    decide(q, "edit", (key) => key.type === type);
    assert.equal(q.view().lastAttempt.ok, false);
    assert.equal(q.view().draft, "I love you.");
    assert.equal(q.view().outgoing, null);
  }
  decide(
    q,
    "edit",
    (key) => key.type === "symmetric" && key.detail === "以前の通信で入手",
  );
  assert.equal(q.view().lastAttempt.ok, true);
  assert.equal(q.view().draft, "I hate you.");
  decide(q, "forward");
  assert.equal(q.view().result.code, "bad-message");
});
test("Alice's trusted verification key is offered but cannot decrypt a message", () => {
  const q = createQuest();
  questKey(q, 2);
  decide(q, "read", (key) => key.type === "verify");
  assert.equal(q.view().original, null);
  assert.equal(q.view().lastAttempt.ok, false);
  assert.match(q.view().lastAttempt.reason, /Aliceの署名/);
  decide(q, "read");
  assert.equal(q.view().original, "I love you.");
});
test("the key picker keeps only one previous shared key and never invents unavailable keys", () => {
  const q = createQuest();
  q.start(0);
  q.start(0);
  q.start(0);
  questKey(q, 2);
  q.select("read");
  const s = q.view(),
    keys = s.selectingKey.keys;
  assert.ok(keys.length <= 6);
  assert.equal(
    keys.filter(
      (a) => a.type === "symmetric" && a.detail === "以前の通信で入手",
    ).length,
    1,
  );
  assert.ok(keys.every((key) => s.inventory.some((a) => a.id === key.id)));
  assert.deepEqual(
    keys.filter((a) => a.type === "private").map((a) => a.owner),
    ["charlie"],
  );
});

test("message choices focus on choosing a key and cannot skip decryption into a no-read outcome", () => {
  const q = createQuest();
  for (const round of [0, 1, 2, 3]) {
    if (round === 0) q.start(0);
    else {
      q.start(round, false);
      decide(q, "swap");
      decide(q, "forward");
      decide(q, "open-key");
      decide(q, "rewrap");
    }
    decide(q, "forward");
    assert.equal(q.view().phase, "message");
    assert.deepEqual(
      q.view().choices.map((a) => a.id),
      ["read"],
    );
    const original = q.view();
    assert.equal(q.select("forward"), false);
    assert.deepEqual(q.confirm(), []);
    assert.deepEqual(q.view(), original);
    decide(q, "read", (key) => key.type === "public");
    assert.equal(q.view().original, null);
    assert.equal(q.select("forward"), false);
    assert.ok(q.view().choices.every((a) => a.id !== "forward"));
    decide(q, "read");
    assert.equal(q.view().read, true);
    assert.ok(q.view().choices.some((a) => a.id === "edit"));
    assert.ok(q.view().choices.some((a) => a.id === "forward"));
  }
});
