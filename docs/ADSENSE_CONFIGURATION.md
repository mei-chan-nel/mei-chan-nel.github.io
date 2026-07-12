# AdSense再審査前の設定

対象サイト: `https://mei-chan-nel.github.io/`

この文書はコードでは完結しないAdSense管理画面側の設定を記録する。設定後は、管理画面のプレビューと実ページで再確認する。

## 1. ページ除外

AdSenseの「広告」→対象サイトの「編集」→「除外ページ」→「管理」で、次の2 URLを追加する。すべて **このページのみ（完全一致）** を選び、セクション全体は選ばない。

1. `https://mei-chan-nel.github.io/about.html`
2. `https://mei-chan-nel.github.io/privacy.html`

この2ページには広告コードを置いていないが、将来サイト共通コードを変更した場合にも広告を出さない方針を保つため、除外設定にも登録する。旧 `app/about.html` と `app/privacy.html` はポータルへ統合して削除済みである。

`/app/` セクション全体を除外するとアプリ本体も対象外になるため、指定しない。

Google公式: [特定のページを自動広告の表示対象から除外する](https://support.google.com/adsense/answer/9262311?hl=ja)

## 2. アプリの操作領域を除外

広告設定プレビューで `https://mei-chan-nel.github.io/info1-quiz-app/app/` を開き、「除外エリア」からクイズの操作領域を選ぶ。

除外対象:

- `.app-shell` 全体
- 選択が細分化される場合は `.start-panel`、`.status-bar`、`.question-panel`、`.summary-panel`

目的は、分野選択、問題数変更、選択肢、次の問題、再挑戦などの操作と広告を近接させないこと。アプリ下部の広告掲載領域やページ外側まで除外しない。

Google公式: [自動広告の設定（除外エリア）](https://support.google.com/adsense/answer/9305577?hl=ja)

## 3. オーバーレイ広告を抑える

再審査時は学習操作を優先し、次の設定を推奨する。

- アンカー広告: オフ
- 全画面広告（モバイル全画面／Vignette）: オフ
- Vignetteの追加トリガー: オフ
- サイドレール: 再審査まではオフ
- ページ内広告: オン
- 広告数: 低め
- 広告間の最小距離: 広め

Vignetteを将来再開する場合でも、頻度は最長側に設定し、追加トリガーはオフのままにする。

Google公式: [自動広告について](https://support.google.com/adsense/answer/9261805?hl=ja)、[全画面広告の表示頻度](https://support.google.com/adsense/answer/13956167?hl=ja)

## 4. 学習ページを広告対象に保つ

次は除外しない。

- `https://mei-chan-nel.github.io/`
- `https://mei-chan-nel.github.io/info1-quiz-app/questions/`
- `https://mei-chan-nel.github.io/info1-quiz-app/questions/*.html`
- `https://mei-chan-nel.github.io/info1-quiz-app/app/`

新設学習ページにはAdSenseコードがあり、本文は問題・選択肢・正答・解説・出典・タグで構成する。案内だけの画面や未完成画面には広告を置かない。

Google公式: [パブリッシャー コンテンツがない画面上の広告](https://support.google.com/publisherpolicies/answer/11112688?hl=ja)、[AdSenseの利用に適したサイト](https://support.google.com/adsense/answer/7299563?hl=ja)

## 5. 管理画面での完了記録

設定後に次を記録する。

| 確認項目 | 完了日 | 確認者 | 結果 |
|---|---|---|---|
| 2 URLの完全一致除外 |  |  |  |
| アプリ操作領域の除外 |  |  |  |
| オーバーレイ形式オフ |  |  |  |
| 学習ページのプレビュー |  |  |  |
| 案内・規約ページに広告なし |  |  |  |
