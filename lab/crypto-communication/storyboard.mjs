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
        goal: "二人の通信が、どう始まるか見てみよう。",
        caption: "AliceからBobへ、秘密の通信",
      },
    ),
    frame(
      "alice",
      "Bobにだけ読んでもらいたいメッセージがあるの。中身は、まだ秘密。",
      "direct",
      {
        connected: false,
        at: "alice",
        kind: "letter",
        goal: "二人の通信が、どう始まるか見てみよう。",
      },
    ),
    frame(
      "charlie",
      "その本文を盗み見て、「I hate you.」にすり替えたい。Bobに本物だと思って受け取らせるぞ。",
      "watch",
      {
        connected: false,
        at: "alice",
        kind: "letter",
        goal: "本文を盗み見て、書き換えた文をBobに受理させる。",
      },
    ),
    frame(
      "narrator",
      "Charlieは、Aliceの家の外にある通信経路上の中継機を操作できるようにした。ここからは、その状態を仮定した実験だ。",
      "setup",
      { at: "none", caption: "Alice側の回線 → 中継機 → Bob側の回線" },
    ),
    frame(
      "charlie",
      "ここを通るデータなら、記録装置にコピーできる。相手へ送り出すデータを、別のものに入れ替えることもできる。",
      "relay",
      { at: "none" },
    ),
    frame(
      "narrator",
      "ただし、AliceやBobの秘密鍵は盗めない。暗号文をコピーしても、中身が読めるとは限らない。",
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
        "Round 1。Aliceは、同じ鍵で暗号化と復号をする「共通鍵暗号方式」を使う。",
        "alice-key",
        { at: "alice", kind: "key", phase: "key" },
      ),
      frame(
        "alice",
        "この共通鍵で本文を暗号化するよ。Bobにも同じ鍵が必要だから、まず鍵を届けよう。",
        "alice-key",
        { at: "alice", kind: "key", phase: "key" },
      ),
      frame(
        "narrator",
        "Aliceは、共通鍵を暗号化せずに送り出した。鍵は通信経路を進み、Charlieの中継機まで来た。",
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
        "共通鍵が到着した。Bobにはまだ届いていない。ここで時間を止めて、何をするか選ぼう。",
        "intercept",
        { kind: "key", phase: "key", decision: true },
      ),
    ];
  const frames = [];
  if (s.round === 1)
    frames.push(
      frame(
        "narrator",
        "Round 2。今度はBobの公開鍵で共通鍵を包む。本文そのものは、前と同じく共通鍵で暗号化する。",
        "relay",
        { at: "none", phase: "public" },
      ),
    );
  if (s.round === 2)
    frames.push(
      frame(
        "alice",
        "Round 3。今度は本文に、私の秘密鍵で電子署名を付けるよ。署名と本文を、一緒に共通鍵で暗号化するの。",
        "sign",
        { at: "alice", kind: "letter", phase: "public" },
      ),
      frame(
        "bob",
        "署名の検証には、信頼できる経路で確認したAliceの公開鍵を使うよ。共通鍵の届け方は、前のラウンドと同じ。",
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
          ? "追加実験。Bobの公開鍵を使う前に、持ち主も確かめよう。信頼済みの鍵の指紋と照合するよ。"
          : "追加実験。今回は公開鍵の持ち主の確認をオフにして、結果を比べてみよう。",
        "authenticate",
        { at: "alice", kind: "public", phase: "public" },
      ),
    );
  frames.push(
    frame(
      "bob",
      "まず、僕の公開鍵をAliceに送るね。対になる秘密鍵は、僕の手元から出さない。",
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
      "Bobが送った公開鍵が、Charlieの中継機に到着した。まだAliceには届いていない。",
      "inbound",
      { kind: "public", phase: "public", route: "Bob → 中継機 → Alice" },
    ),
    frame(
      "charlie",
      "今回は公開鍵から始まるのか。どのデータを残し、どれを届けるか。ここからは自由に試してみよう。",
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
        ? "公開鍵が中継機で止まっている。Aliceへ何を届けるか、行動を選ぼう。"
        : phase === "key"
          ? "鍵の配送が中継機で止まっている。手元に記録したり、道具で調べたりしてみよう。"
          : "本文の暗号文が中継機で止まっている。鍵やデータをどう使うか、自由に試そう。";
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
      `Charlieが送り出した${englishNames(sent.label)}が、${who}に届いた。`,
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
          "受け取った公開鍵の指紋を、信頼済みのBobの指紋と比べよう。……一致しない！ この鍵は使わないよ。",
          "authenticate",
          { at: "alice", kind, phase: "public" },
        ),
      );
    else if (after.result.code === "bad-public")
      frames.push(
        frame(
          "alice",
          "これは公開鍵として使えない。共通鍵を包めないから、通信を中断するね。",
          "reject",
          { at: "alice", kind, phase: "public" },
        ),
      );
    else if (after.result.code === "bad-key")
      frames.push(
        frame(
          "bob",
          before.round === 0
            ? "これは共通鍵として使えないデータだ。このままでは本文を開けないよ。"
            : "届いたデータから共通鍵を取り出せない。僕の秘密鍵では、この封筒を開けられないようだ。",
          "decrypt",
          { at: "bob", kind, phase: "key" },
        ),
      );
    else {
      frames.push(
        frame(
          "bob",
          "本文の暗号文が届いた。配送された共通鍵で、復号してみよう。",
          "decrypt",
          { at: "bob", kind, phase: "message" },
        ),
      );
      if (after.round >= 2 && after.result.code !== "bad-message")
        frames.push(
          frame(
            "bob",
            "次は署名を確認する。信頼済みのAliceの公開鍵で、この本文と署名が一致するか検証するよ。",
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
        ? "共通鍵を知っていても、Aliceの秘密鍵で新しい署名を作ることはできない。盗聴と改ざんの結果が分かれた。"
        : after.result.code === "authenticated"
          ? "Aliceは共通鍵を送る前に止まった。通信相手の公開鍵を確かめることで、鍵のすり替えによる盗聴を防げる。"
          : after.result.code === "attack-success"
            ? after.round === 0
              ? "共通鍵を経路上で知られたため、本文を読むだけでなく、別の本文を暗号化して送ることもできた。"
              : "暗号化していても、公開鍵の持ち主を確かめないと、別人の鍵にすり替えられることがある。"
            : "どこまでできたか、結果を見比べよう。同じラウンドをやり直すと、新しい共通鍵で再実験できる。";
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
        "公開鍵を受け取った。この鍵で、今回の共通鍵を暗号化してBobへ送ろう。",
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
        "Aliceは、共通鍵を公開鍵で包んだ。その暗号文が、Charlieの中継機まで来た。",
        "inbound",
        { kind: "wrapped-key", phase: "key", route: "Alice → 中継機 → Bob" },
      ),
      frame(
        "charlie",
        "今度は共通鍵が暗号化されている。コピーするだけでは読めない。手元の鍵で何ができるか、試してみよう。",
        "intercept",
        { kind: "wrapped-key", phase: "key", decision: true },
      ),
    );
  else if (before.phase === "key") {
    frames.push(
      frame(
        "bob",
        "配送された共通鍵を受け取ったよ。これで届いた本文を復号するつもりだ。",
        "bob-key",
        { at: "bob", kind: "key", phase: "message" },
      ),
    );
    if (after.round >= 2)
      frames.push(
        frame(
          "alice",
          "本文に私の秘密鍵で電子署名を付ける。これで、署名した後に本文が変わっていないか確かめられるよ。",
          "sign",
          { at: "alice", kind: "letter", phase: "message" },
        ),
      );
    frames.push(
      frame(
        "alice",
        after.round >= 2
          ? "本文と署名を、共通鍵で暗号化した。これをBobへ送ろう。"
          : "本文を共通鍵で暗号化したよ。次は、本文の暗号文をBobへ送るね。",
        "encrypt",
        { at: "alice", kind: "ciphertext", phase: "message" },
      ),
      frame(
        "narrator",
        "本文の暗号文が、Charlieの中継機に到着した。Bobにはまだ届いていない。",
        "inbound",
        { kind: "ciphertext", phase: "message" },
      ),
      frame(
        "charlie",
        "本文の暗号文を受け取った。中身は、復号に成功するまで秘密。さて、どうする？",
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
        `${englishNames(before.incoming.label)}を、中継機の記録装置でコピーした。手元に同じデータが残ったぞ。`,
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
        "元のデータは中継機に残ったまま。コピーすることと、相手へ届けることは別の操作だ。",
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
          ? `次に送るものを、${englishNames(after.outgoing.label)}に入れ替えた。まだ相手には届いていない。`
          : "送るデータを、元のものに戻した。",
        "replace",
        { ...common, scene: "replace", at: "relay", decision: true },
      ),
    ];
  if (!ok)
    return [
      frame(
        "charlie",
        mode === "decrypt"
          ? `このデータは、${englishNames(keyLabel) || "選んだ鍵"}では開けなかった。別の組み合わせも試してみよう。`
          : "この組み合わせでは、操作できなかった。どのデータに、どの鍵を使うか見直そう。",
        "question",
        { ...common, scene: "question", decision: true },
      ),
    ];
  if (mode === "decrypt")
    return [
      frame(
        "charlie",
        after.decryptResult?.kind === "key"
          ? `${englishNames(keyLabel)}で封筒を開けると、共通鍵が出てきた。手元の鍵に加えたぞ。`
          : "選んだ共通鍵で暗号文を復号した。本文が読めた！ 編集することもできそうだ。",
        "decrypt",
        { ...common, scene: "decrypt", decision: true },
      ),
    ];
  if (mode === "wrap")
    return [
      frame(
        "charlie",
        `${englishNames(dataLabel)}を、${englishNames(keyLabel)}で包み直した。新しい暗号文は、まだ手元にある。`,
        "wrap",
        { ...common, scene: "wrap", kind: "wrapped-key", decision: true },
      ),
    ];
  if (mode === "message")
    return [
      frame(
        "charlie",
        `作業台の本文を、${englishNames(keyLabel)}で暗号化した。これを送るものに選ぶか、考えよう。`,
        "edit",
        { ...common, scene: "edit", kind: "ciphertext", decision: true },
      ),
    ];
  return [
    frame(
      "charlie",
      "手元の暗号文の一部を書き換えた。これを届けたら、相手はどう受け取るだろう？",
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
      frames = value.flatMap((frame) =>
        paginateText(frame.text, 64).map((text) => ({ ...frame, text })),
      );
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
