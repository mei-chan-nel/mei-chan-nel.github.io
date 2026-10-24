// e-Stat household expenditure, item 356. The accompanying CSV and README
// record the unmodified observations, extraction and verification provenance.
export const householdSeries = Object.freeze({
  name: "アイスクリーム・シャーベットの月別支出金額",
  label: "支出金額（円）",
  unit: "円",
  population: "全国・二人以上の世帯、1世帯当たり",
  start: "2009-01",
  end: "2018-12",
  sourceName: "総務省統計局「家計調査」",
  sourceUrl:
    "https://www.e-stat.go.jp/stat-search/database?layout=datalist&toukei=00200561&tstat=000000330001",
  archiveUrl:
    "https://github.com/hkawash/sis-intro/blob/b5bb7d5580c253155bd351de489181e21cdc30b6/data/FEH_00200561_190526191958.csv",
  retrieved: "2026-10-24",
  values: [
    351, 303, 386, 569, 768, 819, 1072, 1215, 723, 495, 402, 440, 362, 305, 383,
    464, 752, 841, 1211, 1451, 864, 504, 351, 423, 346, 289, 329, 462, 672, 791,
    1265, 1241, 767, 516, 393, 423, 339, 274, 385, 524, 671, 798, 1165, 1332,
    849, 515, 326, 414, 363, 322, 438, 525, 761, 878, 1234, 1437, 794, 549, 370,
    445, 396, 309, 447, 520, 803, 900, 1202, 1238, 748, 570, 419, 455, 401, 345,
    480, 590, 928, 894, 1257, 1384, 768, 603, 478, 581, 464, 397, 493, 617, 890,
    883, 1292, 1387, 843, 621, 459, 561, 489, 382, 472, 624, 915, 914, 1394,
    1370, 826, 599, 489, 573, 507, 416, 607, 746, 894, 1021, 1506, 1443, 861,
    640, 492, 537,
  ],
});
export const householdMonths = householdSeries.values.map(
  (_, i) =>
    `${2009 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`,
);

Object.freeze(householdSeries.values);
Object.freeze(householdMonths);
