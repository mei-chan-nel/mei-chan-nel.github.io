# 学習サイト改修・リポジトリ分離記録

作業日: 2026-07-12

## リポジトリ境界

公開サイトは独立した2リポジトリで管理する。

### `mei-chan-nel.github.io`

- ポータルトップ
- このサイトについて
- 全体プライバシーポリシー
- ポータル共通デザイン
- ホスト直下の `ads.txt` と `robots.txt`
- ポータル、問題一覧、アプリをまとめた全体 `sitemap.xml`
- AdSense再審査設定と全体評価

### `info1-quiz-app`

- 既存学習アプリ `app/`
- 問題データと分野分類
- 問題一覧トップと6分野の生成ページ
- 問題一覧用デザイン
- 問題一覧生成・分類・検証
- ポータルのサイトマップ生成へ渡す問題一覧ビルド記録

## 変更禁止範囲

既存学習アプリの出題・遷移・集計処理は変更しない。案内リンク統合後の `app/index.html` と、不変の `app.js`、`startup.js`、`styles.css` のSHA-256を `info1-quiz-app/docs/reports/app-core-baseline-sha256.json` に保存し、問題一覧検証時に一致を確認する。

## 第1段階: 問題分類

`info1-quiz-app` で実施した。

- 全861問へ主分野を1件設定した。
- 既存推定で候補が出る792問はタグ順と一致強度で決定した。
- 候補が出ない69問は問題内容を個別確認した。
- `question.schema.json` で `field_ids` を新規問題の必須項目とした。
- 未分類は0問。

分類結果:

- 社会・セキュリティ: 321問
- デジタル表現: 189問
- ネットワーク: 146問
- データ活用・DB: 92問
- アルゴリズム: 74問
- 情報デザイン: 39問

## 第2段階: 問題一覧

`info1-quiz-app` で実施した。

- 問題一覧トップと6分野・32ページを生成した。
- 1ページ最大30問とした。
- 861問を重複なしで1回ずつ掲載した。
- 問題文、選択肢、正答、解説、出典、タグを掲載した。
- `scripts/generate_question_pages.py` は `questions/` とプロジェクトサイトマップだけを生成する。
- `scripts/validate_question_pages.py` は問題一覧、アプリ保護ハッシュ、リポジトリ境界を検証する。

## 第3段階: ポータル

`mei-chan-nel.github.io` で実施した。

- ポータルトップを学習コンテンツ中心の構成へ刷新した。
- 6分野の紹介、学習方法、問題作成方針、問題一覧・アプリへの導線を追加した。
- サイト案内とプライバシーポリシーを整備した。
- `assets/site.css` と `assets/favicon.svg` をポータルだけの共通資産とし、問題一覧から同じ公開URLを参照する。
- 旧 `styles.css` は参照されなくなったため削除した。

## 第4段階: 広告と機械可読ファイル

- ポータルトップ、問題一覧トップ、32分野ページ、既存アプリ本体を広告対象とした。
- ポータルの案内・プライバシーページは広告コードなしとした。
- サイト案内とプライバシーポリシーをポータルへ統合し、アプリのフッターからポータルのトップ・案内・プライバシーへ直接リンクした。
- ホスト単位で参照される `ads.txt` と `robots.txt` は `mei-chan-nel.github.io` だけに置いた。
- `info1-quiz-app` のビルド記録から公開ページ一覧を読み、`mei-chan-nel.github.io/sitemap.xml` に両リポジトリの37 URLを収録する。

## 移動後にアプリ側から削除したもの

- `index.html`
- `about.html`
- `privacy.html`
- `ads.txt`
- `robots.txt`
- アプリ側へ一時的に置いた共通CSS・favicon（ポータルの公開URL参照へ統一）
- ポータル全体のAdSense・実装・再審査文書
- ポータルまで生成していた旧 `scripts/generate_site.py`
- ポータルまで検証していた旧 `scripts/validate_site.py`

旧 `app/about.html` と `app/privacy.html` の固有情報をポータルへ統合し、参照をポータルへ切り替えた後に両ファイルを削除した。

追加の重複監査で、問題一覧側に残っていた完全一致のCSS・faviconと、URLが全体サイトマップへ重複していたプロジェクトサイトマップを削除した。空の `参照テスト.txt` も参照がないため削除した。

## 再生成・検証

アプリ／問題一覧リポジトリ:

```powershell
python scripts/classify_questions.py --check
python scripts/generate_question_pages.py
python scripts/validate_question_pages.py
```

ポータルリポジトリ:

```powershell
python scripts/update_sitemap.py
python scripts/validate_portal.py
```

両検証に合格した後、2リポジトリをそれぞれ公開する。
