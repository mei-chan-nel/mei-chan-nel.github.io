import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createLab, rounds } from "../lab/crypto-communication/model.mjs";
import { createQuest } from "../lab/crypto-communication/quest.mjs";
import {
  roundFrames,
  forwardFrames,
  createStoryPlayer,
} from "../lab/crypto-communication/storyboard.mjs";
import { explanations } from "../lab/crypto-communication/explanations.mjs";
const find = (lab, type, owner) =>
  lab
    .snapshot()
    .inventory.find((a) => a.type === type && (!owner || a.owner === owner))
    ?.id;
const capture = (lab) => {
  lab.capture();
  return lab.snapshot().incoming.id;
};
function intercept(lab) {
  lab.start(1);
  capture(lab);
  lab.setOutgoing(find(lab, "public", "charlie"));
  lab.forward();
  const encrypted = capture(lab);
  assert.equal(
    lab.decrypt(encrypted, find(lab, "private", "charlie")).ok,
    true,
  );
  const key = find(lab, "symmetric");
  lab.setOutgoing(lab.wrapKey(key, find(lab, "public", "bob")).id);
  lab.forward();
  return key;
}
function caKey(lab, round) {
  lab.start(round);
  if (round === 3) {
    capture(lab);
    lab.forward();
  }
  capture(lab);
  lab.forward();
  capture(lab);
  const id = lab.createAttackerKey().id;
  lab.setOutgoing(lab.wrapKey(id, find(lab, "public", "bob")).id);
  lab.forward();
  capture(lab);
  return id;
}
function choose(q, id, predicate) {
  assert.ok(q.view().choices.length <= 2);
  assert.ok(q.select(id), "available action " + id);
  if (q.view().selectingKey) {
    const k = q
      .view()
      .selectingKey.keys.find(
        predicate ||
          ((k) =>
            ["open-key", "sign"].includes(id)
              ? k.type === "private"
              : ["rewrap", "inject-key"].includes(id)
                ? k.type === "public" && k.owner === "bob"
                : k.type === "symmetric"),
      );
    assert.ok(k, "available key for " + id);
    assert.ok(q.selectKey(k.id));
  }
  return q.confirm();
}
function correct(q, id, predicate) {
  choose(q, id, predicate);
  assert.equal(q.view().feedback?.correct, true, id);
  assert.equal(q.view().tone, "correct");
  return choose(q, "continue");
}
function reachMessage(q, round) {
  q.start(round);
  if (round === 3) {
    correct(q, "send-signing-key");
    choose(q, "forward");
  }
  if (round) {
    correct(q, round >= 2 ? "send-public" : "swap");
    choose(q, "forward");
    if (round >= 2) correct(q, "inject-key");
    else {
      correct(q, "open-key");
      correct(q, "rewrap");
    }
  }
  choose(q, "forward");
}
function complete(q, round) {
  reachMessage(q, round);
  if (round < 2) correct(q, "read");
  correct(q, round === 3 ? "predict-detected" : "predict-safe");
  if (round === 3) correct(q, "sign");
  correct(q, "edit");
  choose(q, "forward");
}
test("four rounds progress from common key to public key, CA, and signature", () => {
  assert.deepEqual(
    rounds.map((r) => r.short),
    ["共通鍵", "公開鍵", "認証局 CA", "電子署名"],
  );
  const q = createQuest();
  for (let r = 0; r < 4; r++) {
    complete(q, r);
    assert.equal(
      q.view().result.code,
      r === 3 ? "signature-rejected" : "attack-success",
    );
    assert.equal(q.view().read, r < 2);
    if (r < 3) {
      choose(q, "next");
      assert.equal(q.view().round, r + 1);
    }
  }
});
test("R1 exposes plaintext only after original packet decryption", () => {
  const lab = createLab(),
    key = capture(lab);
  assert.equal(lab.snapshot().original, null);
  lab.forward();
  const msg = capture(lab);
  assert.equal(JSON.stringify(lab.snapshot()).includes("I love you."), false);
  const opaque = lab.snapshot().inventory.find((a) => a.id === msg);
  assert.equal("payload" in opaque, false);
  assert.equal(lab.decrypt(msg, find(lab, "private")).ok, false);
  assert.equal(lab.snapshot().original, null);
  assert.equal(lab.decrypt(msg, key).ok, true);
  assert.equal(lab.snapshot().original, "I love you.");
  lab.edit("I hate you.");
  const cipher = lab.encryptMessage(key).id;
  assert.equal(lab.snapshot().outgoing, null);
  lab.setOutgoing(cipher);
  lab.forward();
  assert.equal(lab.snapshot().result.code, "attack-success");
});
test("delivery does not disclose unread original plaintext, even after acceptance", () => {
  const lab = createLab();
  lab.forward();
  lab.forward();
  assert.equal(lab.snapshot().original, null);
  assert.equal(lab.snapshot().result.message, null);
  assert.equal(lab.snapshot().result.hiddenMessage, true);
});
test("decrypting a self-created guess never reveals the original", () => {
  const lab = createLab(),
    key = capture(lab);
  lab.forward();
  lab.edit("I love you.");
  const id = lab.encryptMessage(key).id;
  lab.decrypt(id, key);
  assert.equal(lab.snapshot().original, null);
  assert.equal(lab.snapshot().read, false);
});
test("every round and restart refreshes keys and clears old candidates", () => {
  const lab = createLab(),
    old = capture(lab);
  lab.start(0);
  const fresh = capture(lab);
  assert.notEqual(old, fresh);
  assert.equal(find(lab, "symmetric"), fresh);
  lab.forward();
  const msg = capture(lab);
  assert.equal(lab.decrypt(msg, old).ok, false);
  assert.equal(
    lab.snapshot().inventory.some((a) => a.id === old),
    false,
  );
  lab.start(2);
  const own = lab.createAttackerKey().id;
  lab.start(2);
  assert.notEqual(own, lab.createAttackerKey().id);
});
test("R2 substitution decrypts only with matching private key and rewrapping keeps Bob able to receive", () => {
  const lab = createLab(),
    key = intercept(lab),
    msg = capture(lab);
  assert.equal(lab.decrypt(msg, find(lab, "public", "bob")).ok, false);
  assert.equal(lab.decrypt(msg, key).ok, true);
  lab.edit("I hate you.");
  lab.setOutgoing(lab.encryptMessage(key).id);
  lab.forward();
  assert.equal(lab.snapshot().result.code, "attack-success");
});
test("R2 forwarding a key addressed to Charlie fails at Bob", () => {
  const lab = createLab();
  lab.start(1);
  capture(lab);
  lab.setOutgoing(find(lab, "public", "charlie"));
  lab.forward();
  capture(lab);
  lab.forward();
  assert.equal(lab.snapshot().result.code, "bad-key");
});
for (const round of [2, 3]) {
  test(`R${round + 1}: CA rejects forged Bob certificate before key leakage`, () => {
    const lab = createLab();
    lab.start(round);
    if (round === 3) {
      capture(lab);
      lab.forward();
    }
    capture(lab);
    lab.setOutgoing(
      lab.forgeCertificate(find(lab, "public", "charlie"), "bob").id,
    );
    lab.forward();
    assert.equal(lab.snapshot().result.code, "authenticated");
    assert.equal(lab.snapshot().bobHasKey, false);
    assert.equal(find(lab, "symmetric"), undefined);
    assert.equal(lab.snapshot().original, null);
  });
  test(`R${round + 1}: genuine Charlie certificate fails expected Bob identity`, () => {
    const lab = createLab();
    lab.start(round);
    if (round === 3) {
      capture(lab);
      lab.forward();
    }
    const cert = lab.snapshot().ca.charlieCertificate;
    assert.equal(lab.validateCertificate(cert.id, "charlie").ok, true);
    assert.equal(lab.validateCertificate(cert.id, "bob").reason, "identity");
    lab.setOutgoing(cert.id);
    lab.forward();
    assert.equal(lab.snapshot().result.code, "authenticated");
  });
  test(`R${round + 1}: genuine original communication is accepted without leaking plaintext`, () => {
    const lab = createLab();
    lab.start(round);
    for (let i = 0; i < 4 && lab.snapshot().phase !== "done"; i++)
      lab.forward();
    assert.equal(lab.snapshot().result.code, "original-accepted");
    assert.equal(lab.snapshot().original, null);
  });
  test(`R${round + 1}: Charlie own key cannot decrypt Alice original packet`, () => {
    const lab = createLab(),
      key = caKey(lab, round);
    assert.equal(lab.snapshot().impersonating, true);
    assert.equal(lab.decrypt(lab.snapshot().incoming.id, key).ok, false);
    assert.equal(lab.snapshot().original, null);
    // Only replacing the key does not make Alice's ciphertext valid under Charlie's key.
    lab.forward();
    assert.equal(lab.snapshot().result.code, "bad-message");
  });
}
test("R3 Bob public key allows Charlie to wrap a NEW key and submit own ciphertext without reading Alice", () => {
  const lab = createLab(),
    key = caKey(lab, 2);
  lab.edit("I hate you.");
  lab.setOutgoing(lab.encryptMessage(key).id);
  lab.forward();
  const s = lab.snapshot();
  assert.equal(s.result.code, "attack-success");
  assert.equal(s.result.message, "I hate you.");
  assert.equal(s.read, false);
  assert.equal(s.original, null);
  assert.equal(s.deliveredSignature, null);
});
for (const sig of ["none", "charlie"])
  test(`R4 rejects fresh forgery with ${sig} signature after Charlie key injection`, () => {
    const lab = createLab(),
      key = caKey(lab, 3);
    lab.edit("I hate you.");
    lab.chooseSignature(sig);
    lab.setOutgoing(lab.encryptMessage(key).id);
    lab.forward();
    assert.equal(lab.snapshot().result.code, "signature-rejected");
    assert.equal(lab.snapshot().result.accepted, false);
    assert.equal(lab.snapshot().original, null);
  });
