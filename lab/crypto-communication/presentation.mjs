// Narrative keeps the state, player role and available intervention explicit.
// It receives only the learner-safe model snapshot, never sealed payloads.
export function describeSituation(s) {
  const publicDelivery =
    s.phase === "public" ||
    (s.phase === "done" && s.incoming.type === "public");
  const recipient = publicDelivery ? "アリス" : "ボブ";
  const sender = publicDelivery ? "ボブ" : "アリス";
  const goals = [
    "秘密の本文を読み、「I hate you.」に変えて、ボブに受け付けさせよう。",
    "新しい鍵の届け方でも、秘密の本文を読み、「I hate you.」を受け付けさせられるか試そう。",
    "電子署名が加わった。同じ作戦で「盗聴」と「改ざん」がそれぞれ通用するか確かめよう。",
    "公開鍵のすり替えを試そう。持ち主を確認する場合としない場合で、どこまで通信が進むか比べよう。",
  ];
  let title, text;
  if (s.phase === "done") {
    title = "この通信の結果が出た。";
    text =
      "下の結果を見て、何ができたか確かめよう。持ち物は引き続き調べられる。同じラウンドをやり直すと、共通鍵が新しくなる。";
  } else if (s.phase === "public") {
    title = "ボブの公開鍵が、中継機に到着！";
    text =
      "アリスは、共通鍵を安全に届けるためにボブの公開鍵を待っている。その公開鍵が、あなたの中継機まで来た。アリスにはまだ届いていない。";
  } else if (s.phase === "key" && s.round === 0) {
    title = "アリスが、共通鍵を送ってきた！";
    text =
      "アリスは、この鍵で秘密の本文を暗号化するつもりだ。同じ鍵をボブにも届けようとしている。鍵は今、あなたの中継機で止まっている。";
  } else if (s.phase === "key") {
    title = "暗号化された共通鍵が、到着！";
    text =
      "アリスは、受け取った公開鍵で共通鍵を包んだ。その暗号文が、あなたの中継機に到着した。コピーしても、それだけでは中の鍵は読めない。";
  } else {
    title =
      s.round >= 2
        ? "署名を添えた、秘密の本文が到着！"
        : "秘密の本文が、暗号文で到着！";
    text = `アリスが本文を共通鍵で暗号化して送ってきた。ボブは、先ほど配送された鍵を持って待っている。${s.round >= 2 ? "今回は、本文に結び付いたアリスの電子署名も同封されている。" : "暗号文はコピーできるが、中身は対応する鍵で復号するまで秘密だ。"}`;
  }
  return {
    title,
    text,
    goal: goals[s.round],
    recipient,
    sender,
    route: `${sender} → あなたの中継機 → ${recipient}`,
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
    return "あなた自身の秘密鍵です。自分の公開鍵で包まれた共通鍵を開けられます。アリスとボブの秘密鍵は、あなたの持ち物にはありません。";
  if (a.type === "verify")
    return "ボブがアリスの署名を確かめるために使う、信頼済みの公開鍵です。署名を作る秘密鍵とは別のものです。";
  if (a.type === "envelope")
    return "共通鍵が入った暗号文です。包むときに使った公開鍵と対になる秘密鍵で、復号を試せます。";
  if (a.type === "ciphertext")
    return "本文が入った暗号文です。暗号化に使われた共通鍵で復号できれば、本文を編集できます。";
  return "本文に結び付いた電子署名です。本文を書き換えても、元の署名の内容は変わりません。";
}
