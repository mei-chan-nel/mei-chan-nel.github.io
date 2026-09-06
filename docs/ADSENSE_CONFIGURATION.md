# Google AdSense 手動配置の運用設定

対象サイト: `https://mei-chan-nel.com/`

調査・改修日: 2026-08-09

パブリッシャー ID: `ca-pub-6257644709224446`

この文書は、コードだけでは完了しない AdSense 管理画面の設定と、手動広告ユニットの差し替え手順を記録する。サイトは自動広告を使用せず、明示した本文位置だけで広告を初期化する。

## 1. Google 公式資料と採用ルール

| 項目 | 採用ルール | Google 公式資料 |
|---|---|---|
| 共通コード | 対象ページの `<head>` にクライアント付きコードを1回だけ置く | [AdSense コードを取得してコピーする](https://support.google.com/adsense/answer/9274019?hl=ja)、[AdSense コードをサイトに配置する](https://support.google.com/adsense/answer/9274516?hl=ja) |
| ディスプレイ広告 | レスポンシブ、`data-ad-format="auto"`、`data-full-width-responsive="true"` | [ディスプレイ広告ユニットを作成する](https://support.google.com/adsense/answer/9274025?hl=ja)、[レスポンシブ広告ユニットの動作](https://support.google.com/adsense/answer/9183362?hl=ja) |
| 記事内広告 | `data-ad-layout="in-article"`、`data-ad-format="fluid"` の記事内ユニットを使う | [記事内広告ユニットを作成する](https://support.google.com/adsense/answer/9274522?hl=ja)、[全幅の記事内広告](https://support.google.com/adsense/answer/9189961?hl=ja) |
| 初期化 | 各手動枠につき `adsbygoogle.push({})` を初回だけ実行し、自動更新しない | [レスポンシブ広告コードを修正する](https://support.google.com/adsense/answer/9183363?hl=ja)、[広告の配置に関するポリシー](https://support.google.com/adsense/answer/1346295?hl=ja) |
| 操作との距離 | リンク、ボタン、アプリ操作と誤クリックを誘う近接・重なりを避ける | [広告がコンテンツや操作を妨げる配置](https://support.google.com/publisherpolicies/answer/11035030?hl=ja) |
| 広告量 | 固定の全ページ上限ではなく、広告が本文を上回らないよう本文量に応じて制限する | [コンテンツより広告等が多い画面](https://support.google.com/publisherpolicies/answer/11169917?hl=ja) |
| 未配信枠 | `data-ad-status="unfilled"` を使って未配信枠を非表示にできる | [未配信の広告ユニットを非表示にする](https://support.google.com/adsense/answer/10762946?hl=ja) |
| 自動広告 | 自動広告をオフにする。広告ユニットのコードがあるだけでも自動広告の配信経路になり得るため、管理画面設定が必須 | [自動広告の設定](https://support.google.com/adsense/answer/9305577?hl=ja)、[AdSense コードについて](https://support.google.com/adsense/answer/9274634?hl=ja) |
| プライバシー | Cookie、第三者配信、パーソナライズ広告の無効化手段をポリシーに記載する | [プライバシー関連ポリシーの必須コンテンツ](https://support.google.com/adsense/answer/1348695?hl=ja) |

40px 前後の余白は、このサイトで操作要素と広告を視覚的に分離するための設計値であり、Google が全サイトに要求する固定ピクセル値ではない。

未配信処理では、Google が広告要素へ付与する `data-ad-status` だけを監視する。タイマーや要素の高さから配信成否を推測しない。また、実際の広告要素はラッパーを表示状態に戻してから広告リクエストを送るため、非表示のまま広告を読み込ませる構成ではない。

## 2. 手動広告ユニットを作成して差し替える

AdSense の「広告」→「広告ユニットごと」から次の2ユニットを作成する。

1. レスポンシブのディスプレイ広告ユニット
2. 記事内広告ユニット

作成後、広告コードの `data-ad-slot` に表示される数字だけを確認し、`assets/manual-ads.js` 冒頭の次の2値を差し替える。

```js
const AD_SLOTS = Object.freeze({
  display: "REPLACE_WITH_DISPLAY_AD_SLOT",
  article: "REPLACE_WITH_IN_ARTICLE_AD_SLOT",
});
```

数字以外のプレースホルダー中は、手動広告要素を作らず、`adsbygoogle.push({})` も実行せず、余白も表示しない。架空のスロット番号は使用しない。パブリッシャー ID は変更しない。

対象ページの `<head>` にはプレースホルダー中も AdSense 共通コードがある。Google はこの共通コードだけでも Auto ads を動作させられるため、「手動枠の push がないこと」と「自動広告が出ないこと」は別である。厳密な手動配置を保証するには、公開前に管理画面で自動広告と関連する最適化をオフにする必要がある。

## 3. 管理画面で必ず無効化する設定

「広告」→「サイトごと」→対象サイトの編集画面と、最適化・テスト関連画面で次を確認する。

- 自動広告: オフ
- アンカー、全画面、サイドレール、ページ内、関連する検索、広告インテント等の自動広告形式: すべてオフ
- 「Google に既存の広告を最適化させる」: オフ
- Auto optimize: オフ
- 勝者を自動適用する設定: オフ
- 自動広告を変更する実行中の最適化テスト: なし
- 「ページ内広告の空白を埋める」（画面によっては「空きのページ内広告を補完する」）: オフ。これは指定外の位置へ広告枠を追加する設定ではなく、既存の未配信ディスプレイ広告枠を文脈候補などで最適化する設定である。厳密な手動枠と `unfilled` 時の非表示を維持するためオフにする。[空のページ内広告スペースの最適化](https://support.google.com/adsense/answer/16302564?hl=ja)

Auto optimize はサイト単位の設定であり、Google の仕様変更により既定値が変わる場合があるため、再審査時と定期点検時に再確認する。[Auto optimize の変更](https://support.google.com/adsense/answer/15878459?hl=ja)、[Auto optimize について](https://support.google.com/adsense/answer/9141298?hl=ja)

自動広告をオフにしているため、ページ除外や除外エリアは主制御として使用しない。防御的に既存設定を残す場合でも、手動広告の配信確認を妨げないことをプレビューで確認する。

空き枠補完の設定は、現行ヘルプでは「ブランド保護」→「コンテンツ」→「ブロックのコントロール」→「広告配信を管理」→「ディスプレイ広告」に案内されており、自動広告のサイト編集画面とは別の設定である。

## 4. コード上の広告対象

| ページ種別 | 広告形式 | 配置 |
|---|---|---|
| `/info1-quiz-app/app/` | ディスプレイ 1枠 | アプリ本体の後、フッターの前 |
| `/info1-quiz-app/questions/` | ディスプレイ 1枠 | ランダム出題コントロールの後、問題一覧の前 |
| 個別動画問題 22ページ | 記事内 0〜3枠 | 問題数に応じた問題カード間 |
| 講義本文 5ページ | 記事内 3〜4枠 | 3セクションごと。最終セクション後には置かない |
| 用語解説ページ | 記事内 1枠 | 類題リンクの後、フッターの前 |

トップ、動画一覧、講義一覧、使い方、サイト案内、プライバシーポリシー、書籍、HTMLサイトマップ、互換リダイレクトには AdSense 共通コードも手動枠も置かない。

## 5. 配信前の管理画面チェック

| 確認項目 | 完了日 | 確認者 | 結果 |
|---|---|---|---|
| ディスプレイ広告ユニットを作成しスロット値を設定 |  |  |  |
| 記事内広告ユニットを作成しスロット値を設定 |  |  |  |
| 自動広告・全自動形式がオフ |  |  |  |
| Auto optimize・自動適用がオフ |  |  |  |
| 空きのページ内広告の補完がオフ |  |  |  |
| 実行中の自動広告テストがない |  |  |  |
| サイトの審査状態が配信可能 |  |  |  |
| `ads.txt` が「承認済み」 |  |  |  |
| EEA・英国・スイス向けに、IAB TCF v2.3 対応の Google 認定 CMP を必要に応じて設定 |  |  |  |
| PC・モバイルで対象／対象外ページを実機確認 |  |  |  |

`ads.txt` の現行行は `google.com, pub-6257644709224446, DIRECT, f08c47fec0942fa0`。Google は `ads.txt` を強く推奨している。[ads.txt ガイド](https://support.google.com/adsense/answer/12171612?hl=ja)

EEA・英国・スイスの利用者へ広告を配信する場合は、IAB TCF v2.3 対応の Google 認定 CMP による同意管理要件を確認する。2026年3月1日以降に生成する TC 文字列は TCF v2.3 が必須である。[欧州規制メッセージの要件](https://support.google.com/adsense/answer/7670013?hl=ja)、[IAB Europe TCF との統合](https://support.google.com/adsense/answer/9804260?hl=ja)
