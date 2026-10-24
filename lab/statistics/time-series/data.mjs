// e-Stat household expenditure, item 356. The accompanying CSV and README
// record the unmodified observations, extraction and verification provenance.
export const householdSeries = Object.freeze({
  name: "アイスクリーム・シャーベットの月別支出金額",
  label: "支出金額（円）",
  unit: "円",
  population: "全国・二人以上の世帯、1世帯当たり",
  start: "2016-01",
  end: "2025-12",
  sourceName: "総務省統計局「家計調査」",
  sourceUrl:
    "https://www.e-stat.go.jp/stat-search/database?layout=datalist&toukei=00200561&tstat=000000330001",
  archiveUrl:
    "https://github.com/tail-island/machine-learning-primer/blob/d2bfc058889a43d6ff7c14d677616aee7e0e3cf1/ice_cream/dataset.py",
  retrieved: "2026-10-24",
  values: [
    464, 397, 493, 617, 890, 883, 1292, 1387, 843, 621, 459, 562, 489, 382, 472,
    624, 915, 914, 1394, 1370, 826, 599, 489, 573, 507, 416, 607, 746, 894,
    1021, 1506, 1443, 861, 640, 492, 537, 494, 423, 542, 667, 1000, 991, 1236,
    1513, 996, 724, 531, 584, 510, 482, 610, 689, 1040, 1123, 1155, 1658, 1025,
    649, 573, 599, 510, 458, 602, 708, 915, 1089, 1485, 1427, 973, 779, 582,
    620, 581, 504, 631, 781, 975, 1109, 1551, 1516, 1083, 794, 660, 663, 550,
    500, 665, 797, 1063, 1142, 1688, 1710, 1234, 823, 682, 724, 633, 581, 703,
    924, 1100, 1282, 1684, 1753, 1282, 911, 691, 750, 643, 581, 781, 930, 1127,
    1423, 1854, 1906, 1324, 902, 740, 834,
  ],
});
export const householdMonths = householdSeries.values.map(
  (_, i) =>
    `${2016 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`,
);

Object.freeze(householdSeries.values);
Object.freeze(householdMonths);
