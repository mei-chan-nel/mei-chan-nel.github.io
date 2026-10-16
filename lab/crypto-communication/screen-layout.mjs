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
      ? "結果を確かめ、もう一度試せます。"
      : s.phase === "public"
        ? "ボブからアリスへの公開鍵が中継機で停止中。"
        : s.phase === "key" && s.round === 0
          ? "共通鍵がむき出しで停止中。ボブにはまだ未配達。"
          : s.phase === "key"
            ? "共通鍵入りの暗号文が停止中。対応する秘密鍵で開けます。"
            : "本文の暗号文が停止中。相手に届く前に介入できます。";
  const goals = [
    "本文を読み、「I hate you.」をボブに受理させよう。",
    "新しい鍵の配送でも、盗聴・改ざんを試そう。",
    "署名があると、盗聴と改ざんはどう変わる？",
    "鍵の持ち主を確認する場合としない場合を比べよう。",
  ];
  return { title: titles[s.phase], text, goal: goals[s.round] };
}
export function compactOutcome(s, action, failed = false) {
  if (s.result) {
    return (
      {
        "attack-success": s.read
          ? "盗聴し、書き換えた本文をボブが受理した。"
          : "書き換えた本文は受理。元の本文の復号は未達成。",
        "original-accepted":
          s.round >= 2
            ? "ボブは署名を検証し、本文を受理した。"
            : "ボブは本文を受理した。狙った改ざんには至らなかった。",
        "bad-public": "アリスが公開鍵として使えず、通信を中断した。",
        "bad-key": "ボブは届いたデータから共通鍵を取得できなかった。",
        "bad-message": "ボブの持つ共通鍵では、届いた本文を復号できなかった。",
        "signature-rejected": s.read
          ? "盗聴はできたが、署名が一致せず改ざんは拒否された。"
          : "アリスの署名を検証できず、ボブは受理しなかった。",
        authenticated:
          "鍵の指紋が一致しないため、アリスは共通鍵を送らなかった。",
      }[s.result.code] || "結果の説明から、仕組みを確認できます。"
    );
  }
  if (failed)
    return "この組み合わせでは操作できなかった。道具でデータと鍵を見直そう。";
  return (
    {
      copy: "持ち物に記録した。相手へは未配達。道具で調べられる。",
      replace: "次に送るデータを変更した。「届ける」まで送信されない。",
      deliver: "相手に届いた。次のデータが中継機で止まっている。",
      tool: "道具を使った。結果は「持ち物・道具」で確認できる。",
    }[action] || "状況と目的を確かめて、行動を選ぼう。"
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
