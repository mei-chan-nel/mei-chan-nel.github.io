import { compactOutcome, paginateText } from "./screen-layout.mjs";
export const englishNames = (text) =>
  String(text ?? "")
    .replaceAll("アリス", "Alice")
    .replaceAll("ボブ", "Bob")
    .replaceAll("チャーリー", "Charlie");
const frame = (speaker, text, scene, extra = {}) => ({
  speaker,
  text,
  scene,
  connected: true,
  at: "relay",
  kind: "none",
  caption: "通信経路上の中継機",
  ...extra,
});
const packetKind = (a) =>
  a?.type === "public"
    ? "public"
    : a?.type === "symmetric"
      ? "key"
      : a?.type === "envelope"
        ? "wrapped-key"
        : a?.type === "ciphertext"
          ? "ciphertext"
          : "data";
const packetName = (kind) =>
  ({
    public: "公開鍵",
    key: "共通鍵",
    "wrapped-key": "暗号化した共通鍵",
    ciphertext: "本文の暗号文",
    letter: "秘密のメッセージ",
    data: "送り出すデータ",
    none: "",
  })[kind];
export function introFrames() {
  return [
    frame(
      "narrator",
      "Aliceは、遠くにいるBobへ、秘密のメッセージを送ろうとしていた。",
      "direct",
      {
        connected: false,
        at: "alice",
        kind: "letter",
        goal: "AliceがBobへ秘密のメッセージを送る様子を見よう。",
        caption: "AliceからBobへ、秘密の通信",
      },
    ),
    frame(
      "alice",
      "Aliceは、Bobにだけ読んでもらいたいメッセージを用意したよ。Aliceは、メッセージの本文を秘密にするよ。",
      "direct",
      {
        connected: false,
        at: "alice",
        kind: "letter",
        goal: "AliceがBobへ秘密のメッセージを送る様子を見よう。",
      },
    ),
    frame(
      "charlie",
      "Charlieは、Aliceの本文を盗み見て、「I hate you.」にすり替えたい。Charlieは、改ざんした本文をBobに受け付けさせたい。",
      "watch",
      {
        connected: false,
        at: "alice",
        kind: "letter",
        goal: "CharlieがAliceの本文を盗み見て、改ざんした文をBobに受理させる。",
      },
    ),
    frame(
      "narrator",
      "Charlieは、Aliceの家の外にある通信経路上の中継機を操作できるようにした。この実験では、Charlieが中継機を掌握した状態を仮定する。",
      "setup",
      { at: "none", caption: "Alice側の回線 → 中継機 → Bob側の回線" },
    ),
    frame(
      "charlie",
      "Charlieは、中継機を通るデータを記録装置にコピーできる。Charlieは、AliceやBobへ届けるデータを別のデータに入れ替えられる。",
      "relay",
      { at: "none" },
    ),
    frame(
      "narrator",
      "Charlieは、AliceやBobの秘密鍵を盗めない。Charlieは、暗号文をコピーしても、本文を読めるとは限らない。",
      "relay",
      { at: "none" },
    ),
  ];
}
export function roundFrames(s) {
  if (s.round === 0)
    return [
      frame(
        "narrator",
        "Round 1では、Aliceが同じ鍵で暗号化と復号をする「共通鍵暗号方式」を使う。",
        "alice-key",
        { at: "alice", kind: "key", phase: "key" },
      ),
      frame(
        "alice",
        "Aliceは、今回の共通鍵で本文を暗号化するよ。Aliceは、本文を復号するための同じ共通鍵を、まずBobへ届けるよ。",
        "alice-key",
        { at: "alice", kind: "key", phase: "key" },
      ),
      frame(
        "narrator",
        "Aliceは、共通鍵を暗号化せずにBobへ送り出した。Aliceが送った共通鍵は、Charlieの中継機に到着した。",
        "inbound",
        {
          at: "relay",
          kind: "key",
          phase: "key",
          route: "Alice → 中継機 → Bob",
        },
      ),
      frame(
        "charlie",
        "Charlieの中継機が、Aliceの共通鍵を受け取った。Charlieは、Bobへ共通鍵を届ける前に、行動を選べる。",
        "intercept",
        { kind: "key", phase: "key", decision: true },
      ),
    ];
  const frames = [];
  if (s.round === 1)
    frames.push(
      frame(
        "narrator",
        "Round 2では、AliceがBobの公開鍵で共通鍵を暗号化する。Aliceは、本文を共通鍵で暗号化する。",
        "relay",
        { at: "none", phase: "public" },
      ),
    );
  if (s.round === 2)
    frames.push(
      frame(
        "alice",
        "Round 3では、Aliceが本文にAliceの秘密鍵で電子署名を付けるよ。Aliceは、署名と本文を共通鍵で暗号化するよ。",
        "sign",
        { at: "alice", kind: "letter", phase: "public" },
      ),
      frame(
        "bob",
        "Bobは、信頼できる経路で確認したAliceの公開鍵で署名を検証するよ。Aliceは、前のラウンドと同じ方式で共通鍵をBobへ届けるよ。",
        "verify",
        {
          at: "bob",
          kind: "public",
          packetLabel: "Aliceの検証用公開鍵",
          route: "Bobの手元：信頼済みのAliceの公開鍵",
          phase: "public",
        },
      ),
    );
  if (s.round === 3)
    frames.push(
      frame(
        "alice",
        s.authenticate
          ? "追加実験では、AliceがBobの公開鍵の持ち主を確かめるよ。Aliceは、受け取った公開鍵の指紋を、信頼済みのBobの指紋と照合するよ。"
          : "追加実験では、Aliceが公開鍵の持ち主を確認する設定をオフにするよ。Charlieは、確認がある場合と通信の結果を比べてみよう。",
        "authenticate",
        { at: "alice", kind: "public", phase: "public" },
      ),
    );
  frames.push(
    frame(
      "bob",
      "Bobは、Bobの公開鍵をAliceに送るよ。Bobは、対になるBobの秘密鍵をBobの手元で保管するよ。",
      "bob-public",
      {
        at: "bob",
        kind: "public",
        phase: "public",
        route: "Bob → 中継機 → Alice",
      },
    ),
    frame(
      "narrator",
      "Bobが送った公開鍵は、Charlieの中継機に到着した。Charlieは、Aliceへ公開鍵を届ける前に介入できる。",
      "inbound",
      { kind: "public", phase: "public", route: "Bob → 中継機 → Alice" },
    ),
    frame(
      "charlie",
      "Charlieは、Bobの公開鍵を中継機で受け取った。Charlieは、Aliceへ届けるデータを自由に選べる。",
      "intercept",
      { kind: "public", phase: "public", decision: true },
    ),
  );
  return frames;
}
export function decisionFrame(s) {
  const kind = packetKind(s.outgoing || s.incoming);
  const phase = s.phase;
  const publicDelivery =
    phase === "public" ||
    (phase === "done" &&
      ["authenticated", "bad-public"].includes(s.result?.code));
  const text =
    phase === "done"
      ? englishNames(compactOutcome(s, ""))
      : phase === "public"
        ? "Charlieの中継機が、Bobの公開鍵を止めている。Charlieは、Aliceへ届けるデータを選べる。"
        : phase === "key"
          ? "Charlieの中継機が、Aliceの鍵の配送を止めている。Charlieは、鍵の配送データをコピーしたり、道具で調べたりできる。"
          : "Charlieの中継機が、Aliceの本文の暗号文を止めている。Charlieは、手元の鍵やデータを自由に使える。";
  return frame(
    phase === "done" ? "narrator" : "charlie",
    text,
    phase === "done" ? (s.result.accepted ? "accept" : "reject") : "intercept",
    {
      kind,
      at:
        phase === "done"
          ? s.result.code === "authenticated" || s.result.code === "bad-public"
            ? "alice"
            : "bob"
          : "relay",
      phase,
      revealOutcome: phase === "done",
      decision: true,
      route: publicDelivery ? "Bob → 中継機 → Alice" : "Alice → 中継機 → Bob",
    },
  );
}
export function forwardFrames(before, after) {
  const sent = before.outgoing || before.incoming,
    kind = packetKind(sent),
    isPublic = before.phase === "public";
  const who = isPublic ? "Alice" : "Bob";
  const frames = [
    frame(
      "narrator",
      `Charlieは、${englishNames(sent.label)}を${who}に届けた。`,
      "delivering",
      {
        at: who.toLowerCase(),
        kind,
        phase: before.phase,
        route: isPublic ? "中継機 → Alice" : "中継機 → Bob",
      },
    ),
  ];
  if (after.result) {
    if (after.result.code === "authenticated")
      frames.push(
        frame(
          "alice",
          "Aliceは、受け取った公開鍵の指紋を、信頼済みのBobの指紋と比べたよ。Aliceは、指紋が一致しない公開鍵の使用を拒否するよ。",
          "authenticate",
          { at: "alice", kind, phase: "public" },
        ),
      );
    else if (after.result.code === "bad-public")
      frames.push(
        frame(
          "alice",
          "Aliceは、届いたデータを公開鍵として使えない。Aliceは、共通鍵を暗号化できないため、通信を中断するよ。",
          "reject",
          { at: "alice", kind, phase: "public" },
        ),
      );
    else if (after.result.code === "bad-key")
      frames.push(
        frame(
          "bob",
          before.round === 0
            ? "Bobは、届いたデータを共通鍵として使えない。Bobは、共通鍵を取得できないため、通信を中断するよ。"
            : "Bobは、届いたデータから共通鍵を取り出せない。Bobは、Bobの秘密鍵で共通鍵を復号できないため、通信を中断するよ。",
          "decrypt",
          { at: "bob", kind, phase: "key" },
        ),
      );
    else {
      frames.push(
        frame(
          "bob",
          "Bobは、本文の暗号文を受け取ったよ。Bobは、配送された共通鍵で本文の暗号文を復号するよ。",
          "decrypt",
          { at: "bob", kind, phase: "message" },
        ),
      );
      if (after.round >= 2 && after.result.code !== "bad-message")
        frames.push(
          frame(
            "bob",
            "Bobは、信頼済みのAliceの公開鍵で署名を検証するよ。Bobは、届いた署名がAliceの署名であり、本文に対応するか確かめるよ。",
            "verify",
            { at: "bob", kind, phase: "message" },
          ),
        );
    }
    const verdict = englishNames(compactOutcome(after, ""));
    frames.push(
      frame(
        who.toLowerCase(),
        verdict,
        after.result.accepted ? "accept" : "reject",
        { at: who.toLowerCase(), kind, phase: "done", revealOutcome: true },
      ),
    );
    const lesson =
      after.result.code === "signature-rejected"
        ? "Charlieは、共通鍵を知っていても、Aliceの秘密鍵で署名を作れない。Bobは、Aliceの署名に対応しない本文を拒否する。"
        : after.result.code === "authenticated"
          ? "Aliceは、共通鍵を送る前に通信を止めた。AliceがBobの公開鍵の真正性を確かめると、Charlieによる鍵のすり替えを検出できる。"
          : after.result.code === "attack-success"
            ? after.round === 0
              ? "Charlieは、経路上で共通鍵を取得し、Aliceの本文を読めた。Charlieは、改ざんした本文も共通鍵で暗号化できた。"
              : "Aliceが公開鍵の持ち主を確かめないと、CharlieはBobの公開鍵をすり替えられる。Charlieは、すり替えによって共通鍵を取得できた。"
            : "Charlieは、盗聴と改ざんの結果を見比べよう。Charlieが同じラウンドをやり直すと、Aliceは新しい共通鍵を使う。";
    frames.push(
      frame("narrator", lesson, after.result.accepted ? "accept" : "reject", {
        at: who.toLowerCase(),
        kind,
        phase: "done",
        revealOutcome: true,
        decision: true,
      }),
    );
    return frames;
  }
  if (before.phase === "public")
    frames.push(
      frame(
        "alice",
        `Aliceは、${englishNames(after.publicForAlice.label)}を受け取ったよ。Aliceは、受け取った公開鍵で今回の共通鍵を暗号化してBobへ送るよ。`,
        "wrap",
        {
          at: "alice",
          kind: "key",
          phase: "key",
          badge: `配送に使う鍵：${englishNames(after.publicForAlice.label)}`,
        },
      ),
      frame(
        "narrator",
        "Aliceは、受け取った公開鍵で共通鍵を暗号化した。Aliceが送った共通鍵の暗号文は、Charlieの中継機に到着した。",
        "inbound",
        { kind: "wrapped-key", phase: "key", route: "Alice → 中継機 → Bob" },
      ),
      frame(
        "charlie",
        "Charlieは、共通鍵の暗号文をコピーするだけでは、共通鍵を読めない。Charlieは、手元の鍵で共通鍵の復号を試せる。",
        "intercept",
        { kind: "wrapped-key", phase: "key", decision: true },
      ),
    );
  else if (before.phase === "key") {
    frames.push(
      frame(
        "bob",
        "Bobは、配送された共通鍵を取得したよ。Bobは、取得した共通鍵で、次に届く本文の暗号文を復号するよ。",
        "bob-key",
        { at: "bob", kind: "key", phase: "message" },
      ),
    );
    if (after.round >= 2)
      frames.push(
        frame(
          "alice",
          "Aliceは、本文にAliceの秘密鍵で電子署名を付けるよ。Bobは、Aliceの署名を使って、本文が変更されたか検証できるよ。",
          "sign",
          { at: "alice", kind: "letter", phase: "message" },
        ),
      );
    frames.push(
      frame(
        "alice",
        after.round >= 2
          ? "Aliceは、本文とAliceの署名を共通鍵で暗号化したよ。Aliceは、署名を含む本文の暗号文をBobへ送るよ。"
          : "Aliceは、本文を共通鍵で暗号化したよ。Aliceは、本文の暗号文をBobへ送るよ。",
        "encrypt",
        { at: "alice", kind: "ciphertext", phase: "message" },
      ),
      frame(
        "narrator",
        "Aliceが送った本文の暗号文は、Charlieの中継機に到着した。Charlieは、Bobへ本文の暗号文を届ける前に介入できる。",
        "inbound",
        { kind: "ciphertext", phase: "message" },
      ),
      frame(
        "charlie",
        "Charlieは、Aliceの本文の暗号文を受け取った。Charlieは、復号に成功するまで、Aliceの本文を読めない。",
        "intercept",
        { kind: "ciphertext", phase: "message", decision: true },
      ),
    );
  }
  return frames;
}
export function operationFrames({
  before,
  after,
  action,
  mode,
  ok,
  keyLabel = "",
  dataLabel = "",
}) {
  const base = decisionFrame(after);
  const { speaker: oldSpeaker, text: oldText, ...visual } = base;
  const common = {
    ...visual,
    phase: after.phase,
    revealOutcome: false,
    at: "charlie",
  };
  if (action === "copy")
    return [
      frame(
        "charlie",
        `Charlieは、${englishNames(before.incoming.label)}を中継機の記録装置でコピーした。Charlieの持ち物に、コピーしたデータが加わった。`,
        "copy",
        {
          ...common,
          scene: "copy",
          at: "relay",
          kind: packetKind(before.incoming),
          copied: true,
        },
      ),
      frame(
        "narrator",
        "Charlieは、元のデータを中継機に残している。Charlieがデータをコピーする操作と、AliceやBobへ届ける操作は別の操作だ。",
        "copy",
        {
          ...common,
          scene: "copy",
          at: "relay",
          kind: packetKind(before.incoming),
          copied: true,
          decision: true,
        },
      ),
    ];
  if (action === "replace")
    return [
      frame(
        "charlie",
        after.outgoing
          ? `Charlieは、送信候補を${englishNames(after.outgoing.label)}に変更した。Charlieは、送信候補をまだ${after.phase === "public" ? "Alice" : "Bob"}へ転送していない。`
          : "Charlieは、送信候補を中継機に届いた元のデータに戻した。Charlieは、送信候補をまだ転送していない。",
        "replace",
        { ...common, scene: "replace", at: "relay", decision: true },
      ),
    ];
  if (!ok)
    return [
      frame(
        "charlie",
        mode === "decrypt"
          ? `Charlieは、${englishNames(keyLabel) || "選んだ鍵"}で選択したデータを復号できなかった。Charlieは、別のデータや鍵も試せる。`
          : "Charlieは、選択したデータと鍵の組み合わせでは操作できなかった。Charlieは、データと鍵を選び直せる。",
        "question",
        { ...common, scene: "question", decision: true },
      ),
    ];
  if (mode === "decrypt")
    return [
      frame(
        "charlie",
        after.decryptResult?.kind === "key"
          ? `Charlieは、${englishNames(keyLabel)}で共通鍵の暗号文を復号した。Charlieは、復号した共通鍵を持ち物に加えた。`
          : "Charlieは、選んだ共通鍵で本文の暗号文を復号した。Charlieは、復号した本文を読んだり、編集したりできる。",
        "decrypt",
        { ...common, scene: "decrypt", decision: true },
      ),
    ];
  if (mode === "wrap")
    return [
      frame(
        "charlie",
        `Charlieは、${englishNames(dataLabel)}を${englishNames(keyLabel)}で暗号化した。Charlieは、新しい共通鍵の暗号文をまだ転送していない。`,
        "wrap",
        { ...common, scene: "wrap", kind: "wrapped-key", decision: true },
      ),
    ];
  if (mode === "message")
    return [
      frame(
        "charlie",
        `Charlieは、作業台の本文を${englishNames(keyLabel)}で暗号化した。Charlieは、新しい本文の暗号文を送信候補に選べる。`,
        "edit",
        { ...common, scene: "edit", kind: "ciphertext", decision: true },
      ),
    ];
  return [
    frame(
      "charlie",
      "Charlieは、手元の暗号文の一部を書き換えた。Charlieは、書き換えた暗号文を送信候補に選べる。",
      "edit",
      { ...common, scene: "edit", decision: true },
    ),
  ];
}
export function createStoryPlayer() {
  let frames = [],
    index = 0,
    active = false;
  return {
    play(value) {
      // Keep a subject with its predicate even when the next sentence is long.
      frames = value.flatMap((frame) => {
        const sentences = frame.text.match(/[^。！？\n]+[。！？\n]?/gu) || [
          frame.text,
        ];
        const pages = [];
        for (const sentence of sentences) {
          const previous = pages.at(-1);
          if (previous && Array.from(previous + sentence).length <= 64)
            pages[pages.length - 1] += sentence;
          else pages.push(...paginateText(sentence, 64));
        }
        return pages.map((text) => ({ ...frame, text }));
      });
      index = 0;
      active = frames.length > 0;
    },
    current: () => (active ? frames[index] : null),
    active: () => active,
    position: () => ({ index, total: frames.length }),
    next() {
      if (!active) return;
      if (index + 1 < frames.length) index++;
      else active = false;
    },
    previous() {
      if (active && index > 0) index--;
    },
    skip() {
      active = false;
    },
  };
}
export { packetName };
