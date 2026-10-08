# Interactive Lab

情報Ⅰの概念を操作・実験・可視化で理解する教材です。入口は動画解説ページと同じく、6分野の見出しの下に個別教材のカードを並べます。教材を一つずつ設計し、追加します。以前の18教材は撤回済みです。

## 現在の教材

### 画像のデジタル化

`/lab/digital-image/`：画像のデジタル化。

- 元画像と処理後の画像を同じ正方形の範囲で比較。
- 画素数は4〜1024画素四方の109段階。32までは1画素刻み、64までは2画素刻み、以降は4・8・16・32画素刻みで変更。
- カラーはR・G・Bそれぞれ1〜8ビット。各成分を独立した上げ下げボタンで変更。
- グレースケールは1〜8ビット。表現・ビット数・成分表示を同じグループに配置。
- RGB合成／Rのみ／Gのみ／Bのみの表示。
- 画素数はスライダーで変更。つまみは滑らかに動き、画像は各段階で更新。矢印キーは1段階ずつ変更。
- ビット数の小さな増減ボタンは上下に配置。長押しで連続変更、矢印キーでも操作可能。
- 元画像のグリッドは処理後の画素に対応。オン／オフ可能で、画素が細かい場合は線を薄く表示。
- PCでは操作欄を左、比較画像と結果を右に配置。スマートフォンでは操作欄・比較画像・結果の順に配置。画面の高さに合わせて画像サイズを調整。
- 初期設定に戻すボタン。画像は保持して設定だけをリセット。
- 理論上の色数と非圧縮画像データ量を表示。
- 画像の差し替え、拡大表示。選んだ画像はブラウザ内で処理し、外部送信しません。

初期表示はコードで描画するサンプルです。6個の玉を色相環の順に、上から時計回りに赤・黄・緑・シアン・青・マゼンタと配置し、細線・グレースケールも含みます。

常設の写真を設定するときは、`lab/digital-image/` に画像を置き、`tools/templates/digital-image.html` の `data-source-image` に相対パスを指定して再生成します。「画像を変更」で手元のファイルを選ぶこともできます。写真は中央から正方形に切り出し、最大1024画素四方に縮小します。

各領域の平均色を代表値とし、等間隔の段階へ丸めます。グレースケールは符号化されたRGB値を0.299・0.587・0.114で重み付けした近似です。データ量には圧縮・ヘッダー・透明度を含めません。R/G/B単独表示は表示上のマスクで、保存するRGBのビット数を変更しません。

### 論理回路をつくる

`/lab/logic-circuit/`。講義ノートの論理演算ページと同じ図記号をSVGで描画します。

- AND・OR・NOT・分岐をドラッグまたはタップで配置。部品の移動、端子のドラッグ／順番にタップする配線、入力0／1の切り替え。
- ゲートに作成順の番号と現在の出力を表示。削除しても残ったゲートの番号は変更しません。
- 分岐は1入力・2出力で同じ信号を渡します。線の上へのドロップ、または選択した線に分岐パーツを追加すると、途中に挿入して既存の接続を保持します。出力端子から複数の線をつなぐことも可能です。
- 真理値表は入力・各ゲートと分岐・最終出力を表示。行を選ぶとその入力を回路へ反映。
- 入力と出力は各1〜4個。入力のすべての組合せを列挙し、入力4個で16行。必要な入力がそろわない部品は演算せず「—」と表示し、未接続を0とは扱いません。
- 入力端子への接続は1本。つなぎ直すと以前の線を置換。組合せ回路に限定し、循環する接続は拒否します。信号の遅延は扱いません。
- 配線・部品の削除、元に戻す／やり直す、白紙にする。部品と線はキーボードでも選択できます。矢印キーは部品の移動、Enter／Spaceは端子選択や入力切り替え。
- 全体表示、拡大縮小、余白のドラッグによる表示の移動。スマートフォンはピンチで拡大縮小。
- AND・OR・NOT・排他的論理和・半加算器の回路例。排他的論理和と半加算器もAND・OR・NOTの組合せで構成。
- 作成した回路はブラウザ内に自動保存。保存機能が使用できない環境でも操作できます。外部通信は行いません。

