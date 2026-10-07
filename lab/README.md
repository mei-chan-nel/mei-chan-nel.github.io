# Interactive Lab

情報Ⅰの概念を操作・実験・可視化で理解する教材の入口です。現時点ではトップページと共通のガワだけを作成しています。以前の18教材はすべて撤回し、個別ページ・実験コード・計算モデル・教材用テストを削除しました。

学習アプリと同じ6分野で整理します。

1. 社会・セキュリティ
2. デジタル表現
3. ネットワーク
4. データ活用・DB
5. アルゴリズム
6. 情報デザイン

各分野には分野名・短い説明・準備中の表示だけを置いています。個別教材のリンクはありません。今後、一つずつ体験を設計・実装します。個別教材のURLは `/lab/<slug>/` に統一する方針を維持します。

## 構成

- `catalog.mjs`: 6分野の名称と説明。
- `tools/build-pages.mjs`: 入口 `index.html` の生成。個別ページは生成しません。
- `lab.css`: 入口のレイアウト。既存 `assets/site.css` の配色・ヘッダー・フッターを使用します。
- `navigation.mjs`: ナビゲーションの表示補助。解析・広告スクリプトは読み込みません。

```sh
node lab/tools/build-pages.mjs
node lab/tools/build-pages.mjs --check
python3 scripts/preview_site.py --host 127.0.0.1 --port 8773 --app-root /workspace/info1-quiz-app
```

配信した `/lab/` を開いて確認します。Labの表示にnpmインストールは不要です。

## 未公開

既存サイトの全体トップ・サイトマップ・公開設定は変更しません。入口には `noindex, nofollow` を設定しています。これはアクセス制限ではないため、公開元へのコミット・push・デプロイは行っていません。
