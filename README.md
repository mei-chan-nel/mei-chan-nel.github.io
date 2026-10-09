# 情報Ⅰ Study Atlas — ポータル

`https://mei-chan-nel.com/` の入口、用語解説、講義ノート、解説動画、書籍案内、サイト情報を管理するリポジトリです。学習アプリとタグ検索のデータ・ページ生成は、隣接する [`info1-quiz-app`](https://github.com/mei-chan-nel/info1-quiz-app) で管理します。

## 現在の公開構成

- トップページ：ファーストビュー、学習アプリを含む6つの学習導線、使い方・書籍案内。
- 用語解説：`/terms/` の一覧と、公開中の用語解説。記事未作成のタグは一覧に表示しません。
- 解説動画：5分野・21ジャンルの通常ページ（330問）と、プログラミング最短学習コース（27問）。各問題の動画はクリック時に読み込みます。
- 講義ノート：情報社会、デジタル、ネットワーク、統計、プログラミングの5分野。
- プログラムトレース：代表問題15問と動画のプログラミング問題100問を1行ずつ実行。
- 問題検索：`/info1-quiz-app/questions/` のタグAND検索（1,438問・229タグ）。

## 主なファイル

```text
index.html                 ポータルトップ
archive/                   動画一覧・21ジャンル・最短コース
LectureNote/               講義ノート5分野
books/                     書籍案内
assets/site.css            共通デザイン
assets/term-page.css       用語一覧・用語解説のデザイン
assets/term-guides.js      用語タグと解説URLの生成レジストリ
assets/video-embeds.js     クリック時の動画埋め込み
assets/home-learning.js    学習履歴サマリー
assets/manual-ads.js       手動AdSenseユニットの中央設定・初回初期化
program-trace/             プログラムを1行ずつ実行するページ
program-trace/studio/      Studioのブラウザ用生成物
projects/program-trace-studio/  自作プログラムの編集・実行・保存・共有を扱う独立したTypeScriptプロジェクト
data/video-questions.json  問題・答え・動画情報
data/video-curriculum.json 5分野・21ジャンル・最短コースの正本
data/term-tag-list.json    ExcelのNo.順を保持する公開用の用語タグ一覧
scripts/generate_video_pages.py
scripts/generate_term_guides.py
scripts/import_note_term_pages.py
scripts/validate_manual_ads.py
scripts/update_sitemap.py
scripts/validate_portal.py
scripts/preview_site.py    ポータルと隣接アプリを同じURL構成で確認するローカルサーバー
```

## プログラムトレース

「プログラムトレース」は、このリポジトリの `program-trace/` で管理します。
本番公開時の入口は `https://mei-chan-nel.com/program-trace/`、個別の代表問題は
`/program-trace/run.html#addition` など、動画解説問題は `/program-trace/run.html#video-q-231` の形式です。
一覧は検索対象に残し、実行入口の `run.html` は最初のHTMLから `noindex, follow` を指定しています。
旧実行URLも問題ID・遷移元を保持して新しい入口へ移動します。
共通HTMLや代表問題を編集したときは `python scripts/build_program_trace_pages.py` で一覧のカードと実行入口を再生成します。
生成にはPythonとNode.js 22を使います。npmパッケージのインストールは不要です。
代表15問のカードはHTMLに含め、動画100問は折りたたみを開いたときに読み込みます。
一覧と実行のJavaScriptを分け、一覧を開くだけでは実行用の処理を読み込みません。
代表問題15問に加え、動画のプログラミング問題Q231〜Q330の100問を収録しています。
通常の動画ページと最短学習コースの計127か所で、「解説動画を表示」の右側に
「1行ずつ実行する」を表示します。`?from=<動画ページの分類ID>` で移動元を保持し、
実行画面の「問題へ戻る」から元のページ・問題へ戻れます。
共通ヘッダー・フッターに「プログラムトレース」のリンクを用意しています。
検索向けメタデータと構造化データを設定し、一覧をXML・HTMLのサイトマップへ登録しています。

```powershell
python scripts/preview_site.py --host 127.0.0.1 --port 8773
node --test scripts/program-trace.test.mjs scripts/program-trace-video.test.mjs scripts/program-trace-seo.test.mjs scripts/program-trace-library.test.mjs
```

ブラウザで `http://127.0.0.1:8773/program-trace/` を開きます。
このサーバーは `/info1-quiz-app/` を隣接するアプリのリポジトリへ接続するため、
ヘッダーの「学習アプリ」も本番と同じパスで確認できます。別の配置では `--app-root` を指定します。
詳細は [docs/PROGRAM_TRACE.md](docs/PROGRAM_TRACE.md) を参照してください。
既存の統合検証は `scripts/*.test.mjs` を自動的に検出するため、移したテストも対象になります。

## プログラムトレース Studio

`/program-trace/studio/` では共通テストの表記で自分のプログラムを編集し、1行ずつ実行できます。
ソースは独立した `projects/program-trace-studio/` で管理し、既存問題の実行エンジンには依存しません。
一次元・二次元配列、条件分岐、繰り返し、外部入力、表示・要素数・乱数を扱います。
名前を付けたローカル保存、JSONファイルの読込・書き出し、外部保存先を使わない圧縮URL共有を用意しています。
共有入口の `share.html` は `noindex, follow` とし、共有プログラムを自動実行しません。
URLで扱えないサイズ・破損データにはファイルによる代替を案内します。

```powershell
npm.cmd --prefix projects/program-trace-studio ci --ignore-scripts
npm.cmd --prefix projects/program-trace-studio run check
npm.cmd --prefix projects/program-trace-studio test
```

テスト時に公開フォルダーもビルドします。画面・表記の説明は `/program-trace/studio/guide.html`、
保守方法と保存・共有の仕様は [projects/program-trace-studio/README.md](projects/program-trace-studio/README.md) を参照してください。
既存のプログラムトレース一覧からStudio、代表15問、折りたたみの動画解説問題へ進めます。

## Interactive Lab（作業ブランチ・未公開）

`lab/` の入口から、画像のデジタル化・論理回路・フローチャートへ進めます。サイト全体のトップには追加していません。各ページは `noindex, nofollow` です。

論理回路とフローチャートは、選択中の部品・線を Delete で削除、Esc で選択解除できます。部品は Ctrl+C／Ctrl+V（Mac は ⌘C／⌘V）でコピー・貼り付けでき、番号を新しく付けます。外部への接続は複製しません。繰返しの始端・終端は対で複製します。入力欄・ダイアログでは通常の文字編集を優先し、フローチャートの実行中は編集しません。

フローチャートは `lab/flowchart/`。図記号は講義ノートの基本構造の図に合わせ、処理・入出力・判断・開始／終了・対になった繰返しを使います。関数は別の図で編集します。実行・入力検証・式の解釈には Studio の生成済みモジュールを直接使い、図の番号と共通エンジンの命令を対応付けています。前へ／次へ・乱数の再現・自動実行は履歴を保持して処理します。

編集画面の図形は1回目のクリック・タップで選択し、選択中の図形をもう一度押すと内容を編集します。ドラッグして移動したときは編集画面を開きません。Enter／Spaceでの内容編集も使えます。部品一覧に合流部品は置かず、線の途中への接続で合流させます。

判断の「はい」はひし形の下、「いいえ」は右から進みます。例とプログラムからの変換では「はい」を開始・終了と同じ縦軸に置き、「いいえ」の処理を右へ配置します。合流は丸ではなく、右側から下へ進んで左向きの矢印で縦の流れ線に戻ります。合流部品の保存形式は旧 `connector` のままにし、既存JSON・共有URLの接続と手動配置を維持します。交差した線は自動では接続しません。

出口から線の任意の位置へドラッグすると、その位置で合流します。選択した矢印の先端をドラッグして接続先を変更することもできます。タッチ操作は出口をタップしてから線をタップ、キーボードは出口を選んでEnter、線を選んでEnterです。合流点は高さのない `connector` に `junction: true` を付け、分割した線の曲がり方は `via` で保持します。保存・JSON・共有URLに含め、合流が不要になれば元の線につなぎ直します。

すべての固定の例とプログラムから変換した図も、同じ線上の合流点を使います。分岐の片方が値を返して終わる場合など、合流する経路が1本以下の箇所には合流点を作りません。

動画解説のQ231〜Q330と最短コースの全127か所で、「1行ずつ実行する」の右に「フローチャートで表示する」を置きます。問題ID・掲載ページを渡して初期値と入力設定を変換し、実行画面へ直接進みます。「問題へ戻る」は同じ掲載ページの問題アンカーに戻ります。既存の編集データは表示だけでは上書きせず、変更後は通常の下書きとして保存し、再読み込みでも編集内容を保持します。対応していないQ307・Q308・Q328には理由と元のトレース画面へのリンクを表示します。プログラムトレースから変換した場合も移動元を引き継ぎます。

矢印は上方向へ戻せません。接続や図形の移動で上向きになる場合は変更前の図を保持します。旧JSONに含まれる上向きの矢印は修正できるよう読込を許可し、該当する線を赤く表示します。修正するまでは実行を拒否します。繰返しは対になった始端・終端で表します。

プログラムと図を共有URLで受け渡します。順次・分岐・繰返し・関数を相互変換でき、配列番号と入力設定も引き継ぎます。動画問題の独自命令は構造化済みの命令から変換します。数値と文字列が混在する選択入力（Q307・Q308）とグラフ描画（Q328）は理由を表示して元ページに留まります。順序や選択肢など問題固有の入力条件はコメントとして引き継ぎます。部品120個、共通エンジンの実行10,000ステップまで（開始・終了・結合子・繰返し終端も1ステップに数えます）。

HTML生成・単体検証と、ローカルサーバーでのブラウザ検証：

```bash
npm --prefix projects/program-trace-studio run build
node lab/tools/build-pages.mjs
node --test scripts/interactive-lab*.test.mjs
node lab/tools/test-flowchart.mjs
LAB_ESBUILD_MODULE=/path/to/esbuild node lab/tools/build-preview.mjs /path/to/review
node lab/tools/test-diagram-keys.mjs
node lab/tools/test-flowchart-connections.mjs
node lab/tools/test-flowchart-video.mjs
```

ブラウザ検証には Playwright と Chromium、axe-core を使います。`LAB_PLAYWRIGHT_MODULE`・`LAB_AXE_MODULE` で依存の場所、`LAB_BASE_URL` でプレビューURLを指定できます。単独HTMLは画像・CSS・実行コードを内包し、ブラウザ保存が利用できない環境でも操作とJSON書出を使えます。元のJSON・共有URLは図の配置を含み、プログラムへの変換では配置は保存されません。ブラウザ保存は他の2教材・Studioとは別のキーです。

## 動画ページの再生成

原本と動画メタデータを更新した場合は、次の順で実行します。キーワード専用データや検索ページは現在の構成にありません。

```powershell
python scripts/import_video_questions.py <問題集.xlsx> <YouTube公開メタデータ.json>
python -X utf8 scripts/build_video_programs.py
python scripts/generate_video_pages.py
```

通常の分類・本文の変更は `data/video-curriculum.json` を編集してから `python scripts/generate_video_pages.py` を実行します。生成時にQ1〜Q330の重複、21ジャンルの網羅性、5分野の件数、最短コースの順序を検証します。
プログラミング問題の原文・答えや最短コースの対象問題を変更した場合は、先に
`scripts/build_video_programs.py` で実行データを再生成します。実行データは原文のハッシュで照合し、
未更新の状態では動画ページの生成を止めます。問題ごとの穴埋め・入力条件・前提表はこの生成スクリプトで管理します。

## 講義ノートとサイトマップ

```powershell
node scripts/build_lecture_data.mjs
node scripts/build_lecture_pages.mjs
python scripts/update_sitemap.py --app-root <info1-quiz-appのリポジトリルート>
```

`--check` を付けると生成物を変更せず整合性を検査できます。サイトマップはポータルとアプリのビルドレポートから、現行の公開URLだけを組み立てます。

## 用語解説

noteの用語解説記事を移行するときは、移行記録と対応表を [`docs/TERM_GUIDE_MIGRATION.md`](docs/TERM_GUIDE_MIGRATION.md) で確認します。用語ページを追加したら、ページの `<meta name="study-atlas-term-tag">` を設定し、次を実行します。

```powershell
python scripts/generate_term_guides.py
python scripts/update_sitemap.py --app-root ..\info1-quiz-app
```

用語一覧はExcelのNo.順を正本にし、用語ページのタグメタデータを走査して、公開ページがある用語だけをリンク付きで生成します。記事未作成のタグは表示されず、ページ追加後にこの生成処理を実行すると自動的に一覧へ加わります。URLのslugを推測して手動登録する必要はありません。
通常の生成・検証では `data/term-tag-list.json` を読み込み、PC固有のファイルや追加ライブラリに依存しません。
元のExcelを更新したときは、`openpyxl` が使える環境で次を実行して公開用スナップショットを更新します。

```powershell
python scripts/generate_term_guides.py --tag-list <タグ一覧.xlsxのパス> --update-tag-list
```

## 検証

```powershell
python scripts/validate_portal.py --app-root <info1-quiz-appのリポジトリルート>
python scripts/validate_manual_ads.py
python scripts/validate_study_atlas.py --portal-root . --app-root <info1-quiz-appのリポジトリルート>
```

ポータル検証では、動画の数値・URL、用語一覧が公開済み記事だけをメタデータ由来リンクで表示していること、SEOメタデータ・JSON-LD・パンくず・内部リンク・トップ構成・動画キーワード機能の不在・サイトマップ同期を確認します。手動広告検証では、対象ページだけに共通コードが1回あり、動画・講義・用語・アプリの枠数と位置が規則どおりであることを確認します。統合検証では、アプリの1,438問・225タグ、タグAND検索、アプリ復帰URL、学習アプリ本体の保護ハッシュも確認します。管理画面とスロット設定は [`docs/ADSENSE_CONFIGURATION.md`](docs/ADSENSE_CONFIGURATION.md) を参照してください。

## 公開URL

```text
https://mei-chan-nel.com/
https://mei-chan-nel.com/terms/
https://mei-chan-nel.com/info1-quiz-app/questions/
https://mei-chan-nel.com/info1-quiz-app/app/
```

公開元は `main` ブランチのリポジトリルートです。
