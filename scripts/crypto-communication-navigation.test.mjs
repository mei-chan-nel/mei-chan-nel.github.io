import test from "node:test";
import assert from "node:assert/strict";
import { createQuest } from "../lab/crypto-communication/quest.mjs";
import { createNarrationHistory } from "../lab/crypto-communication/narration-history.mjs";

function setup(round = 0) {
  const quest = createQuest();
  quest.start(round);
  let screen = "arrival";
  const history = createNarrationHistory({
    capture: () => ({ restore: quest.checkpoint(), screen }),
    restore: (saved) => {
      saved.restore();
      screen = saved.screen;
    },
  });
  return {
    quest,
    history,
    screen: () => screen,
    page(key) {
      screen = key;
      history.record(key);
    },
  };
}
function choose(quest, action) {
  assert(quest.select(action), "available " + action);
  return quest.confirm();
}

test("Back from a key picker restores the question and allows the other answer", () => {
  const { quest, history, page, screen } = setup();
  choose(quest, "forward");
  page("ciphertext-arrived");
  page("can-Charlie-read");
  const packet = quest.view().incoming.id;
  choose(quest, "can-read");
  assert.equal(quest.view().selectingKey.action, "read");
  assert(history.back(null));
  assert.equal(screen(), "can-Charlie-read");
  assert.equal(quest.view().incoming.id, packet);
  assert.equal(quest.view().selectingKey, null);
  choose(quest, "cannot-read");
  assert.equal(quest.view().feedback.correct, false);
  page("incorrect-answer");
  assert(history.back("incorrect-answer"));
  assert.equal(screen(), "can-Charlie-read");
  choose(quest, "can-read");
  assert.equal(quest.view().selectingKey.action, "read");
  assert(history.back(null));
  assert(history.back("can-Charlie-read"));
  assert.equal(screen(), "ciphertext-arrived");
  assert.equal(history.canGoBack("ciphertext-arrived"), false);
});

test("Back discards a decrypted future and restores the exact unread packet and keys", () => {
  const { quest, history, page } = setup();
  choose(quest, "forward");
  page("can-Charlie-read");
  const before = quest.view();
  choose(quest, "can-read");
  const commonKey = quest
    .view()
    .selectingKey.keys.find((key) => key.type === "symmetric");
  quest.selectKey(commonKey.id);
  quest.confirm();
  assert.equal(quest.view().original, "I love you.");
  page("decrypted");
  assert(history.back("decrypted"));
  assert.equal(quest.view().read, false);
  assert.equal(quest.view().original, null);
  assert.equal(quest.view().incoming.id, before.incoming.id);
  assert.deepEqual(quest.view().inventory, before.inventory);
  choose(quest, "cannot-read");
  page("different-answer");
  assert(history.back("different-answer"));
  assert.equal(quest.view().original, null);
  assert.equal(history.canGoBack("can-Charlie-read"), false);
});

test("Back rolls back a forwarded public key so a different delivery strategy can be chosen", () => {
  const { quest, history, page } = setup(1);
  page("Bob-public-key");
  const before = quest.view();
  choose(quest, "send-public");
  assert.equal(quest.view().publicForAlice.owner, "bob");
  assert.equal(quest.view().phase, "key");
  page("forwarded-original-key");
  assert(history.back("forwarded-original-key"));
  assert.equal(quest.view().phase, "public");
  assert.equal(quest.view().incoming.id, before.incoming.id);
  assert.equal(quest.view().count, before.count);
  choose(quest, "swap");
  assert.equal(quest.view().feedback.correct, true);
  choose(quest, "continue");
  choose(quest, "forward");
  assert.equal(quest.view().publicForAlice.owner, "charlie");
  assert.equal(quest.view().phase, "key");
});

test("Rendering the same question again does not add Back steps or change packet identity", () => {
  const { quest, history, page, screen } = setup();
  page("arrival");
  page("forward-question");
  for (let i = 0; i < 10; i++) page("forward-question");
  const packet = quest.view().incoming.id;
  assert(history.back("forward-question"));
  assert.equal(screen(), "arrival");
  assert.equal(quest.view().incoming.id, packet);
  assert.equal(history.canGoBack("arrival"), false);
  assert.equal(history.back("arrival"), false);
});
