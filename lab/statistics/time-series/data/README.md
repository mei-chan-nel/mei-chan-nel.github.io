# 月別支出金額の出典

総務省統計局「家計調査」、全国・二人以上の世帯、1世帯当たりのアイスクリーム・シャーベットへの月別支出金額（円）。2016年1月〜2025年12月、120か月。

- [e-Stat](https://www.e-stat.go.jp/stat-search/database?layout=datalist&toukei=00200561&tstat=000000330001)
- 2016〜2020年は[当時の協会表を転載した公開資料](https://github.com/tail-island/machine-learning-primer/blob/d2bfc058889a43d6ff7c14d677616aee7e0e3cf1/ice_cream/dataset.py)から抽出。
- 2021〜2025年は[日本アイスクリーム協会の月別表](https://www.icecream.or.jp/iceworld/data/expenditures.html)から値を抽出。
- [収録CSV](icecream-household.csv)
- [月別合計と年計の丸めの差・全ラボの出典と加工方法](../../shared/datasets/README.md)

各月の公表値をそのまま使用し、補間や年計に合わせる調整はしていません。2026年10月24日に確認。教材の季節調整は加法分解による独自の計算です。
