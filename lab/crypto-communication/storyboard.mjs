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
  const setup = (text, scene, at, kind, label, route) =>
    frame(text, scene, {
      at,
      kind,
      packetLabel: label,
      route,
      phase: "ca-setup",
    });
  return [
    setup(
      "AliceとBobのブラウザは、信頼済みのCA公開鍵を最初から持っている。",
      "trust-root",
      "alice",
      "root-key",
      "事前登録：CA公開鍵",
      "ブラウザに事前登録",
    ),
    setup(
      "CharlieはCAとの通信にも割り込める。しかし、Charlieはブラウザ内のCA公開鍵を変更できない。",
      "trust-root",
      "alice",
      "root-key",
      "事前登録：CA公開鍵",
      "ブラウザ内の鍵は変更不可",
    ),
    setup(
      "Aliceは、Aliceの検証用公開鍵を添えて、CAに証明書の発行を申請した。",
      "ca-request",
      "alice",
      "verify-key",
      "Aliceの検証用公開鍵",
      "Alice → CA",
    ),
    setup(
      "CAはAliceの本人確認を行い、Aliceの名前と公開鍵にCAの署名を付けた。",
      "ca-issue",
      "ca",
      "certificate",
      "Aliceの証明書",
      "Alice → CA",
    ),
    setup(
      "CAは、CA署名付きのAliceの証明書をAliceに返した。",
      "ca-response",
      "alice",
      "certificate",
      "Aliceの証明書",
      "CA → Alice",
    ),
    setup(
      "Aliceは、Aliceの証明書をBobへ送った。",
      "ca-response",
      "bob",
      "certificate",
      "Aliceの証明書",
      "Alice → Bob",
    ),
    setup(
      "Bobのブラウザは、事前登録のCA公開鍵でCA署名を検証し、証明書の相手名がAliceかも確認した。",
      "ca-verify",
      "bob",
      "certificate",
      "確認済み：Aliceの証明書",
      "Bobのブラウザで検証",
    ),
    setup(
      "Bobも、Bobの公開鍵を添えて、CAに証明書の発行を申請した。",
      "ca-request",
      "bob",
      "public",
      "Bobの公開鍵",
      "Bob → CA",
    ),
    setup(
      "CAはBobの本人確認を行い、Bobの名前と公開鍵にCAの署名を付けた。",
      "ca-issue",
      "ca",
      "certificate",
      "Bobの証明書",
      "Bob → CA",
    ),
    setup(
      "CAは、CA署名付きのBobの証明書をBobに返した。",
      "ca-response",
      "bob",
      "certificate",
      "Bobの証明書",
      "CA → Bob",
    ),
    setup(
      "CharlieはCAの秘密鍵を持たないため、Charlieの偽証明書はCA署名の検証を通せない。",
      "ca-issue",
      "ca",
      "certificate",
      "CAの署名で保証",
      "証明書の発行は通信前の準備",
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
      frame(
        "Aliceは、Aliceの署名をBobが確かめるため、検証用公開鍵をBobへ送った。",
        "signing-key",
        {
          at: "alice",
          kind: "verify-key",
          packetLabel: "Aliceの検証用公開鍵",
          phase: "signing-public",
          route: "Alice → 中継機 → Bob",
        },
      ),
      frame(
        "Charlieの中継機に、Aliceの検証用公開鍵が届いた。Bobにはまだ届いていない。",
        "inbound",
        {
          at: "relay",
          kind: "verify-key",
          packetLabel: "Aliceの検証用公開鍵",
          phase: "signing-public",
          route: "Alice → 中継機 → Bob",
        },
      ),
    ];
  const text =
    s.round === 1
      ? "Bobは、Bobの公開鍵をAliceへ送る。Aliceは、受け取った公開鍵で共通鍵を暗号化する。"
      : s.round === 2
        ? "Bobは、Bobの公開鍵をAliceへ送る。今回、Aliceは本文に電子署名を付ける。"
        : s.authenticate
          ? "Bobは、CA署名付きのBobの証明書をAliceへ送る。Aliceは、CA署名と証明書の相手名を検証する。"
          : "Bobは、Bobの証明書をAliceへ送る。今回は、Aliceによる証明書の検証を外して比べる。";
  const verification =
    s.round === 3
      ? caPreparationFrames(s)
      : s.round >= 2 && s.authenticateSigner
        ? [
            frame(
              "Aliceは、Aliceの署名をBobが確かめるために、検証用公開鍵をBobへ送る。",
              "signing-key",
              {
                at: "alice",
                kind: "verify-key",
                packetLabel: "Aliceの検証用公開鍵",
                phase: "signing-setup",
                route: "Alice → 中継機 → Bob",
              },
            ),
            frame(
              s.authenticateSigner
                ? "Charlieの中継機が、Aliceの検証用公開鍵を記録した。"
                : "Charlieは、Aliceの検証用公開鍵をCharlieの検証用公開鍵にすり替えた。",
              "signing-key",
              {
                at: "relay",
                kind: "verify-key",
                packetLabel: s.authenticateSigner
                  ? "Aliceの検証用公開鍵"
                  : "Charlieの検証用公開鍵",
                phase: "signing-setup",
                route: "Alice → 中継機 → Bob",
              },
            ),
            frame(
              s.authenticateSigner
                ? "Bobは、届いた鍵を、別の信頼できる経路で確認済みのAliceの鍵の指紋と照合した。"
                : "Bobは、持ち主を確かめずに、Charlieの公開鍵をAliceの検証用公開鍵として登録した。",
              "trust-signing-key",
              {
                at: "bob",
                kind: "verify-key",
                packetLabel: s.authenticateSigner
                  ? "Aliceの検証用公開鍵"
                  : "Charlieの検証用公開鍵",
                phase: "signing-setup",
                route: "Alice → 中継機 → Bob",
              },
            ),
            ...(s.authenticateSigner
              ? [
                  frame(
                    "Bobは、指紋が一致したAliceの検証用公開鍵を登録した。すり替えた鍵なら指紋が一致しない。",
                    "trust-signing-key",
                    {
                      at: "bob",
                      kind: "verify-key",
                      packetLabel: "確認済み：Aliceの鍵",
                      phase: "signing-setup",
                      route: "Alice → 中継機 → Bob",
                    },
                  ),
                ]
              : []),
          ]
        : [];
  const frames = [
    ...verification,
    frame(text, "bob-public", {
      at: "bob",
      kind: s.round === 3 ? "certificate" : "public",
      packetLabel: s.round === 3 ? "Bobの証明書" : "Bobの公開鍵",
      phase: "public",
      route: "Bob → 中継機 → Alice",
    }),
  ];
  frames.push(
    frame(
      s.round === 3
        ? "Bobは、Bobの証明書をAliceへ送った。Charlieの中継機が証明書を記録した。"
        : "Bobは、Bobの公開鍵をAliceへ送った。Charlieの中継機が公開鍵を記録した。",
      "inbound",
      {
        kind: s.round === 3 ? "certificate" : "public",
        packetLabel: s.round === 3 ? "Bobの証明書" : "Bobの公開鍵",
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
      "bad-verification-key":
        "Bobは、届いたデータを署名の検証に使えず、通信を止めた。",
      "bad-key": "Bobは、届いた暗号文から共通鍵を取り出せず、通信を止めた。",
      "bad-message": "Bobは、届いた本文の暗号文を復号できなかった。",
      "signature-rejected":
        "Bobは、署名の検証に失敗し、書き換えられた本文を拒否した。",
      authenticated:
        "Aliceは、CA署名や相手名が正しくない証明書を検出し、共通鍵を送らなかった。",
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
        s.round >= 2 && s.verificationForBob?.owner === "charlie"
          ? "Bobが検証用公開鍵の持ち主を確認しなかったため、Charlieの署名がAliceの署名として受理された。"
          : s.round === 0
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
        s.verificationForBob?.owner === "charlie"
          ? "Aliceの元の署名は新しい本文に対応しない。Bobが登録したCharlieの公開鍵と対になる秘密鍵で、新しい署名が必要。"
          : "Charlieは本文を読めても、Aliceの署名を作り直せない。電子署名が本文の変更を検出した。",
      authenticated:
        "Aliceが証明書のCA署名とBobという相手名を確認すると、Charlieへの共通鍵の漏えいも防げる。",
    }[s.result?.code] || ""
  );
}
export function forwardFrames(before, after) {
  if (before.phase === "signing-public") {
    const registered = englishNames(
      after.verificationForBob?.label || "公開鍵",
    );
    if (after.result) return [outcomeFrame(after)];
    return [
      frame("Charlieは、" + registered + "をBobへ届けた。", "delivering", {
        at: "bob",
        kind: "verify-key",
        packetLabel: registered,
        phase: "signing-public",
        route: "Alice → 中継機 → Bob",
      }),
      frame(
        "Bobは、届いた" + registered + "をAliceの署名の検証用として登録した。",
        "trust-signing-key",
        {
          at: "bob",
          kind: "verify-key",
          packetLabel: registered,
          phase: "signing-public",
          route: "Alice → 中継機 → Bob",
        },
      ),
      ...roundFrames(after),
    ];
  }
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
    if (after.result.code === "authenticated")
      frames.push(
        frame(
          "Aliceのブラウザは、事前登録のCA公開鍵でCA署名を検証し、証明書の相手名がBobかも確かめた。",
          "ca-verify",
          {
            at: "alice",
            phase: "public",
            kind: "certificate",
            packetLabel: "証明書の検証に失敗",
          },
        ),
      );
    if (
      after.round >= 2 &&
      before.phase === "message" &&
      after.result.code !== "bad-message"
    )
      frames.push(
        frame(
          after.verificationForBob?.owner === "alice"
            ? "Bobは、登録したAliceの検証用公開鍵で、届いた本文の署名を検証した。"
            : "Bobは、Aliceの鍵だと信じたCharlieの公開鍵で、届いた本文の署名を検証した。",
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
