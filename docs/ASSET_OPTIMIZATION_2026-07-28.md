# 公開資産最適化記録（2026-07-28）

## 結果

- 公開時に参照されない旧PNG 35点を削除：4,953,610 bytes
- 使用中PNG 13点にlossless WebPを追加：PNG 2,042,337 bytes → WebP 980,684 bytes
- 13点をすべて復号して画素単位で一致することを自動確認
- WebP対応ブラウザで13点すべてを読み込む場合の削減：1,061,653 bytes（51.98%）
- PNGフォールバック、元の幅・高さ、alt、遅延読込み、非同期デコードを維持
- 書影8か所へ `decoding="async"` を追加
- 学習アプリ側の未使用 `questions/filter-data.json` を削除：1,178,265 bytes
- 公開リポジトリ容量の純削減（PNG削除＋JSON削除−WebP追加）：5,151,191 bytes

WebPごとの寸法、変換前後の容量、削減率は
`docs/lecture-image-conversion.json` に記録した。変換はlossless WebPであり、
透過を含むRGBA復号結果をPNGと画素単位で比較した。ブラウザ上の最終目視では、
細い文字、線、矢印、数式、透過背景を確認する。

## 参照監査

削除前にHTML、CSS、JavaScript、JSON、Markdown、Python／Nodeビルドスクリプト、
`picture`、動画poster、動的なファイル名生成を検索した。次の35点は公開HTML、
実行時JavaScript、講義データ、フォールバック、poster、OGP、manifest、
構造化データから参照されていなかった。旧図版生成スクリプト内の出力名は
利用側の参照ではなく、再生成用の生成先定義として区別した。

## 削除したPNG（35点）

1. `assets/lecture-v2/digital/bases-bits.png`
2. `assets/lecture-v2/digital/binary-conversion.png`
3. `assets/lecture-v2/digital/computer-system.png`
4. `assets/lecture-v2/digital/image-digitization.png`
5. `assets/lecture-v2/digital/logic-adder.png`
6. `assets/lecture-v2/digital/logic/half-adder-table.png`
7. `assets/lecture-v2/digital/logic/logic-practice.png`
8. `assets/lecture-v2/digital/logic/logic-trace-circuit.png`
9. `assets/lecture-v2/digital/logic/logic-trace-table.png`
10. `assets/lecture-v2/digital/performance-errors.png`
11. `assets/lecture-v2/digital/signed-float-text.png`
12. `assets/lecture-v2/network/addressing.png`
13. `assets/lecture-v2/network/cryptography.png`
14. `assets/lecture-v2/network/database.png`
15. `assets/lecture-v2/network/information-system.png`
16. `assets/lecture-v2/network/integrity-tools.png`
17. `assets/lecture-v2/network/rsa-example.png`
18. `assets/lecture-v2/network/security-cia.png`
19. `assets/lecture-v2/network/tcpip-layers.png`
20. `assets/lecture-v2/programming/control-flow.png`
21. `assets/lecture-v2/programming/data-structures.png`
22. `assets/lecture-v2/programming/flowchart.png`
23. `assets/lecture-v2/programming/functions-recursion.png`
24. `assets/lecture-v2/programming/loops.png`
25. `assets/lecture-v2/programming/python-flow.png`
26. `assets/lecture-v2/programming/sorting-searching.png`
27. `assets/lecture-v2/programming/values-types.png`
28. `assets/lecture-v2/society/copyright-map.png`
29. `assets/lecture-v2/society/information-properties.png`
30. `assets/lecture-v2/society/intellectual-property.png`
31. `assets/lecture-v2/society/literacy-cycle.png`
32. `assets/lecture-v2/society/personal-data-map.png`
33. `assets/lecture-v2/society/privacy-rights.png`
34. `assets/lecture-v2/statistics/investigation-cycle.png`
35. `assets/lecture-v2/statistics/public-data-workflow.png`

## WebP化したPNG（13点）

1. `assets/lecture-v2/network/digital-signature.png`
2. `assets/lecture-v2/network/email-delivery.png`
3. `assets/lecture-v2/network/hybrid-encryption.png`
4. `assets/lecture-v2/network/network-types.png`
5. `assets/lecture-v2/network/processing-models.png`
6. `assets/lecture-v2/programming/basic-structures.png`
7. `assets/lecture-v2/statistics/descriptive-distribution.png`
8. `assets/lecture-v2/statistics/normal-distribution.png`
9. `assets/lecture-v2/statistics/regression-residual.png`
10. `assets/lecture-v2/statistics/scatter-correlation.png`
11. `assets/lecture-v2/statistics/seasonal-adjustment-example.png`
12. `assets/lecture-v2/statistics/seasonal-adjustment.png`
13. `assets/lecture-v2/statistics/time-series.png`