## 構成

- `catalog.mjs`: 6分野と教材の一覧。
- `tools/build-pages.mjs` / `tools/shell.mjs`: 共通ヘッダー・フッターとページ生成。
- `tools/templates/`: 個別教材のHTMLテンプレート。
- `lab.css`: 入口のレイアウト。既存の `assets/site.css` のスタイルを利用。
- `digital-image/image.mjs` / `image.css`: 操作と表示。
- `digital-image/pixels.mjs`: 領域平均、量子化、成分表示。
- `logic-circuit/circuit.mjs`: 接続検証・組合せ回路の評価・真理値表。
- `logic-circuit/symbols.mjs` / `examples.mjs`: 講義ノートに合わせた記号と回路例。
- `logic-circuit/editor.mjs` / `circuit.css`: 配置・配線・表示・操作。
- `tools/build-render-worker.mjs` / `digital-image/render-source.mjs`: 同じ計算モデルから生成するWeb Worker。画像処理を操作とは別のスレッドで行い、最新の設定を優先します。Workerが使えない環境では通常処理に切り替えます。ダウンロードHTMLにも内包します。
- `navigation.mjs`: ナビゲーションの表示補助。解析・広告スクリプトは読み込みません。

```sh
node lab/tools/build-pages.mjs
node lab/tools/build-pages.mjs --check
node --test scripts/interactive-lab*.test.mjs
python3 scripts/preview_site.py --host 127.0.0.1 --port 8773 --app-root /workspace/info1-quiz-app
```

配信した `/lab/` を開いて確認します。ページの実行にnpmインストールは不要です。

## 開発用ブラウザ確認

Playwright、axe-coreとChromiumを使用します。配信するページの依存関係ではありません。

```sh
LAB_PLAYWRIGHT_MODULE=/workspace/.lab-test-tools/node_modules/playwright \
LAB_AXE_MODULE=/workspace/.lab-test-tools/node_modules/axe-core/axe.min.js \
node lab/tools/test-image.mjs

LAB_PLAYWRIGHT_MODULE=/workspace/.lab-test-tools/node_modules/playwright \
LAB_AXE_MODULE=/workspace/.lab-test-tools/node_modules/axe-core/axe.min.js \
node lab/tools/test-circuit.mjs
```

1280×720、390×844、320×740pxで操作欄・比較画像・結果が表示範囲内に収まることを確認します。色とビット数、画素数、成分表示、データ量、グリッド、長押しと停止、初期設定へのリセット、キーボード・タッチ操作、拡大、画像アップロード、読み込み失敗も検証します。WCAG A/AAは自動検出可能な範囲の検査です。

回路は幅1280・390・320pxで、部品の追加／移動、マウスとタッチによる配線、分岐の挿入、入力と真理値表の連動、未接続、循環接続の拒否、削除と取り消し、保存からの復元、キーボード操作を検証します。ダウンロードHTMLは外部リソースなしで半加算器の出力を確認します。

## ダウンロード用HTML

開発用のesbuildでCSSとJavaScriptを埋め込んだHTMLを生成できます。ブラウザで開くためのサーバーは不要です。

```sh
LAB_ESBUILD_MODULE=/workspace/.lab-test-tools/node_modules/esbuild \
node lab/tools/build-preview.mjs /workspace/interactive-lab-review
```

常設の写真を設定した場合は画像も埋め込みます。現在のサンプルはコードで描画するため外部ファイルを必要としません。

## 未公開

既存サイトの全体トップ・サイトマップ・公開設定は変更しません。Labのページは `noindex, nofollow` です。変更は作業用ブランチに保存し、公開元の `main` への反映・デプロイは行いません。
