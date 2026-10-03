import { literal as v, ref as r, param as p, op, at, length, call, random, assign, print, input, branch, otherwise, repeat, whileLoop, define, returnValue, numberField as field, arrayField } from "./language.js?v=20261003-video";
import { cloneValue, formatValue, validateField } from "./values.js?v=20261003-video";
import { VIDEO_PROGRAMS, VIDEO_VARIANTS } from "./video-programs.js?v=20261003-library";

/** 代表問題の正本。表記・命令データ・設定値・外部入力の条件を分離して管理する。 */
const add = (a, b) => op("+", a, b);
const sub = (a, b) => op("-", a, b);
const modIsZero = (a, divisor) => op("==", op("%", a, v(divisor)), v(0));
const ageInput = field("age", "年齢 age", 18, 0, 120);
const numberInput = field("number", "整数 number", 12, -9999, 9999);
const bubbleInput = arrayField("Array", "配列 Array", [5, 3, 8, 1, 4], { minLength: 2, maxLength: 12 });
const searchInput = arrayField("Array", "昇順の配列 Array", [3, 7, 12, 18, 25, 31, 42], { sorted: true });
const targetInput = field("target", "探す値 target", 18, -999, 999);

export const MAX_ITERATIONS = 500;
export const EXAMPLES = [
  {
    id: "addition", number: 1, title: "2つの値の合計", category: "順次処理", accent: "coral",
    description: "値を入れて、計算して、表示する。基本の流れを確かめよう。", focus: "計算結果が、別の変数に入る様子に注目。",
    parameters: [field("x", "x の初期値", 3), field("y", "y の初期値", 4)],
    source: ["x = {x}", "y = {y}", "goukei = x + y", '表示する("合計は",goukei,"です。")'],
    program: [assign(1, "x", p("x")), assign(2, "y", p("y")), assign(3, "goukei", add(r("x"), r("y"))), print(4, v("合計は"), r("goukei"), v("です。"))],
  },
  {
    id: "swap", number: 2, title: "値の入れ替え", category: "順次処理", accent: "blue",
    description: "一時的な変数 tmp を使って、x と y の値を入れ替えよう。", focus: "tmp に残した値が、最後にどこへ入るかに注目。",
    parameters: [field("x", "x の初期値", 1), field("y", "y の初期値", 2)],
    source: ["x = {x}", "y = {y}", "tmp = x", "x = y", "y = tmp", '表示する("現在のxの値は", x, "です。")', '表示する("現在のyの値は", y, "です。")'],
    program: [assign(1, "x", p("x")), assign(2, "y", p("y")), assign(3, "tmp", r("x")), assign(4, "x", r("y")), assign(5, "y", r("tmp")), print(6, v("現在のxの値は"), r("x"), v("です。")), print(7, v("現在のyの値は"), r("y"), v("です。"))],
  },
  {
    id: "array-swap", number: 3, title: "配列の要素を入れ替える", category: "配列", accent: "blue",
    description: "Data[0] と Data[2] を交換。要素番号と値を見比べよう。", focus: "配列の番号は0から。変更した要素だけが色づきます。",
    parameters: [arrayField("Data", "配列 Data の初期値", [3, 5, 9], { minLength: 3 })],
    source: ["Data = {Data}", "tmp = Data[0]", "Data[0] = Data[2]", "Data[2] = tmp", '表示する("現在のDataは", Data)'],
    program: [assign(1, "Data", p("Data")), assign(2, "tmp", at("Data", v(0))), assign(3, "Data", at("Data", v(2)), v(0)), assign(4, "Data", r("tmp"), v(2)), print(5, v("現在のDataは"), r("Data"))],
  },
  {
    id: "condition", number: 4, title: "年齢で分岐する", category: "条件分岐・入力", accent: "amber",
    description: "年齢を入力し、18歳以上かどうかで表示を変えよう。", focus: "入力した年齢によって、実行する枝が変わります。",
    parameters: [{ ...ageInput, label: "年齢の入力候補" }], inputs: [ageInput],
    source: ["age = 【外部からの入力】", "もし age >= 18 ならば：", '｜ 表示する("成人です。")', "そうでなければ：", '⎿ 表示する("未成年です。")'],
    program: [input(1, "age", ageInput), branch(2, op(">=", r("age"), v(18)), [print(3, v("成人です。"))], otherwise(4, print(5, v("未成年です。"))))],
  },
  {
    id: "multiples", number: 5, title: "倍数を判定する", category: "条件分岐・入力", accent: "amber",
    description: "余りを調べて、6・2・3の倍数を順に判定しよう。", focus: "% は割った余り。最初に成り立った枝だけを実行します。",
    parameters: [{ ...numberInput, label: "整数の入力候補" }], inputs: [numberInput],
    source: ["number = 【外部からの入力】", "もし number % 6 == 0 ならば：", '｜ 表示する("6の倍数")', "そうでなくもし number % 2 == 0 ならば：", '｜ 表示する("2の倍数だが3の倍数でない")', "そうでなくもし number % 3 == 0 ならば：", '｜ 表示する("3の倍数だが2の倍数でない")', "そうでなければ：", '⎿ 表示する("2の倍数でも3の倍数でもない")'],
    program: [input(1, "number", numberInput), branch(2, modIsZero(r("number"), 6), [print(3, v("6の倍数"))], branch(4, modIsZero(r("number"), 2), [print(5, v("2の倍数だが3の倍数でない"))], branch(6, modIsZero(r("number"), 3), [print(7, v("3の倍数だが2の倍数でない"))], otherwise(8, print(9, v("2の倍数でも3の倍数でもない"))))))],
  },
  {
    id: "for-loop", number: 6, title: "回数を決めた繰り返し", category: "繰り返し", accent: "mint",
    description: "i を順に増やしながら、sum に値を足していこう。", focus: "繰り返すたびに、i と sum がどう変わるかに注目。",
    parameters: [field("sum", "sum の初期値", 0), field("start", "i の開始値", 1, -999, 999), field("end", "i の終了値（この値を含む）", 5, -999, 999), field("step", "1回ごとに増やす値", 1, 1, 100)],
    validate(values) { return Math.max(0, Math.floor((values.end - values.start) / values.step) + 1) > MAX_ITERATIONS ? `繰り返しが ${MAX_ITERATIONS} 回以内になる範囲にしてください。` : null; },
    source: ["sum = {sum}", "i を {start} から {end} まで {step} ずつ増やしながら繰り返す：", "｜ sum = sum + i", '⎿ 表示する("現在の合計は", sum)', '表示する("最終的な合計は", sum)'],
    program: [assign(1, "sum", p("sum")), repeat(2, "i", p("start"), p("end"), [assign(3, "sum", add(r("sum"), r("i"))), print(4, v("現在の合計は"), r("sum"))], p("step")), print(5, v("最終的な合計は"), r("sum"))],
  },
  {
    id: "average", number: 7, title: "配列の平均点を求める", category: "配列・繰り返し", accent: "mint",
    description: "配列の要素をすべて足して、要素数で割ろう。", focus: "要素を増減すると、繰り返す回数と平均点も変わります。",
    parameters: [arrayField("Tokuten", "得点の配列 Tokuten", [5, 7, 8, 4], { min: 0, max: 100 })],
    source: ["Tokuten = {Tokuten}", "sum = 0", "i を 0 から 要素数(Tokuten) - 1 まで 1 ずつ増やしながら繰り返す", "⎿ sum = sum + Tokuten[i]", "average = sum / 要素数(Tokuten)", '表示する("平均点は", average, "点です")'],
    program: [assign(1, "Tokuten", p("Tokuten")), assign(2, "sum", v(0)), repeat(3, "i", v(0), sub(length("Tokuten"), v(1)), [assign(4, "sum", add(r("sum"), at("Tokuten", r("i"))))]), assign(5, "average", op("/", r("sum"), length("Tokuten"))), print(6, v("平均点は"), r("average"), v("点です"))],
  },
  {
    id: "count-multiples", number: 8, title: "3の倍数を数える", category: "繰り返し・分岐", accent: "mint",
    description: "繰り返しの中で条件を確かめ、該当する数だけ数えよう。", focus: "count が増えるのは、i が3の倍数のときだけです。",
    parameters: [field("end", "i の終了値", 10, 1, 500)],
    source: ["count = 0", "i を 1 から {end} まで 1 ずつ増やしながら繰り返す：", "｜ もし i % 3 == 0 ならば：", "⎿ ⎿ count = count + 1", '表示する("3の倍数の個数は", count)'],
    program: [assign(1, "count", v(0)), repeat(2, "i", v(1), p("end"), [branch(3, modIsZero(r("i"), 3), [assign(4, "count", add(r("count"), v(1)))])]), print(5, v("3の倍数の個数は"), r("count"))],
  },
  {
    id: "maximum", number: 9, title: "配列の最大値を探す", category: "配列・分岐", accent: "blue",
    description: "要素を順に比べ、これまでの最大値を更新しよう。", focus: "max_value が変わる要素と、変わらない要素を比べよう。",
    parameters: [arrayField("Data", "配列 Data の初期値", [54, 23, 34, 67, 49])],
    source: ["Data = {Data}", "max_value = Data[0]", "i を 1 から 要素数(Data) - 1 まで 1 ずつ増やしながら繰り返す：", "｜ もし Data[i] > max_value ならば：", "⎿ ⎿ max_value = Data[i]", '表示する("配列Data内の最大の数は", max_value)'],
    program: [assign(1, "Data", p("Data")), assign(2, "max_value", at("Data", v(0))), repeat(3, "i", v(1), sub(length("Data"), v(1)), [branch(4, op(">", at("Data", r("i")), r("max_value")), [assign(5, "max_value", at("Data", r("i")))])]), print(6, v("配列Data内の最大の数は"), r("max_value"))],
  },
  {
    id: "matrix", number: 10, title: "二重ループで九九を作る", category: "二次元配列", accent: "violet",
    description: "i と j の組み合わせを使い、表の各マスを埋めよう。", focus: "外側の i が進むたびに、内側の j は1から始まります。",
    parameters: [field("rows", "i の終了値（行数）", 5, 1, 10), field("columns", "j の終了値（列数）", 3, 1, 10)],
    arrayShapes: { Kuku: { rows: "rows", columns: "columns", start: 1 } },
    source: ["i を 1 から {rows} まで 1 ずつ増やしながら繰り返す：", "｜ j を 1 から {columns} まで 1 ずつ増やしながら繰り返す：", "⎿ ⎿ Kuku[i, j] = i * j", "表示する(Kuku)"],
    program: [repeat(1, "i", v(1), p("rows"), [repeat(2, "j", v(1), p("columns"), [assign(3, "Kuku", op("*", r("i"), r("j")), r("i"), r("j"))])]), print(4, r("Kuku"))],
  },
  {
    id: "while-loop", number: 11, title: "合計が20以上になるまで", category: "条件による繰り返し", accent: "violet",
    description: "1、2、3…と足し、合計の条件を満たす間だけ繰り返そう。", focus: "sum < {limit} が偽になると終了します。境界の値にも注目。",
    parameters: [field("sum", "sum の初期値", 0, 0, 1000), field("i", "i の初期値", 0, 0, 100), field("limit", "sum と比べる値", 20, 1, 1000)],
    source: ["sum = {sum}, i = {i}", "sum < {limit} の間繰り返す：", "｜ i = i + 1", "｜ sum = sum + i", '⎿ 表示する("現在のsumは", sum ,", iは", i)', '表示する("sumが{limit}を超えるのはiが", i, "のときです")'],
    program: [{ type: "assign", line: 1, assignments: [{ name: "sum", expression: p("sum") }, { name: "i", expression: p("i") }] }, whileLoop(2, op("<", r("sum"), p("limit")), assign(3, "i", add(r("i"), v(1))), assign(4, "sum", add(r("sum"), r("i"))), print(5, v("現在のsumは"), r("sum"), v(", iは"), r("i"))), print(6, { type: "text", parts: ["sumが", p("limit"), "を超えるのはiが"] }, r("i"), v("のときです"))],
  },
  {
    id: "bubble-sort", number: 12, title: "バブルソート", category: "アルゴリズム・入力", accent: "coral",
    description: "隣り合う要素を比べて交換し、配列を小さい順に並べよう。", focus: "Array[j] と Array[j + 1] の位置と交換の順序に注目。",
    parameters: [{ ...bubbleInput, label: "配列の入力候補" }], inputs: [bubbleInput],
    source: ["Array = 【外部からの入力】", "i を 0 から 要素数(Array) - 2 まで 1 ずつ増やしながら繰り返す：", "｜ j を 0 から 要素数(Array) - i - 2 まで 1 ずつ増やしながら繰り返す：", "｜ ｜ もし Array[j] > Array[j + 1]ならば：", "｜ ｜ ｜ tmp = Array[j]", "｜ ｜ ｜ Array[j] = Array[j + 1]", "⎿ ⎿ ⎿ Array[j + 1] = tmp", '表示する("バブルソート後：", Array)'],
    program: [input(1, "Array", bubbleInput), repeat(2, "i", v(0), sub(length("Array"), v(2)), [repeat(3, "j", v(0), sub(sub(length("Array"), r("i")), v(2)), [branch(4, op(">", at("Array", r("j")), at("Array", add(r("j"), v(1)))), [assign(5, "tmp", at("Array", r("j"))), assign(6, "Array", at("Array", add(r("j"), v(1))), r("j")), assign(7, "Array", r("tmp"), add(r("j"), v(1)))])])]), print(8, v("バブルソート後："), r("Array"))],
  },
  {
    id: "binary-search", number: 13, title: "二分探索", category: "アルゴリズム・入力", accent: "coral", lineNumberDigits: 2,
    description: "昇順の配列から、探す範囲を半分ずつ絞り込もう。", focus: "low・high が範囲の両端、mid が中央。÷ は整数の商です。",
    parameters: [{ ...searchInput, label: "昇順の配列の入力候補" }, { ...targetInput, label: "探す値の入力候補" }], inputs: [searchInput, targetInput],
    source: ["Array = 【外部からの入力】", "target = 【外部からの入力】", "low = 0 , high = 要素数(Array) - 1", "found = 0", "low <= high の間繰り返す：", "｜ mid = (low + high) ÷ 2", "｜ もし Array[mid] == target ならば：", "｜ ｜ found = 1", "｜ ｜ low = high + 1", "｜ そうでなくもし Array[mid] < target ならば：", "｜ ｜ low = mid + 1", "｜ そうでなければ：", "⎿ ⎿ high = mid - 1", "もし found == 1 ならば：", '｜ 表示する(target, "は配列の", mid, "番目の要素です")', "そうでなければ：", '⎿ 表示する(target, "は配列の中に存在しません")'],
    program: [input(1, "Array", searchInput), input(2, "target", targetInput), { type: "assign", line: 3, assignments: [{ name: "low", expression: v(0) }, { name: "high", expression: sub(length("Array"), v(1)) }] }, assign(4, "found", v(0)), whileLoop(5, op("<=", r("low"), r("high")), assign(6, "mid", op("÷", add(r("low"), r("high")), v(2))), branch(7, op("==", at("Array", r("mid")), r("target")), [assign(8, "found", v(1)), assign(9, "low", add(r("high"), v(1)))], branch(10, op("<", at("Array", r("mid")), r("target")), [assign(11, "low", add(r("mid"), v(1)))], otherwise(12, assign(13, "high", sub(r("mid"), v(1))))))), branch(14, op("==", r("found"), v(1)), [print(15, r("target"), v("は配列の"), r("mid"), v("番目の要素です"))], otherwise(16, print(17, r("target"), v("は配列の中に存在しません"))))],
  },
  {
    id: "factorial", number: 14, title: "再帰で階乗を求める", category: "関数・再帰", accent: "violet",
    description: "自分自身を呼び出す関数。呼び出しと戻り値の流れを追おう。", focus: "呼び出しごとに n は別の値。0に達すると順に結果を返します。",
    parameters: [field("n", "factorial に渡す値", 5, 0, 10)],
    source: ["定義する factorial(n)", "｜ もし n == 0 ならば：", "｜ ｜ 返す 1", "｜ そうでなければ：", "⎿ ⎿ 返す n * factorial(n - 1)", "表示する(factorial({n}))"],
    program: [define(1, "factorial", ["n"], branch(2, op("==", r("n"), v(0)), [returnValue(3, v(1))], otherwise(4, returnValue(5, op("*", r("n"), call("factorial", sub(r("n"), v(1)))))))), print(6, call("factorial", p("n")))],
  },
  {
    id: "monte-carlo", number: 15, title: "乱数で円周率を推定する", category: "乱数・シミュレーション", accent: "amber",
    description: "ランダムに点を打ち、円の内側に入った割合から円周率を求めよう。", focus: "乱数() は0以上1未満。条件が真のときだけ kosu が増えます。",
    parameters: [field("kaisu", "試行回数 kaisu", 1000, 1, 1500)],
    source: ["kaisu = {kaisu}", "kosu = 0", "i を 1 から kaisu まで 1 ずつ増やしながら繰り返す：", "｜ x = 乱数()", "｜ y = 乱数()", "｜ もし x ** 2 + y ** 2 <= 1 ならば：", "⎿ ⎿ kosu = kosu + 1", '表示する("円周率の推定値は", 4 * kosu / kaisu)'],
    program: [assign(1, "kaisu", p("kaisu")), assign(2, "kosu", v(0)), repeat(3, "i", v(1), r("kaisu"), [assign(4, "x", random()), assign(5, "y", random()), branch(6, op("<=", add(op("**", r("x"), v(2)), op("**", r("y"), v(2))), v(1)), [assign(7, "kosu", add(r("kosu"), v(1)))])]), print(8, v("円周率の推定値は"), op("/", op("*", v(4), r("kosu")), r("kaisu")))],
  },
].map((example) => ({ collection: "representative", inputs: [], ...example }));

