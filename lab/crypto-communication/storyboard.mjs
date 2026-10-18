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
export function caPreparationFrames(s, owner = "Alice") {
  const at = owner.toLowerCase(),
    certificate = s.ca[at + "Certificate"];
  const registered = owner + "のCA登録済の公開鍵";
  const raw = {
    type: "public",
    owner: at,
    label: owner + "の公開鍵",
    fingerprint: certificate.fingerprint,
  };
  const setup = (text, scene, location, packet, route) =>
    frame(text, scene, {
      at: location,
      kind: packetKind(packet),
      packet,
      packetLabel: packet.label,
      route,
      phase: "ca-setup",
      stage: owner === "Alice" ? 0 : 1,
    });
  return [
    ...(owner === "Alice"
      ? [
          frame(
            "AliceとBobのブラウザは、信頼済みのCA自身の公開鍵を最初から持っている。",
            "trust-root",
            {
              at: "none",
              kind: "none",
              packet: s.ca.root,
              packetLabel: "ブラウザ内のCA公開鍵",
              route: "ブラウザ内の信頼設定",
              phase: "ca-setup",
            },
          ),
        ]
      : []),
    ...(owner === "Alice" && s.round === 2
      ? [
          frame(
            "CharlieはCAとの通信にも介入できるが、Charlieはブラウザ内のCA公開鍵を変更できない。",
            "trust-root",
            {
              at: "none",
              kind: "none",
              packet: s.ca.root,
              packetLabel: "ブラウザ内のCA公開鍵",
              route: "ブラウザ内の信頼設定",
              phase: "ca-setup",
            },
          ),
        ]
      : []),
    setup(
      owner + "は、" + owner + "の公開鍵を添えて、CAに証明書の発行を申請した。",
      "ca-request",
      at,
      raw,
      owner + " → CA",
    ),
    setup(
      "CAは" +
        owner +
        "の本人確認を行い、" +
        owner +
        "の名前と公開鍵にCAの署名を付けた。",
      "ca-issue",
      "ca-" + at,
      certificate,
      "CAで" + owner + "の鍵を登録",
    ),
    setup(
      "CAは、" +
        registered +
        "を" +
        owner +
        "に返した。これはCAの署名が付いた証明書だ。",
      "ca-response",
      "ca-" + at,
      certificate,
      "CA → " + owner,
    ),
    setup(
      owner + "は、" + registered + "を受け取った。",
      "ca-return",
      at,
      certificate,
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
        { at: "alice", kind: "key", packet: s.incoming, phase: "key" },
      ),
      frame("Charlieの中継機が、Bobに届く前の共通鍵を記録した。", "inbound", {
        kind: "key",
        packet: s.incoming,
        phase: "key",
      }),
    ];
  if (s.phase === "signing-public")
    return [
      ...caPreparationFrames(s, "Alice"),
      frame("Aliceは、AliceのCA登録済の公開鍵をBobへ送った。", "signing-key", {
        at: "alice",
        kind: "certificate",
        packet: s.incoming,
        packetLabel: "AliceのCA登録済の公開鍵",
        phase: "signing-public",
        route: "Alice → 中継機 → Bob",
      }),
      frame(
        "Charlieの中継機が、AliceのCA登録済の公開鍵を記録した。Bobにはまだ届いていない。",
        "inbound",
        {
          kind: "certificate",
          packet: s.incoming,
          packetLabel: "AliceのCA登録済の公開鍵",
          phase: "signing-public",
          route: "Alice → 中継機 → Bob",
        },
      ),
    ];
  return [
    ...(s.ca ? caPreparationFrames(s, "Bob") : []),
    frame(
      s.ca
        ? "Bobは、BobのCA登録済の公開鍵をAliceへ送った。"
        : "Bobは、Bobの公開鍵をAliceへ送った。",
      "bob-public",
      {
        at: "bob",
        kind: packetKind(s.incoming),
        packet: s.incoming,
        packetLabel: s.ca ? "BobのCA登録済の公開鍵" : "Bobの公開鍵",
        phase: "public",
        route: "Bob → 中継機 → Alice",
      },
    ),
    frame(
      s.ca
        ? "Charlieの中継機が、BobのCA登録済の公開鍵を記録した。Aliceにはまだ届いていない。"
        : "Charlieの中継機が、BobからAliceへ向かう公開鍵を記録した。",
      "inbound",
      {
        kind: packetKind(s.incoming),
        packet: s.incoming,
        packetLabel: s.ca ? "BobのCA登録済の公開鍵" : "Bobの公開鍵",
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
        "Bobは、AliceのCA登録済の公開鍵が偽物だと分かり、Charlieの鍵を登録しなかった。",
      "bad-key": "Bobは、届いた暗号文から共通鍵を取り出せず、通信を止めた。",
      "bad-message": "Bobは、届いた本文の暗号文を復号できなかった。",
      "signature-rejected":
        "Bobは、Aliceの公開鍵で署名を検証できず、偽の本文を拒否した。",
      authenticated:
        "Aliceは、BobのCA登録済の公開鍵が偽物だと分かり、共通鍵を送らなかった。",
    }[s.result?.code] || "通信の結果を確認しよう。";
  const packet = s.outgoing || s.incoming;
  return frame(text, s.result?.accepted ? "accept" : "reject", {
    at: ["authenticated", "bad-public"].includes(s.result?.code)
      ? "alice"
      : "bob",
    kind: packetKind(packet),
    packet,
    signatureOwner:
      s.round === 3 && packet.type === "ciphertext"
        ? s.deliveredSignature?.owner || null
        : null,
    stage: [
      "bad-verification-key",
      "authenticated",
      "bad-public",
      "bad-key",
    ].includes(s.result?.code)
      ? s.result.code === "bad-verification-key"
        ? 0
        : ["authenticated", "bad-public"].includes(s.result.code)
          ? s.round >= 2
            ? 1
            : 0
          : s.round >= 2
            ? 2
            : s.round === 0
              ? 0
              : 1
      : undefined,
    route: ["authenticated", "bad-public"].includes(s.result?.code)
      ? "Bob → 中継機 → Alice"
      : "Alice → 中継機 → Bob",
    phase: "done",
    revealOutcome: true,
  });
}
export function lesson(s) {
  return (
    {
      "attack-success":
        s.round === 2
          ? "CAで公開鍵を確認しても、Bobは届いた本文の署名を確かめていない。Charlieの共通鍵と偽の本文が受け付けられた。CharlieはAliceの本文を読めていない。"
          : s.round === 0
            ? "Charlieは平文で届いた共通鍵で本文を読み、書き換えた本文も暗号化できた。"
            : "Aliceが公開鍵の持ち主を確認しなかったため、Charlieは共通鍵を手に入れられた。",
      "original-accepted":
        s.round === 3
          ? "BobはCAで確認したAliceの公開鍵で署名を検証し、Aliceの本文を受け付けた。"
          : "Bobは正しい共通鍵でAliceの本文を復号した。Charlieは元の暗号文をそのまま送った。",
      "bad-public": "Aliceが共通鍵を暗号化するには、配送先の公開鍵が必要だ。",
      "bad-verification-key":
        "Bobはブラウザ内のCA公開鍵でCA署名とAliceの名前を確認するので、Charlieの鍵への取り替えを検出した。",
      "bad-key":
        "Bobが共通鍵を取り出すには、Bobの公開鍵で暗号化された共通鍵が必要だ。",
      "bad-message":
        "Bobが持つ共通鍵と、Aliceが本文の暗号化に使った共通鍵が違った。共通鍵だけの差し替えでは、Aliceの暗号文は復号できない。",
      "signature-rejected":
        "Charlieの秘密鍵で作れるのはCharlieの署名。BobがCAで確認したAliceの公開鍵では検証できず、なりすましが見破られた。",
      authenticated:
        "Aliceはブラウザ内のCA公開鍵でCA署名とBobの名前を確認するため、Charlieの鍵への取り替えを検出した。",
    }[s.result?.code] || ""
  );
}
export function forwardFrames(before, after) {
  const signing = before.phase === "signing-public",
    recipient = before.phase === "public" ? "alice" : "bob";
  const packet = before.outgoing || before.incoming;
  const signatureOwner =
    before.round === 3 && packet.type === "ciphertext"
      ? before.outgoing
        ? before.outgoingSignature?.owner || null
        : "alice"
      : null;
  const frames = [
    frame(
      "Charlieは、" +
        englishNames(packet.label) +
        "を" +
        (recipient === "alice" ? "Alice" : "Bob") +
        "へ転送した。",
      "delivering",
      {
        at: recipient,
        phase: before.phase,
        kind: packetKind(packet),
        packet,
        packetLabel: englishNames(packet.label),
        signatureOwner,
        route:
          before.phase === "public"
            ? "Bob → 中継機 → Alice"
            : "Alice → 中継機 → Bob",
      },
    ),
  ];
  if (after.result) {
    if (["authenticated", "bad-verification-key"].includes(after.result.code))
      frames.push(
        frame(
          (signing ? "Bob" : "Alice") +
            "は、ブラウザ内のCA公開鍵でCA署名と相手の名前を確認し、鍵の取り替えを検出した。",
          "ca-verify",
          {
            at: recipient,
            phase: before.phase,
            kind: "certificate",
            packet,
            packetLabel: "CA署名の検証に失敗",
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
          {
            at: "bob",
            phase: "message",
            kind: "ciphertext",
            packet,
            signatureOwner,
          },
        ),
      );
    frames.push(outcomeFrame(after));
    return frames;
  }
  if (signing)
    return [
      ...frames,
      frame(
        "Bobは、ブラウザ内のCA公開鍵でCA署名とAliceの名前を確認し、Aliceの公開鍵を保存した。",
        "ca-verify",
        {
          at: "bob",
          phase: "signing-public",
          kind: "certificate",
          packet,
          packetLabel: "AliceのCA登録済の公開鍵",
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
              "Aliceは、ブラウザ内のCA公開鍵でCA署名とBobの名前を確認した。",
              "ca-verify",
              {
                at: "alice",
                phase: "public",
                kind: "certificate",
                packet,
                packetLabel: "BobのCA登録済の公開鍵",
              },
            ),
          ]
        : []),
      frame(
        "Aliceは、" +
          (after.ca
            ? "BobのCA登録済の公開鍵"
            : englishNames(after.publicForAlice.label)) +
          "でAliceの共通鍵を暗号化した。",
        "wrap",
        {
          at: "alice",
          kind: "wrapped-key",
          packet: after.incoming,
          phase: "key",
        },
      ),
      frame("Charlieの中継機が、Aliceの共通鍵の暗号文を記録した。", "inbound", {
        kind: "wrapped-key",
        packet: after.incoming,
        phase: "key",
      }),
    ];
  return [
    ...frames,
    frame(
      after.impersonating
        ? "Bobは、Bobの秘密鍵でCharlieの共通鍵を取り出した。Bobは、Aliceが共通鍵を送ったと思っている。"
        : before.round === 0
          ? "Bobは、Aliceの共通鍵を受け取った。"
          : "Bobは、Bobの秘密鍵でAliceの共通鍵を取り出した。",
      "decrypt",
      {
        at: "bob",
        phase: "key",
        kind: "key",
        packet: after.impersonating
          ? after.attackerKey
          : { label: "Aliceの共通鍵" },
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
              packet: { label: "Aliceの本文" },
              signatureOwner: "alice",
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
      {
        at: "alice",
        kind: "ciphertext",
        packet: after.incoming,
        signatureOwner: after.round === 3 ? "alice" : null,
        phase: "message",
      },
    ),
    frame("Charlieの中継機が、Aliceの本文の暗号文を記録した。", "inbound", {
      kind: "ciphertext",
      packet: after.incoming,
      signatureOwner: after.round === 3 ? "alice" : null,
      phase: "message",
    }),
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
