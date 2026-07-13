# SEO・AI検索対応記録

実装日: 2026-07-14

## 目的と前提

高校生・受験生が「情報1」「情報 共通テスト」「情報 勉強法」などで調べたとき、検索意図に対応するページへ到達できる構成を目指す。検索順位は検索エンジンが決定するため上位表示を保証せず、公開後はSearch Consoleの実測値で改善する。

## 参照した一次資料

- [Google 検索セントラル: SEOスターターガイド](https://developers.google.com/search/docs/fundamentals/seo-starter-guide?hl=ja)
- [Google 検索セントラル: 有用で信頼性の高い、ユーザー第一のコンテンツ](https://developers.google.com/search/docs/fundamentals/creating-helpful-content?hl=ja)
- [Google 検索セントラル: Google検索のAI機能とウェブサイト](https://developers.google.com/search/docs/appearance/ai-features)
- [Google 検索セントラル: クロール可能なリンク](https://developers.google.com/search/docs/crawling-indexing/links-crawlable?hl=ja)
- [Google 検索セントラル: サイトマップ](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview?hl=ja)
- [OpenAI: Publishers and developers FAQ](https://help.openai.com/en/articles/12627856-publishers-and-developers-faq)

## 検索意図と対応ページ

|検索意図|主な表現|対応ページ|
|---|---|---|
|科目全体の入口|情報Ⅰ、情報1、情報I、高校生、受験生|`index.html`|
|学習方法|情報 勉強法、情報Ⅰ 勉強法、共通テスト 情報 対策|`study-guide.html`|
|問題演習|情報Ⅰ 問題、情報1 問題、共通テスト 情報 問題|`info1-quiz-app/questions/`|
|用語別の復習|情報Ⅰ 2進数、著作権、DNSなど|`info1-quiz-app/questions/tags.html`|
|動画での学習|情報Ⅰ 一問一答、プログラミング 解説|`archive/`、`archive/keywords.html`|

表記違いは本文で自然に説明し、同じ語の不自然な反復やキーワード詰め込みは行わない。`meta keywords` は使用しない。

## 実装内容

- トップのtitle、description、H1、導入文に科目・対象・用途を明示した。
- 独自本文として、学習手順、6分野、期間別計画、つまずき、FAQ、公式資料をまとめた勉強法ページを追加した。
- 全学習ページへ固有のtitle、description、canonical、Open Graphを設定した。
- 階層ページへ画面上のパンくずと`BreadcrumbList`を追加した。
- トップへ`WebSite`と代替サイト名、勉強法ページへ`Article`、一覧へ`CollectionPage`を設定した。
- ヘッダー、本文、フッター、HTMLサイトマップから重要ページへ通常の`<a href>`リンクを設置した。
- タグ・キーワードをリンク化し、URLで共有できる複数選択OR検索を追加した。検索条件付きURLのcanonicalは基準ページへ統一した。
- XMLサイトマップを両リポジトリのビルド記録から生成し、`robots.txt`で公開した。
- ChatGPT検索の発見性のため`OAI-SearchBot`を明示的に許可した。GoogleのAI機能向けに特別なAI用マークアップや`llms.txt`は追加していない。
- 2026年1月にGoogle検索で廃止されたPractice Problem構造化データには依存せず、一般的で内容に合うSchema.org型だけを用いた。

## 公開後の測定

1. Search Consoleへ`https://mei-chan-nel.github.io/sitemap.xml`を送信する。
2. URL検査でトップ、勉強法、問題一覧、タグ、動画問題、キーワードの6入口を確認する。
3. 毎週、検索クエリ別の表示回数、クリック、CTR、平均掲載順位と、ページ別の入口数を記録する。
4. 「表示はあるがCTRが低い」ページはtitle・descriptionと本文の一致を見直す。
5. 「順位は付くが内容が不足する」クエリは、既存ページへ具体例、図表、誤解しやすい点、公式根拠を追加する。似た薄いページを量産しない。
6. 更新日、編集者、変更理由を実装記録へ残し、少なくとも月1回はリンクと公式資料の更新有無を確認する。

順位変動は実装直後に結論を出さず、クロール・インデックス後の数週間から数か月の推移で判断する。
