import { paginateText } from "./screen-layout.mjs";
export const englishNames = (text) =>
  String(text ?? "")
    .replaceAll("アリス", "Alice")
    .replaceAll("ボブ", "Bob")
    .replaceAll("チャーリー", "Charlie");
export const frame = (text, scene = "intercept", extra = {}) => ({
  speaker: "narrator",
  text,
  scene,
  connected: true,
  at: "relay",
  kind: "none",
  ...extra,
});
export const packetKind = (item) =>
  ({
    public: "public",
    symmetric: "key",
    envelope: "wrapped-key",
    ciphertext: "ciphertext",
  })[item?.type] || "none";
export const packetName = (kind) =>
  ({
    public: "公開鍵",
    key: "共通鍵",
    "wrapped-key": "共通鍵の暗号文",
    ciphertext: "本文の暗号文",
    letter: "秘密のメッセージ",
    none: "",
  })[kind] || "";
export function introFrames() {
  return [
    frame("Aliceは、Bobに秘密のメッセージを送ろうとしている。", "direct", {
      connected: false,
      at: "alice",
      kind: "letter",
    }),
    frame("Charlieは、Aliceのメッセージを盗み見たい。", "watch", {
      connected: false,
      at: "alice",
      kind: "letter",
    }),
    frame(
      "Charlieは、Alice宅の外にある通信経路の中継機を操作できる。",
      "setup",
      { at: "none" },
    ),
    frame("Charlieの中継機は、通ったデータを自動で記録する。", "relay", {
      at: "none",
    }),
  ];
}
export function roundFrames(s) {
  if (s.round === 0)
    return [
      frame(
        "Aliceは、本文の暗号化に使う共通鍵を、平文でBobへ送った。",
        "alice-key",
        { at: "alice", kind: "key", phase: "key" },
      ),
      frame("Charlieの中継機が、Bobに届く前の共通鍵を記録した。", "inbound", {
        kind: "key",
        phase: "key",
      }),
    ];
  const text =
    s.round === 1
      ? "Bobは、Bobの公開鍵をAliceへ送る。Aliceは、受け取った公開鍵で共通鍵を暗号化する。"
      : s.round === 2
        ? "Bobは、Bobの公開鍵をAliceへ送る。今回、Aliceは本文に電子署名を付ける。"
        : s.authenticate
          ? "Bobは、Bobの公開鍵をAliceへ送る。Aliceは、その公開鍵を信頼済みの指紋と照合する。"
          : "Bobは、Bobの公開鍵をAliceへ送る。今回は、Aliceによる公開鍵の確認を外して比べる。";
  const frames = [
    frame(text, "bob-public", {
      at: "bob",
      kind: "public",
      packetLabel: "Bobの公開鍵",
      phase: "public",
      route: "Bob → 中継機 → Alice",
    }),
  ];
  frames.push(
    frame(
      "Bobは、Bobの公開鍵をAliceへ送った。Charlieの中継機が公開鍵を記録した。",
      "inbound",
      {
        kind: "public",
        packetLabel: "Bobの公開鍵",
        phase: "public",
        route: "Bob → 中継機 → Alice",
      },
    ),
  );
  return frames;
}
export function outcomeFrame(s) {
  const result = s.result;
  const text =
    {
      "attack-success": "Bobは、Charlieが書き換えた本文を受け付けた。",
      "original-accepted": s.read
        ? "Bobは、元の本文を受け付けた。Charlieは書き換えを行わなかった。"
        : "Bobは、Bobが持つ共通鍵で本文を復号し、受け付けた。",
      "bad-public": "Aliceは、届いたデータを公開鍵として使えず、通信を止めた。",
      "bad-key": "Bobは、届いた暗号文から共通鍵を取り出せず、通信を止めた。",
      "bad-message": "Bobは、届いた本文の暗号文を復号できなかった。",
      "signature-rejected":
        "Bobは、署名の検証に失敗し、書き換えられた本文を拒否した。",
      authenticated:
        "Aliceは、公開鍵のすり替えを検出し、共通鍵を送らなかった。",
    }[result?.code] || "通信の結果を確認しよう。";
  return frame(text, result?.accepted ? "accept" : "reject", {
    at: ["authenticated", "bad-public"].includes(result?.code)
      ? "alice"
      : "bob",
    kind: packetKind(s.incoming),
    phase: "done",
    revealOutcome: true,
  });
}
export function lesson(s) {
  return (
    {
      "attack-success":
        s.round === 0
          ? "Charlieは、記録した共通鍵で本文を読み、書き換えた本文も暗号化できた。"
          : "Aliceが公開鍵の持ち主を確認しなかったため、Charlieは共通鍵を手に入れられた。",
      "original-accepted": s.read
        ? "Charlieは盗聴に成功した。次は、本文を書き換えた場合と比べよう。"
        : "Bobは正しい共通鍵を持っている。Charlieの手元の鍵で開けないことと、Bobが受信できることは別。",
      "bad-public": "Aliceが共通鍵を暗号化するには、配送先の公開鍵が必要。",
      "bad-key":
        "Bobが共通鍵を取り出せるのは、Bobの公開鍵で暗号化された暗号文。",
      "bad-message": "Bobが復号するには、本文の暗号化に使われた共通鍵が必要。",
      "signature-rejected":
        "Charlieは本文を読めても、Aliceの署名を作り直せない。電子署名が本文の変更を検出した。",
      authenticated:
        "AliceがBobの公開鍵を確認すると、Charlieへの共通鍵の漏えいも防げる。",
    }[s.result?.code] || ""
  );
}
export function forwardFrames(before, after) {
  const recipient = before.phase === "public" ? "alice" : "bob";
  const frames = [
    frame(
      "Charlieは、データを" +
        (recipient === "alice" ? "Alice" : "Bob") +
        "へ届けた。",
      "delivering",
      {
        at: recipient,
        phase: before.phase,
        kind: packetKind(before.outgoing || before.incoming),
        ...(before.phase === "public"
          ? {
              packetLabel: englishNames(
                (before.outgoing || before.incoming).label,
              ),
              route: "Bob → 中継機 → Alice",
            }
          : {}),
      },
    ),
  ];
  if (after.result) {
    if (
      after.round >= 2 &&
      before.phase === "message" &&
      after.result.code !== "bad-message"
    )
      frames.push(
        frame(
          "Bobは、信頼済みのAliceの公開鍵で、届いた本文の署名を検証した。",
          "verify",
          { at: "bob", phase: "message", kind: "ciphertext" },
        ),
      );
    frames.push(outcomeFrame(after));
  } else if (before.phase === "public") {
    frames.push(
      frame(
        "Aliceは、" +
          englishNames(after.publicForAlice.label) +
          "で共通鍵を暗号化した。",
        "wrap",
        {
          at: "alice",
          kind: "key",
          phase: "key",
        },
      ),
      frame("Charlieの中継機が、共通鍵の暗号文を記録した。", "inbound", {
        kind: "wrapped-key",
        phase: "key",
      }),
    );
  } else {
    if (after.round >= 2)
      frames.push(
        frame(
          "Aliceは、Aliceの秘密鍵を使って、本文に対応する電子署名を作った。",
          "sign",
          {
            at: "alice",
            kind: "letter",
            phase: "message",
            packetLabel: "送信前の本文",
          },
        ),
      );
    frames.push(
      frame(
        after.round >= 2
          ? "Aliceは、本文とAliceの署名を共通鍵で暗号化した。"
          : "Aliceは、本文を共通鍵で暗号化した。",
        "encrypt",
        { at: "alice", kind: "ciphertext", phase: "message" },
      ),
      frame("Charlieの中継機が、本文の暗号文を記録した。", "inbound", {
        kind: "ciphertext",
        phase: "message",
      }),
    );
  }
  return frames;
}
export function createStoryPlayer() {
  let frames = [],
    index = 0,
    active = false;
  return {
    play(value) {
      frames = value.flatMap((f) => {
        const pages = [];
        for (const sentence of f.text.match(/[^。！？\n]+[。！？\n]?/gu) || [
          f.text,
        ]) {
          if (pages.length && Array.from(pages.at(-1) + sentence).length <= 64)
            pages[pages.length - 1] += sentence;
          else pages.push(...paginateText(sentence, 64));
        }
        return pages.map((text) => ({ ...f, text }));
      });
      index = 0;
      active = frames.length > 0;
    },
    current: () => (active ? frames[index] : null),
    active: () => active,
    position: () => ({ index, total: frames.length }),
    checkpoint: () => ({
      frames: frames.map((f) => ({ ...f })),
      index,
      active,
    }),
    restore(value) {
      frames = value.frames.map((f) => ({ ...f }));
      index = value.index;
      active = value.active;
    },
    next() {
      if (active && index + 1 < frames.length) index++;
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
