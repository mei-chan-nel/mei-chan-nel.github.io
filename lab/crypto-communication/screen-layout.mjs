// Choose compositions rather than scaling text or clipping a long page.
export function screenLayout(width, height) {
  const wide = width >= 760 || (width >= 550 && width / height >= 1.25);
  const density =
    height < (wide ? 440 : 560)
      ? "tiny"
      : height < 760
        ? "compact"
        : "comfortable";
  return { layout: wide ? "wide" : "narrow", density };
}
export function compactStory(s) {
  const titles = {
    public: "公開鍵が到着",
    key: s.round === 0 ? "共通鍵が到着" : "暗号化された鍵が到着",
    message: s.round >= 2 ? "署名付きの本文が到着" : "本文の暗号文が到着",
    done: "この通信は終了",
  };
  const text =
    s.phase === "done"
      ? "Charlieは、通信の結果を確かめ、もう一度試せます。"
      : s.phase === "public"
        ? "Charlieの中継機が、BobからAliceへの公開鍵を止めています。"
        : s.phase === "key" && s.round === 0
          ? "Charlieの中継機が、AliceからBobへの共通鍵を平文のまま止めています。"
          : s.phase === "key"
            ? "Charlieの中継機が、AliceからBobへの共通鍵の暗号文を止めています。"
            : "Charlieの中継機が、AliceからBobへの本文の暗号文を止めています。";
  const goals = [
    "CharlieがAliceの本文を読み、「I hate you.」をBobに受理させよう。",
    "Charlieが、新しい鍵の配送方式でも盗聴・改ざんを試そう。",
    "Charlieが、Aliceの署名によって盗聴と改ざんの結果がどう変わるか確かめよう。",
    "Charlieが、AliceによるBobの公開鍵の確認の有無を比べよう。",
  ];
  return { title: titles[s.phase], text, goal: goals[s.round] };
}
export function compactOutcome(s, action, failed = false) {
  if (s.result) {
    return (
      {
        "attack-success": s.read
          ? "CharlieはAliceの本文を盗聴し、BobはCharlieが改ざんした本文を受理した。"
          : "BobはCharlieが改ざんした本文を受理した。CharlieはAliceの元の本文をまだ復号していない。",
        "original-accepted":
          s.round >= 2
            ? "BobはAliceの署名を検証し、本文を受理した。"
            : "Bobは本文を受理した。Charlieは目的の改ざんを達成できなかった。",
        "bad-public":
          "Aliceは届いたデータを公開鍵として使えず、通信を中断した。",
        "bad-key": "Bobは届いたデータから共通鍵を取得できなかった。",
        "bad-message":
          "Bobは、Bobの共通鍵では届いた本文の暗号文を復号できなかった。",
        "signature-rejected": s.read
          ? "CharlieはAliceの本文を盗聴できた。BobはAliceの署名を検証できず、改ざんした本文を拒否した。"
          : "BobはAliceの署名を検証できず、届いた本文を拒否した。",
        authenticated:
          "Aliceは、届いた公開鍵の指紋とBobの指紋が一致しないため、共通鍵を送らなかった。",
      }[s.result.code] || "結果の説明から、仕組みを確認できます。"
    );
  }
  if (failed)
    return "Charlieは選んだ組み合わせで操作できなかった。Charlieはデータと鍵を選び直せる。";
  return (
    {
      copy: "Charlieは経路上のデータを持ち物にコピーした。Charlieは転送をまだ行っていない。",
      replace:
        "Charlieは送信候補を変更した。Charlieは「届ける」から転送を決定できる。",
      deliver:
        "Charlieはデータを届けた。Charlieの中継機は次のデータを止めている。",
      tool: "Charlieは道具を使った。Charlieは道具の結果画面で結果を確認できる。",
    }[action] || "Charlieは、状況と目的を確かめて行動を選べる。"
  );
}
export function paginateText(text, limit = 130) {
  const chars = Array.from(String(text));
  const result = [];
  for (let pos = 0; pos < chars.length;) {
    let end = Math.min(pos + limit, chars.length);
    if (end < chars.length) {
      for (let i = end - 1; i > pos + limit / 2; i--)
        if ("。！？\n".includes(chars[i])) {
          end = i + 1;
          break;
        }
    }
    result.push(chars.slice(pos, end).join(""));
    pos = end;
  }
  return result.length ? result : ["まだ記録はありません。"];
}
