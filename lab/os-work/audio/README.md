# 音源の出典

「OSの仕事」の音楽アプリでは、次の3曲を切り替えて再生できます。

| 曲名 | 配布ファイル名 | 長さ | 配布サイズ |
| --- | --- | --- | --- |
| DURU Roomscene Lofi | `duru-roomscene-lofi.mp3` | 約1分44秒 | 約1.25 MB |
| DURU Rondo | `duru-rondo.mp3` | 約1分4秒 | 約0.77 MB |
| DURU Arcade Vibe | `duru-arcade-vibe.mp3` | 約1分3秒 | 約0.75 MB |

- 作曲・制作・録音: **DURU-AI / uncle-sheepsky**
- 出典: [制作者の公開リポジトリ](https://github.com/uncle-sheepsky/duru-ai-cc0-bgm)
- 原音源: [MP3フォルダー（取得時の版）](https://github.com/uncle-sheepsky/duru-ai-cc0-bgm/tree/1f63fef279098a082f2f77b3f74940b2784d37b7/mp3)
- ライセンス: [CC0 1.0 Universal（パブリックドメインへの提供）](https://creativecommons.org/publicdomain/zero/1.0/)
- ライセンス本文: [CC0-1.0.txt](./CC0-1.0.txt)

制作者の [README（取得時の版）](https://github.com/uncle-sheepsky/duru-ai-cc0-bgm/blob/1f63fef279098a082f2f77b3f74940b2784d37b7/README.md#license--please-read) は、全曲を CC0 として公開し、編曲と録音もパブリックドメインに提供すると明記しています。上記の3曲はすべてオリジナル楽曲かつ `[pure]` とされており、外部の音声サンプルや音源ライブラリを使用せず、コードで合成された音楽です。楽曲だけでなく、使用する録音の権利も確認しています。

教材への配布用に、各原音源の全体を 320 kbps MP3 から 96 kbps / 44.1 kHz / ステレオ MP3 に再圧縮しました。Rondo と Arcade Vibe は音量の余裕を確保するため、2 dB 下げています。いずれも切り取りはしていません。曲ごとの配布元、正確な長さ、取得日・ハッシュ値等は [tracks.json](./tracks.json) を参照してください。アプリ用の同じ基本情報を [tracks.mjs](./tracks.mjs) から読み込めます。`src` はラボのページを基準にしています。
