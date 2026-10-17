// Narrative keeps the state, player role and available intervention explicit.
// It receives only the learner-safe model snapshot, never sealed payloads.
export function describeSituation(s) {
  const publicDelivery =
    s.phase === "public" ||
    (s.phase === "done" && s.incoming.type === "public");
  const recipient = publicDelivery ? "Alice" : "Bob";
  const sender = publicDelivery ? "Bob" : "Alice";
  const goals = [
    "CharlieがAliceの本文を読み、「I hate you.」に変えて、Bobに受け付けさせよう。",
    "Charlieが、新しい鍵の配送でもAliceの本文を読み、Bobに「I hate you.」を受け付けさせられるか試そう。",
    "Charlieが、Aliceの電子署名によって盗聴と改ざんの結果がどう変わるか確かめよう。",
    "Charlieが、Bobの公開鍵をすり替えてみよう。Charlieが、Aliceによる公開鍵の確認の有無を比べよう。",
  ];
  let title, text;
  if (s.phase === "done") {
    title = "この通信の結果が出た。";
    text =
      "Charlieは、通信の結果と持ち物を調べられる。Charlieが同じラウンドをやり直すと、Aliceは新しい共通鍵を使う。";
  } else if (s.phase === "public") {
    title = "Bobの公開鍵が、Charlieの中継機に到着！";
    text =
      "Aliceは、共通鍵をBobへ届けるためにBobの公開鍵を待っている。Charlieの中継機は、BobからAliceへの公開鍵を止めている。";
  } else if (s.phase === "key" && s.round === 0) {
    title = "Aliceが、共通鍵をBobへ送った！";
    text =
      "Aliceは、今回の共通鍵で秘密の本文を暗号化する。Aliceは、同じ共通鍵をBobへ送った。Charlieの中継機は、その共通鍵を止めている。";
  } else if (s.phase === "key") {
    title = "暗号化された共通鍵が、到着！";
    text =
      "Aliceは、受け取った公開鍵で共通鍵を暗号化した。Charlieの中継機は、共通鍵の暗号文を止めている。Charlieは、コピーするだけでは共通鍵を読めない。";
  } else {
    title =
      s.round >= 2
        ? "署名を添えた、秘密の本文が到着！"
        : "秘密の本文が、暗号文で到着！";
    text = `Aliceは、本文を共通鍵で暗号化してBobへ送った。Bobは、配送された共通鍵を持っている。Charlieの中継機は、本文の暗号文を止めている。${s.round >= 2 ? "Aliceは、本文に対応するAliceの署名も暗号文に含めている。" : "Charlieは、対応する共通鍵で復号するまで本文を読めない。"}`;
  }
  return {
    title,
    text,
    goal: goals[s.round],
    recipient,
    sender,
    route: `${sender} → Charlieの中継機 → ${recipient}`,
    packet:
      s.incoming.type === "public"
        ? "公開鍵"
        : s.incoming.type === "symmetric"
          ? "共通鍵・平文"
          : s.incoming.type === "envelope"
            ? "共通鍵の暗号文"
            : "本文の暗号文",
  };
}
export function describeItem(a) {
  if (!a) return "持ち物からデータを選ぶと、その役割をここに表示します。";
  if (a.type === "symmetric")
    return a.current === false
      ? "以前の通信で手に入れた共通鍵。今回の通信で使えるか試すこともできます。"
      : "これは読める状態の共通鍵です。この鍵自体の復号は不要です。「使う鍵」に選ぶと、本文の暗号文を開いたり、本文を暗号化したりできます。";
  if (a.type === "public")
    return "公開してよい鍵です。共通鍵をこの鍵で包むと、対になる秘密鍵だけが開けられます。公開鍵そのものでは復号できません。";
  if (a.type === "private")
    return "Charlieの秘密鍵です。Charlieは、Charlieの公開鍵で暗号化された共通鍵を復号できます。Charlieは、AliceやBobの秘密鍵を持っていません。";
  if (a.type === "verify")
    return "BobがAliceの署名を検証するための、信頼済みのAliceの公開鍵です。Charlieは、この公開鍵でAliceの署名を作ることはできません。";
  if (a.type === "envelope")
    return "共通鍵が入った暗号文です。包むときに使った公開鍵と対になる秘密鍵で、復号を試せます。";
  if (a.type === "ciphertext")
    return "本文が入った暗号文です。暗号化に使われた共通鍵で復号できれば、本文を編集できます。";
  return "本文に結び付いた電子署名です。本文を書き換えても、元の署名の内容は変わりません。";
}
