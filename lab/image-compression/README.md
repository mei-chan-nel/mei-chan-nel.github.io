# 画像圧縮

同じ8bit sRGB・RGBA画素をBMP / PNG / GIF / JPEG / WebP / AVIFに変換し、実ファイルを復号して比較するInteractive Labです。画像はブラウザ内だけで処理します。画像を渡すAPIやサーバー処理はありません。

- `model.mjs`: 非圧縮BMP、PNGフィルタとDEFLATE、GIFパレットとLZW、画質指標、実測サイズ探索。
- `worker.mjs` / `pool.mjs`: 端末に応じて1〜3並列。形式ごとのキャンセル・再実行、待機・準備・圧縮・復号時間を区別。
- `vendor/`: jSquashのMozJPEG / libwebp / libavif・AOMのWASMエンコーダーとデコーダー。配布版とライセンスは `vendor/LICENSES.txt` に記載。
- `app.mjs`: 6プリセット・画像読込・形式別設定・時間と設定の解説・ダウンロード。詳細比較は左を元画像に固定し、右の形式と設定を連動。
- `controls.mjs`: 可逆／非可逆／非圧縮の表示と、右ほど圧縮を強めるスライダーの座標変換。品質値は形式ごとに固有の尺度。
- `comparison-worker.mjs`: 白背景でのRGB PSNR、RGBA完全一致、α誤差、強調差分。
- `fullscreen.mjs`: 他のLabに合わせた標準全画面と画面内全画面のフォールバック。ズーム・設定を保持。

圧縮率はファイルサイズ ÷（幅 × 高さ × RGBA 4バイト）。GIFのLZWは可逆ですが、パレット化と半透明の変換では情報が失われる場合があります。JPEGと24bit BMPは白背景に合成します。アニメーションは1フレーム、色プロファイルやメタデータは比較対象外です。

長辺上限は256 / 512 / 1024px。入力上限は20MB・4,000万画素です。サイズ合わせはGIFの色数とJPEG・非可逆WebP/AVIFの品質を実際に圧縮して探し、到達範囲と誤差を表示します。BMP・PNG・可逆モードは品質変更で合わせられません。

写真プリセットはNASAのEileen Collinsの写真（Public domain、scikit-imageのastronaut画像）。その他はCanvasで生成するオリジナルです。

HTMLの編集元は `../tools/templates/image-compression.html`。共通ページは `node lab/tools/build-pages.mjs` で生成します。WASM・Worker・プリセットを同じサイトから配信するため、単独HTML書き出しは対象外です。

`node --test scripts/interactive-lab-compression.test.mjs` で、実際のWorkerと全コーデックによる圧縮・復号、可逆でのRGBA完全一致、減色・白背景合成、実測サイズ探索、並列数制限とキャンセルを検証します。WASMはローカルから読み込み、テスト中の外部通信は拒否します。
