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
  assert.match(story.text, /止めている/);
  assert.equal(story.recipient, "Bob");
  assert.equal(JSON.stringify(story).includes("I love you."), false);
  assert.match(describeItem(lab.snapshot().incoming), /復号は不要/);
  lab.start(2);
  story = describeSituation(lab.snapshot());
  assert.equal(story.recipient, "Alice");
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
  assert.equal(story.recipient, "Alice");
  assert.equal(JSON.stringify(story).includes("I love you."), false);
});

test("fullscreen composition follows width, height and orientation without scaling text", async () => {
  const { screenLayout } =
    await import("../lab/crypto-communication/screen-layout.mjs");
  assert.deepEqual(screenLayout(1366, 768), {
    layout: "wide",
    density: "comfortable",
  });
  assert.deepEqual(screenLayout(1280, 600), {
    layout: "wide",
    density: "compact",
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
});
test("paged explanations preserve all characters including non-BMP characters", async () => {
  const { paginateText } =
    await import("../lab/crypto-communication/screen-layout.mjs");
  const text = "公開鍵と秘密鍵を比べよう。🙂署名も確かめよう！".repeat(20);
  const pages = paginateText(text, 65);
  assert.ok(pages.length > 1);
  assert.equal(pages.join(""), text);
  assert.ok(pages.every((page) => Array.from(page).length <= 65));
});
test("compact overview keeps the goal and observable result while preserving secrecy", async () => {
  const { compactStory, compactOutcome } =
    await import("../lab/crypto-communication/screen-layout.mjs");
  const lab = createLab();
  for (let round = 0; round < 4; round++) {
    lab.start(round);
    const text = JSON.stringify(compactStory(lab.snapshot()));
    assert.equal(text.includes("I love you."), false);
    assert.ok(compactStory(lab.snapshot()).goal.length > 0);
  }
  lab.start(0);
  lab.forward();
  lab.forward();
  assert.match(compactOutcome(lab.snapshot(), "deliver"), /Bob/);
  assert.equal(
    compactOutcome(lab.snapshot(), "deliver").includes("I love you."),
    false,
  );
});

test("intro story connects the relay only after explaining Alice, Bob and Charlie", async () => {
  const { introFrames, roundFrames, createStoryPlayer } =
    await import("../lab/crypto-communication/storyboard.mjs");
  const lab = createLab(),
    initial = lab.snapshot(),
    frames = introFrames();
  assert.equal(frames[0].connected, false);
  assert.equal(frames[1].speaker, "alice");
  assert.equal(frames[2].speaker, "charlie");
  assert.match(frames[2].text, /I hate you\./);
  assert.match(frames[3].text, /Aliceの家の外/);
  assert.equal(frames[3].connected, true);
  const player = createStoryPlayer();
  player.play([...frames, ...roundFrames(initial)]);
  let turns = 0;
  while (player.active()) {
    assert.equal(player.current().text.includes("I love you."), false);
    assert.ok(Array.from(player.current().text).length <= 64);
    player.next();
    assert.ok(++turns < 50);
  }
  assert.deepEqual(
    lab.snapshot(),
    initial,
    "reading a story never sends a packet or changes a key",
  );
});
test("narrated forward shows Alice encrypting before Charlie receives the ciphertext", async () => {
  const { forwardFrames } =
    await import("../lab/crypto-communication/storyboard.mjs");
  const lab = createLab(),
    before = lab.snapshot();
  lab.forward();
  const after = lab.snapshot(),
    frames = forwardFrames(before, after);
  assert.equal(frames[0].at, "bob");
  const encrypted = frames.findIndex((frame) => frame.scene === "encrypt");
  const arrived = frames.findIndex((frame) => frame.scene === "inbound");
  assert.ok(encrypted > 0 && arrived > encrypted);
  assert.equal(frames[encrypted].speaker, "alice");
  assert.equal(frames[arrived].at, "relay");
  assert.equal(JSON.stringify(frames).includes("I love you."), false);
});
test("Charlies operation dialogue records the operation instead of a generic decision prompt", async () => {
  const { operationFrames } =
    await import("../lab/crypto-communication/storyboard.mjs");
  const lab = createLab(),
    before = lab.snapshot();
  lab.capture();
  const frames = operationFrames({
    before,
    after: lab.snapshot(),
    action: "copy",
    mode: "decrypt",
    ok: true,
  });
  assert.equal(frames[0].speaker, "charlie");
  assert.match(frames[0].text, /記録装置でコピー/);
  assert.equal(
    frames[0].at,
    "relay",
    "copying keeps the original on the route",
  );
  assert.match(frames[1].text, /別の操作/);
});
test("signature verification and authenticity failure appear at the right receiver", async () => {
  const { forwardFrames, decisionFrame } =
    await import("../lab/crypto-communication/storyboard.mjs");
  const lab = createLab();
  lab.start(2);
  lab.forward();
  lab.forward();
  const before = lab.snapshot();
  lab.forward();
  const frames = forwardFrames(before, lab.snapshot());
  assert.ok(
    frames.findIndex((frame) => frame.scene === "verify") >
      frames.findIndex((frame) => frame.scene === "decrypt"),
  );
  lab.start(3, true);
  lab.setOutgoing(find(lab, "public", "charlie"));
  const publicBefore = lab.snapshot();
  lab.forward();
  const stopped = forwardFrames(publicBefore, lab.snapshot());
  assert.equal(stopped.at(-1).at, "alice");
  assert.equal(
    stopped.some((frame) => frame.kind === "ciphertext"),
    false,
  );
  assert.match(decisionFrame(lab.snapshot()).route, /Bob.*Alice/);
});

test("every narrative sentence names the participants and keeps the whole action on a page", async () => {
  const {
    introFrames,
    roundFrames,
    forwardFrames,
    decisionFrame,
    operationFrames,
    createStoryPlayer,
  } = await import("../lab/crypto-communication/storyboard.mjs");
  const frames = [...introFrames()];
  const lab = createLab();
  for (let round = 0; round < 4; round++) {
    lab.start(round);
    frames.push(...roundFrames(lab.snapshot()), decisionFrame(lab.snapshot()));
    while (lab.snapshot().phase !== "done") {
      const before = lab.snapshot();
      lab.forward();
      frames.push(
        ...forwardFrames(before, lab.snapshot()),
        decisionFrame(lab.snapshot()),
      );
    }
  }
  // Include all rejection types and a successful substitution attack.
  for (const kind of [
    "public",
    "key",
    "message",
    "signature",
    "authenticated",
    "attack",
  ]) {
    lab.start(
      kind === "authenticated"
        ? 3
        : kind === "signature"
          ? 2
          : kind === "public"
            ? 1
            : 0,
    );
    if (kind === "public") lab.setOutgoing(find(lab, "private"));
    if (kind === "key") lab.setOutgoing(find(lab, "public"));
    if (kind === "message") {
      lab.forward();
      lab.setOutgoing(find(lab, "public"));
    }
    if (kind === "authenticated")
      lab.setOutgoing(find(lab, "public", "charlie"));
    if (kind === "signature" || kind === "attack") {
      const key =
        kind === "signature" ? interceptKey(lab, 2).key : capture(lab);
      if (kind === "attack") lab.forward();
      const message = capture(lab);
      lab.decrypt(message, key);
      lab.edit("I hate you.");
      lab.setOutgoing(lab.encryptMessage(key).id);
    }
    const before = lab.snapshot();
    lab.forward();
    frames.push(
      ...forwardFrames(before, lab.snapshot()),
      decisionFrame(lab.snapshot()),
    );
  }
  for (const mode of ["decrypt", "wrap", "message", "replace"]) {
    for (const ok of [true, false]) {
      const before = lab.snapshot();
      frames.push(
        ...operationFrames({
          before,
          after: before,
          mode,
          action: mode === "replace" ? "replace" : "tool",
          ok,
          keyLabel: "Aliceの検証用公開鍵（信頼済み）",
          dataLabel: "共通鍵 K1",
        }),
      );
    }
  }
  for (const frame of frames) {
    for (const sentence of frame.text.match(/[^。！？\n]+[。！？\n]?/gu) ||
      []) {
      assert.match(sentence, /Alice|Bob|Charlie/, sentence);
      assert.ok(Array.from(sentence).length <= 64, sentence);
    }
  }
  const player = createStoryPlayer();
  player.play(frames);
  const pages = [];
  while (player.active()) {
    const { text } = player.current();
    assert.ok(Array.from(text).length <= 64);
    assert.match(
      text,
      /[。！？]$/u,
      "next must not separate the actor and action",
    );
    pages.push(text);
    player.next();
  }
  assert.equal(pages.join(""), frames.map((frame) => frame.text).join(""));
});

test("a short sentence before a long sentence does not orphan a narrative continuation", async () => {
  const { createStoryPlayer } =
    await import("../lab/crypto-communication/storyboard.mjs");
  const first = "Charlieは、暗号文を受け取った。";
  const second =
    "Charlieは、AliceからBobへ送られた本文の暗号文を、中継機の記録装置にコピーした。";
  const player = createStoryPlayer();
  player.play([{ text: first + second, speaker: "charlie" }]);
  assert.equal(player.current().text, first);
  player.next();
  assert.equal(player.current().text, second);
  player.next();
  assert.equal(player.active(), false);
});