test("R4 verifies Alice certificate BEFORE registering her verification key", () => {
  const lab = createLab();
  lab.start(3);
  const before = lab.snapshot();
  assert.equal(before.phase, "signing-public");
  assert.equal(before.verificationForBob, null);
  capture(lab);
  lab.forward();
  assert.equal(lab.snapshot().verificationForBob.owner, "alice");
  assert.equal(lab.snapshot().phase, "public");
});
test("R4 rejects substituted verification certificate instead of registering Charlie key", () => {
  const lab = createLab();
  lab.start(3);
  capture(lab);
  lab.setOutgoing(
    lab.forgeCertificate(find(lab, "verify", "charlie"), "alice").id,
  );
  lab.forward();
  assert.equal(lab.snapshot().result.code, "bad-verification-key");
  assert.equal(lab.snapshot().verificationForBob, null);
});
test("signature creation requires Charlie private key; public verification key cannot sign", () => {
  const lab = createLab();
  caKey(lab, 3);
  lab.edit("I hate you.");
  assert.equal(lab.signDraft(find(lab, "verify", "alice")).ok, false);
  assert.equal(lab.signDraft(find(lab, "public", "bob")).ok, false);
  assert.equal(lab.signDraft(find(lab, "private", "charlie")).ok, true);
  assert.equal(lab.snapshot().signature.owner, "charlie");
});
test("a Charlie signature over a different text is not reusable as a valid signature", () => {
  const lab = createLab(),
    key = caKey(lab, 3);
  lab.edit("first");
  lab.signDraft(find(lab, "private", "charlie"));
  lab.edit("I hate you.");
  lab.setOutgoing(lab.encryptMessage(key).id);
  lab.forward();
  assert.equal(lab.snapshot().result.code, "signature-rejected");
});
test("certificate verification uses a fixed browser trust anchor", () => {
  const lab = createLab();
  lab.start(3);
  const ca = lab.snapshot().ca;
  assert.equal(
    lab.validateCertificate(ca.aliceCertificate.id, "alice").key.owner,
    "alice",
  );
  assert.equal(
    lab.validateCertificate(ca.bobCertificate.id, "bob").key.owner,
    "bob",
  );
  const fake = lab.forgeCertificate(find(lab, "public", "charlie"), "bob").id;
  assert.equal(lab.validateCertificate(fake, "bob").reason, "ca-signature");
  assert.equal(lab.snapshot().ca.root.id, ca.root.id);
  assert.deepEqual(
    lab
      .snapshot()
      .inventory.filter((k) => k.type === "private")
      .map((k) => k.owner),
    ["charlie"],
  );
});
test("invalid capabilities and directly corrupted ciphertext never decrypt", () => {
  const lab = createLab();
  assert.equal(lab.decrypt("missing", "missing").ok, false);
  assert.equal(
    lab.wrapKey(find(lab, "private"), find(lab, "public")).ok,
    false,
  );
  assert.equal(lab.encryptMessage(find(lab, "public")).ok, false);
  assert.equal(lab.setOutgoing("missing").ok, false);
  const key = capture(lab);
  lab.forward();
  const msg = capture(lab),
    broken = lab.corrupt(msg).id;
  assert.equal(lab.decrypt(broken, key).ok, false);
  lab.setOutgoing(broken);
  lab.forward();
  assert.equal(lab.snapshot().result.code, "bad-message");
});
test("wrong key answer is red and restores the SAME question, key and packet on retry", () => {
  const q = createQuest();
  reachMessage(q, 1);
  const before = q.view();
  choose(q, "read", (k) => k.type === "public");
  assert.equal(q.view().tone, "wrong");
  assert.equal(q.view().original, null);
  choose(q, "retry-here");
  assert.equal(q.view().incoming.id, before.incoming.id);
  assert.equal(q.view().count, before.count);
  assert.equal(q.view().selectingKey.action, "read");
  q.selectKey(
    q.view().selectingKey.keys.find((k) => k.type === "symmetric").id,
  );
  q.confirm();
  assert.equal(q.view().feedback.correct, true);
  assert.equal(q.view().original, "I love you.");
});
for (const round of [0, 2, 3])
  test(`R${round + 1}: wrong prediction demonstrates real consequence and retries at that prediction`, () => {
    const q = createQuest();
    reachMessage(q, round);
    if (round === 0) correct(q, "read");
    const before = q.view();
    choose(q, round === 3 ? "predict-safe" : "predict-detected");
    assert.equal(q.view().feedback.correct, false);
    const frames = choose(q, "show-consequence");
    assert.ok(frames.every((f) => f.tone === "wrong"));
    assert.equal(
      q.view().result.code,
      round === 3 ? "signature-rejected" : "attack-success",
    );
    choose(q, "retry-here");
    assert.equal(q.view().state, "predict");
    assert.equal(q.view().incoming.id, before.incoming.id);
    assert.equal(q.view().count, before.count);
    assert.equal(q.view().draft, before.draft);
  });