export function defaultParameters(example) {
  const values = Object.fromEntries(example.parameters.map((field) => [field.key, validateField(field, cloneValue(field.defaultValue)).value]));
  return example.deriveParameters?.(values) ?? values;
}

export function validateParameters(example, raw) {
  const values = {};
  const errors = {};
  for (const field of example.parameters) {
    const result = validateField(field, raw[field.key]);
    if (result.error) errors[field.key] = result.error;
    else values[field.key] = result.value;
  }
  const formError = Object.keys(errors).length ? null : example.validate?.(values) ?? null;
  return { valid: !Object.keys(errors).length && !formError, values: !Object.keys(errors).length ? example.deriveParameters?.(values) ?? values : values, errors, formError };
}

export function parameterText(text, values) {
  const sourceValue = (value) => Array.isArray(value) ? `[${value.map(sourceValue).join(", ")}]` : typeof value === "string" ? JSON.stringify(value) : formatValue(value);
  return text.replace(/\{([\p{L}\p{N}_]+)\}/gu, (_, key) => sourceValue(values[key]));
}

export function lineLabel(example, line) {
  if (example.lineLabels?.[line - 1]) return example.lineLabels[line - 1];
  return `（${String(line).padStart(example.lineNumberDigits ?? 1, "0")}）`;
}

export function sourceLines(example, values) {
  return example.source.map((text, index) => ({ line: index + 1, text: parameterText(text, values) }));
}

/** 動画解説の問題は、この別のコレクションへ questionId を持つ定義を追加する。 */
export { VIDEO_PROGRAMS };
export const PROGRAMS = [...EXAMPLES, ...VIDEO_PROGRAMS];
export const findProgram = (id) => [...PROGRAMS, ...VIDEO_VARIANTS].find((program) => program.id === id);
export const programForQuestion = (questionId) => VIDEO_PROGRAMS.find((program) => program.questionId === questionId);
