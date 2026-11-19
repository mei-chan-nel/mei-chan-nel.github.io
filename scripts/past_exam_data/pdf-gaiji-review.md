# 外字フォント追加確認

4PDFのGaiji系フォントを走査し、PyMuPDFのrawdictに現れる3フォント・28種類の文字（空白1種類を含む）を実PDFの拡大画像で確認した。すべて明確に判読でき、SVG代替が必要な不明文字はない。

`pdf-gaiji-map.json`は既存グリフマップと同じ`{fontName: {str(ord(char)): string}}`形式。rawdictのspan名3種類に加え、PDFフォント辞書の完全名3種類も別名として収録した。

- HeiGotGaiji-W5のU+E070はⓐ、U+E076はⓖ。2025本試験のLED名称。
- HeiMinGaiji-W3のU+E0B1〜E0B6は(1)〜(6)、U+E0C0は(16)、U+E120〜E123は(a)〜(d)、U+E140〜E142は(A)〜(C)。括弧を含む一体の字形なので、確実に表示・参照できる通常のUnicode文字列へ対応付けた。U+E0C0は2026本試験の16進数の基数表記。
- HeiMinGaiji-W3-90msp-RKSのU+01C8はⓐ、U+01CE〜U+01D7は⓪〜⑨。2026追試験SNS投稿の下線部記号。ダイアクリティカルマーク付きの文字ではない。
- 同外字フォントの空白U+0020は空白のまま保持。

`pdf-gaiji-atlas.png`に全28種類の拡大一覧、`pdf-gaiji-records.json`に出典PDF・ページ・bbox・出現数を記録した。未出のLED b〜fなどは実画像で確認していないため、推測したマッピングは加えていない。PDFやアプリ、インポーターは変更していない。
