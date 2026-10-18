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
    certificate: "certificate",
    verify: "verify-key",
    symmetric: "key",
    envelope: "wrapped-key",
    ciphertext: "ciphertext",
  })[item?.type] || "none";
export const packetName = (kind) =>
  ({
    public: "公開鍵",
    certificate: "公開鍵証明書",
    "root-key": "ブラウザ内のCA公開鍵",
    "verify-key": "署名の検証用公開鍵",
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
export function caPreparationFrames(s) {
  const setup = (text, scene, at, kind, packetLabel, route) =>
    frame(text, scene, { at, kind, packetLabel, route, phase: "ca-setup" });
  const owner = s.round === 3 ? "Alice" : "Bob",
    at = owner.toLowerCase();
  return [
    setup(
      "AliceとBobのブラウザは、信頼済みのCA公開鍵を最初から持っている。",
      "trust-root",
      at,
      "root-key",
      "事前登録：CA公開鍵",
      "ブラウザに事前登録",
    ),
    ...(s.round === 2
      ? [
          setup(
            "CharlieはCAとの通信にも割り込める。ただし、Charlieはブラウザ内のCA公開鍵を変更できない。",
            "trust-root",
            "alice",
            "root-key",
            "事前登録：CA公開鍵",
            "ブラウザ内の鍵は変更不可",
          ),
        ]
      : []),
    setup(
      owner + "は、" + owner + "の公開鍵を添えて、CAに証明書の発行を申請した。",
      "ca-request",
      at,
      "public",
      owner + "の公開鍵",
      owner + " → CA",
    ),
    setup(
      "CAは" +
        owner +
        "の本人確認を行い、" +
        owner +
        "の名前と公開鍵にCAの署名を付けた。",
      "ca-issue",
      "ca",
      "certificate",
      owner + "の証明書",
      owner + " → CA",
    ),
    setup(
      "CAは、CA署名付きの" + owner + "の証明書を" + owner + "に返した。",
      "ca-response",
      at,
      "certificate",
      owner + "の証明書",
      "CA → " + owner,
    ),
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
  if (s.phase === "signing-public")
    return [
      ...caPreparationFrames(s),
      frame(
        "Aliceは、Aliceの検証用公開鍵を載せた証明書をBobへ送る。",
        "signing-key",
        {
          at: "alice",
          kind: "certificate",
          packetLabel: "Aliceの証明書",
          phase: "signing-public",
          route: "Alice → 中継機 → Bob",
        },
      ),
      frame(
        "Charlieの中継機にAliceの証明書が届いた。Bobは、CA署名とAliceという相手名を確認する。",
        "inbound",
        {
          kind: "certificate",
          packetLabel: "Aliceの証明書",
          phase: "signing-public",
          route: "Alice → 中継機 → Bob",
        },
      ),
    ];
  return [
    ...(s.round === 2 ? caPreparationFrames(s) : []),
    frame(
      s.ca
        ? "Bobは、Bobの公開鍵を載せたCA署名付き証明書をAliceへ送る。"
        : "Bobは、Bobの公開鍵をAliceへ送る。Aliceは、受け取った公開鍵で共通鍵を暗号化する。",
      "bob-public",
      {
        at: "bob",
        kind: s.ca ? "certificate" : "public",
        packetLabel: s.ca ? "Bobの証明書" : "Bobの公開鍵",
        phase: "public",
        route: "Bob → 中継機 → Alice",
      },
    ),
    frame(
      s.ca
        ? "Charlieの中継機が、BobからAliceへ向かう証明書を記録した。"
        : "Charlieの中継機が、BobからAliceへ向かう公開鍵を記録した。",
      "inbound",
      {
        kind: s.ca ? "certificate" : "public",
        packetLabel: s.ca ? "Bobの証明書" : "Bobの公開鍵",
        phase: "public",
        route: "Bob → 中継機 → Alice",
      },
    ),
  ];
}
export function outcomeFrame(s) {
  const text =
    {
      "attack-success": s.impersonating
        ? "Bobは、Charlieが作った偽の本文を、Aliceの本文として受け付けた。"
        : "Bobは、Charlieが書き換えた本文を受け付けた。",
      "original-accepted": "Bobは、Aliceが送った元の本文を受け付けた。",
      "bad-public": "Aliceは、届いたデータを公開鍵として使えず、通信を止めた。",
      "bad-verification-key":
        "Bobは、Aliceの証明書の検証に失敗し、Charlieの鍵を登録しなかった。",
      "bad-key": "Bobは、届いた暗号文から共通鍵を取り出せず、通信を止めた。",
      "bad-message": "Bobは、届いた本文の暗号文を復号できなかった。",
      "signature-rejected":
        "Bobは、Aliceの公開鍵で署名を検証できず、偽の本文を拒否した。",
      authenticated: "Aliceは、偽のBobの証明書を検出し、共通鍵を送らなかった。",
    }[s.result?.code] || "通信の結果を確認しよう。";
  return frame(text, s.result?.accepted ? "accept" : "reject", {
    at: ["authenticated", "bad-public"].includes(s.result?.code)
      ? "alice"
      : "bob",
    kind: packetKind(s.outgoing || s.incoming),
    phase: "done",
    revealOutcome: true,
  });
}
export function lesson(s) {
  return (
    {
      "attack-success":
        s.round === 2
          ? "CAが保証したのはBobの身元。Bobは送信者を確認していないため、Charlieの共通鍵と偽の本文を受け付けた。CharlieはAliceの本文を読めていない。"
          : s.round === 0
            ? "Charlieは平文で届いた共通鍵で本文を読み、書き換えた本文も暗号化できた。"
            : "Aliceが公開鍵の持ち主を確認しなかったため、Charlieは共通鍵を手に入れられた。",
      "original-accepted":
        s.round === 3
          ? "BobはCAで確認したAliceの公開鍵で署名を検証し、Aliceの本文を受け付けた。"
          : "Bobは正しい共通鍵でAliceの本文を復号できた。Charlieが本文を読めるかどうかとは別の結果だ。",
      "bad-public": "Aliceが共通鍵を暗号化するには、配送先の公開鍵が必要だ。",
      "bad-verification-key":
        "BobはCA署名とAliceという相手名を確認するので、Charlieの鍵をAliceの鍵として登録しない。",
      "bad-key":
        "Bobが共通鍵を取り出すには、Bobの公開鍵で暗号化された共通鍵が必要だ。",
      "bad-message":
        "Bobの共通鍵と、本文の暗号化に使った共通鍵が一致しなかった。共通鍵だけの差し替えでは、Aliceの暗号文は復号できない。",
      "signature-rejected":
        "Charlieの秘密鍵で作れるのはCharlieの署名。BobがCAで確認したAliceの公開鍵では検証できず、なりすましが見破られた。",
      authenticated:
        "Aliceは事前登録のCA公開鍵でCA署名とBobという相手名を確認する。Charlieの鍵へのすり替えは通用しない。",
    }[s.result?.code] || ""
  );
}
export function forwardFrames(before, after) {
  const signing = before.phase === "signing-public",
    recipient = before.phase === "public" ? "alice" : "bob";
  const frames = [
    frame(
      "Charlieは、中継機にある" +
        (signing
          ? "Aliceの証明書"
          : before.phase === "public"
            ? englishNames((before.outgoing || before.incoming).label)
            : before.phase === "key"
              ? "共通鍵のデータ"
              : "本文の暗号文") +
        "を" +
        (recipient === "alice" ? "Alice" : "Bob") +
        "へ転送した。",
      "delivering",
      {
        at: recipient,
        phase: before.phase,
        kind: packetKind(before.outgoing || before.incoming),
        packetLabel: englishNames((before.outgoing || before.incoming).label),
        route:
          before.phase === "public"
            ? "Bob → 中継機 → Alice"
            : "Alice → 中継機 → Bob",
      },
    ),
  ];
  if (after.result) {
    if (
      after.result.code === "authenticated" ||
      after.result.code === "bad-verification-key"
    )
      frames.push(
        frame(
          (signing ? "Bob" : "Alice") +
            "は、事前登録のCA公開鍵で証明書を検証した。偽の証明書のCA署名は正しくなかった。",
          "ca-verify",
          {
            at: recipient,
            phase: before.phase,
            kind: "certificate",
            packetLabel: "証明書の検証に失敗",
          },
        ),
      );
    if (
      after.round === 3 &&
      before.phase === "message" &&
      after.result.code !== "bad-message"
    )
      frames.push(
        frame(
          "Bobは、CAで確認したAliceの公開鍵で、届いた本文の電子署名を検証した。",
          "verify",
          { at: "bob", phase: "message", kind: "ciphertext" },
        ),
      );
    frames.push(outcomeFrame(after));
    return frames;
  }
  if (signing)
    return [
      ...frames,
      frame(
        "Bobは、CA署名とAliceという相手名を確認し、Aliceの検証用公開鍵を登録した。",
        "ca-verify",
        {
          at: "bob",
          phase: "signing-public",
          kind: "certificate",
          packetLabel: "確認済み：Aliceの証明書",
        },
      ),
      ...roundFrames(after),
    ];
  if (before.phase === "public")
    return [
      ...frames,
      ...(after.ca
        ? [
            frame(
              "Aliceは、事前登録のCA公開鍵でCA署名とBobという相手名を確認した。",
              "ca-verify",
              {
                at: "alice",
                phase: "public",
                kind: "certificate",
                packetLabel: "確認済み：Bobの証明書",
              },
            ),
          ]
        : []),
      frame(
        "Aliceは、" +
          englishNames(after.publicForAlice.label) +
          "でAliceの共通鍵を暗号化した。",
        "wrap",
        { at: "alice", kind: "wrapped-key", phase: "key" },
      ),
      frame(
        "Charlieの中継機が、AliceからBobへ向かう共通鍵の暗号文を記録した。",
        "inbound",
        { kind: "wrapped-key", phase: "key" },
      ),
    ];
  return [
    ...frames,
    frame(
      after.impersonating
        ? "Bobは、Bobの秘密鍵でCharlieの共通鍵を取り出した。Bobは、Charlieの鍵をAliceの鍵だと思っている。"
        : "Bobは、Aliceが使う共通鍵を受け取った。",
      "decrypt",
      {
        at: "bob",
        phase: "key",
        kind: "key",
        packetLabel: after.impersonating ? "Charlieの共通鍵" : "Aliceの共通鍵",
      },
    ),
    ...(after.round === 3
      ? [
          frame(
            "Aliceは、Aliceの秘密鍵で、本文に対応する電子署名を作った。",
            "sign",
            {
              at: "alice",
              kind: "letter",
              phase: "message",
              packetLabel: "Aliceの本文",
            },
          ),
        ]
      : []),
    frame(
      after.round === 3
        ? "Aliceは、本文とAliceの電子署名をAliceの共通鍵で暗号化した。"
        : "Aliceは、本文をAliceの共通鍵で暗号化した。",
      "encrypt",
      { at: "alice", kind: "ciphertext", phase: "message" },
    ),
    frame("Charlieの中継機が、Aliceの本文の暗号文を記録した。", "inbound", {
      kind: "ciphertext",
      phase: "message",
    }),
    ...(after.impersonating
      ? [
          frame(
            "Charlieの鍵はAliceの鍵とは別なので、CharlieはAliceの本文を読めない。Charlieは偽の本文を用意する。",
            "idea",
            { at: "charlie", kind: "ciphertext", phase: "message" },
          ),
        ]
      : []),
  ];
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