for (const [round, action, result] of [
  [2, "swap", "authenticated"],
  [3, "swap-signing-key", "bad-verification-key"],
])
  test(`R${round + 1}: failed certificate substitution can be demonstrated and retried in place`, () => {
    const q = createQuest();
    q.start(round);
    const before = q.view();
    choose(q, action);
    assert.equal(q.view().feedback.correct, false);
    choose(q, "show-consequence");
    assert.equal(q.view().result.code, result);
    choose(q, "retry-here");
    assert.equal(q.view().phase, before.phase);
    assert.equal(q.view().outgoing, null);
    assert.equal(q.view().incoming.id, before.incoming.id);
    assert.equal(q.view().verificationForBob, null);
  });
test("wrong key-injection recipient fails at Bob and retries that key picker", () => {
  const q = createQuest();
  q.start(2);
  correct(q, "send-public");
  choose(q, "forward");
  choose(q, "inject-key", (k) => k.type === "public" && k.owner === "charlie");
  assert.equal(q.view().feedback.correct, false);
  const own = q.view().attackerKey.id;
  choose(q, "show-consequence");
  assert.equal(q.view().result.code, "bad-key");
  choose(q, "retry-here");
  assert.equal(q.view().selectingKey.action, "inject-key");
  assert.equal(q.view().attackerKey.id, own);
});
test("unavailable Bob private key is never suggested as a fake decryption solution", () => {
  const q = createQuest();
  q.start(2);
  correct(q, "send-public");
  choose(q, "forward");
  choose(q, "open-key");
  assert.equal(q.view().feedback.correct, false);
  assert.match(q.view().feedback.explanation, /Bobの秘密鍵/);
  choose(q, "retry-here");
  assert.equal(
    q
      .view()
      .selectingKey.keys.some(
        (k) => k.type === "private" && k.owner !== "charlie",
      ),
    false,
  );
});
test("pass remains in normal key picker and forwards actual original data on consequence", () => {
  const q = createQuest();
  reachMessage(q, 0);
  q.select("read");
  assert.equal(q.view().selectingKey.allowPass, true);
  q.selectPass();
  q.confirm();
  choose(q, "show-consequence");
  assert.equal(q.view().result.code, "original-accepted");
  assert.equal(q.view().original, null);
  choose(q, "retry-here");
  assert.equal(q.view().selectingKey.action, "read");
});
test("key-picker candidates exclude old keys and other people private keys", () => {
  const q = createQuest();
  reachMessage(q, 0);
  const old = q.view().inventory.find((k) => k.type === "symmetric").id;
  reachMessage(q, 1);
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
test("checkpoint restores protocol, unread original and keys across actions and round changes", () => {
  const q = createQuest();
  reachMessage(q, 0);
  const before = q.view(),
    undo = q.checkpoint();
  correct(q, "read");
  q.start(3);
  undo();
  assert.equal(q.view().incoming.id, before.incoming.id);
  assert.equal(q.view().original, null);
  assert.equal(q.view().read, false);
  correct(q, "read");
  const ca = createQuest();
  ca.start(3);
  const saved = ca.checkpoint();
  correct(ca, "send-signing-key");
  choose(ca, "forward");
  assert.equal(ca.view().verificationForBob.owner, "alice");
  saved();
  assert.equal(ca.view().verificationForBob, null);
  assert.equal(ca.view().phase, "signing-public");
});
test("CA key generation and Bob key injection can be fully rewound", () => {
  const q = createQuest();
  q.start(2);
  correct(q, "send-public");
  choose(q, "forward");
  const undo = q.checkpoint();
  correct(q, "inject-key");
  choose(q, "forward");
  assert.equal(q.view().impersonating, true);
  undo();
  assert.equal(q.view().attackerKey, null);
  assert.equal(q.view().bobHasKey, false);
});
test("correct feedback uses first frame only once, with Next reserved for narration", () => {
  const q = createQuest();
  reachMessage(q, 0);
  choose(q, "read");
  const first = q.view().feedbackFrame;
  assert.equal(first.scene, "decrypt");
  const rest = choose(q, "continue");
  assert.equal(rest.length, 1);
  assert.equal(rest[0].scene, "idea");
  assert.notEqual(first.text, rest[0].text);
});
test("singleton forwarding remains an explicit Charlie action", () => {
  const q = createQuest();
  q.start(0);
  assert.deepEqual(
    q.view().choices.map((c) => c.id),
    ["forward"],
  );
  q.start(2);
  correct(q, "send-public");
  assert.deepEqual(
    q.view().choices.map((c) => c.id),
    ["forward"],
  );
  assert.match(q.view().choices[0].label, /Alice/);
  choose(q, "forward");
  correct(q, "inject-key");
  assert.deepEqual(
    q.view().choices.map((c) => c.id),
    ["forward"],
  );
  assert.match(q.view().choices[0].label, /Bob/);
});
test("Bob keys originate at Bob and verification key stops at relay before registration", () => {
  const q = createQuest();
  q.start(1);
  const frames = roundFrames(q.view());
  assert.equal(frames[0].at, "bob");
  assert.equal(frames[0].kind, "public");
  assert.ok(frames.every((f) => f.route === "Bob → 中継機 → Alice"));
  q.start(3);
  const sign = roundFrames(q.view());
  assert.equal(sign.at(-1).at, "relay");
  assert.equal(q.view().verificationForBob, null);
  assert.equal(
    sign.some((f) => f.text.includes("登録した")),
    false,
  );
  const story = createStoryPlayer();
  story.play(sign);
  const saved = story.checkpoint();
  story.next();
  story.restore(saved);
  assert.equal(story.position().index, 0);
});
test("CA narration shows requests, signed certificate returns, and fixed browser root", () => {
  const q = createQuest(),
    all = [];
  for (const r of [2, 3]) {
    q.start(r);
    all.push(...roundFrames(q.view()));
  }
  for (const route of ["Alice → CA", "CA → Alice", "Bob → CA", "CA → Bob"])
    assert.ok(all.some((f) => f.route === route));
  assert.ok(
    all.some((f) => f.scene === "trust-root" && /最初から/.test(f.text)),
  );
  assert.ok(all.some((f) => /CharlieはCAとの通信にも/.test(f.text)));
});
test("Round4 narrates Alice signature creation separately before encrypted message transport", () => {
  const lab = createLab();
  lab.start(3);
  lab.forward();
  lab.forward();
  const before = lab.snapshot();
  lab.forward();
  const frames = forwardFrames(before, lab.snapshot());
  const signed = frames.findIndex((f) => f.scene === "sign"),
    encrypted = frames.findIndex((f) => f.scene === "encrypt");
  assert.ok(signed >= 0 && signed < encrypted);
  assert.match(frames[signed].text, /Alice.*秘密鍵.*電子署名/);
  assert.equal(frames[signed].at, "alice");
});
test("full explanations preserve secrecy and distinguish CA authentication from sender authentication", () => {
  const q = createQuest();
  for (let r = 0; r < 4; r++) {
    q.start(r);
    const parts = explanations(q.view());
    assert.ok(parts.length >= 4);
    assert.ok(parts.map((p) => p.text).join("").length > 800);
    assert.equal(JSON.stringify(parts).includes("I love you."), false);
  }
  q.start(2);
  assert.match(
    JSON.stringify(explanations(q.view())),
    /両方を作り直したなりすまし/,
  );
});
test("page offers four rounds, single shared panel and no confirmation or CA bypass controls", async () => {
  const html = await readFile(
    new URL("../lab/crypto-communication/index.html", import.meta.url),
    "utf8",
  );
  assert.equal(html.includes("I love you."), false);
  assert.equal(html.includes("choice-commit"), false);
  assert.equal(html.includes("choice-confirm"), false);
  assert.equal(html.includes('id="authenticate"'), false);
  assert.match(html, /ROUND 4/);
  assert.match(html, /ROUND 3<\/span>認証局 CA/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /noindex, nofollow/);
  assert.match(html, /id="fullscreen"/);
});
