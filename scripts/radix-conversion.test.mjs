import assert from "node:assert/strict";
import test from "node:test";
import { convert, parseNumber, fraction, expandFraction, MAX_INPUT_DIGITS } from "../lab/radix-conversion/conversion.mjs";
import { CONVERSION_EXAMPLES } from "../lab/radix-conversion/examples.mjs";

test("6方向で整数・小数を正確に変換する", () => {
  const cases = [
    ["25", 10, 2, "11001"], ["255", 10, 16, "FF"],
    ["1001", 2, 10, "9"], ["FF", 16, 10, "255"],
    ["10011010", 2, 16, "9A"], ["9A", 16, 2, "10011010"],
    ["13.625", 10, 2, "1101.101"], ["13.625", 10, 16, "D.A"],
    ["1001.101", 2, 10, "9.625"], ["D.A", 16, 10, "13.625"],
    ["110101.101", 2, 16, "35.A"], ["2F.A", 16, 2, "101111.101"],
    ["-13.625", 10, 16, "-D.A"], ["-.1", 2, 10, "-0.5"],
    ["+00a.f0", 16, 10, "10.9375"], ["0", 10, 2, "0"],
    ["-0.000", 10, 16, "0"], ["0001.100", 2, 2, "1.1"],
  ];
  for (const [input, source, target, expected] of cases) assert.equal(convert(input, source, target).result.text, expected, `${input} (${source} → ${target})`);
});

test("整数の精度はJavaScriptの安全な整数範囲を超えても失われない", () => {
  assert.equal(convert("9007199254740993", 10, 16).result.text, "20000000000001");
  assert.equal(convert("FFFFFFFFFFFFFFFF", 16, 10).result.text, "18446744073709551615");
  assert.equal(convert("F".repeat(64), 16, 2).result.text, "1".repeat(256));
});

test("有限小数を全進数で往復しても値が一致する", () => {
  for (let numerator = -37; numerator <= 37; numerator++) for (const denominator of [1n, 2n, 8n, 256n]) {
    const original = fraction(BigInt(numerator), denominator);
    for (const source of [2, 10, 16]) {
      const input = expandFraction(original, source).text;
      for (const target of [2, 10, 16]) {
        const result = convert(input, source, target, 256).result;
        const actual = parseNumber(result.text, target);
        assert.equal(actual.numerator, original.numerator);
        assert.equal(actual.denominator, original.denominator);
        assert.equal(result.truncated, false);
      }
    }
  }
});

test("0.1の循環開始位置と周期を分数に戻して検証する", () => {
  for (const [base, expected, start] of [[2, "0.0(0011)", 1], [16, "0.1(9)", 1]]) {
    const { result } = convert("0.1", 10, base);
    assert.equal(result.text, expected);
    assert.equal(result.repeatStart, start);
    assert.equal(result.truncated, false);
    const b = BigInt(base);
    const prefix = BigInt(Number.parseInt(result.nonRepeat || "0", base));
    const period = BigInt(Number.parseInt(result.repeat, base));
    const scale = b ** BigInt(result.nonRepeat.length);
    const cycleScale = b ** BigInt(result.repeat.length) - 1n;
    assert.deepEqual(fraction(prefix * cycleScale + period, scale * cycleScale), fraction(1n, 10n));
    assert.equal(result.steps.at(-1).remainder, result.steps[start].before);
  }
});

test("周期の末尾が表示上限に一致しても、打ち切りと誤判定しない", () => {
  const result = convert("0.2", 10, 2, 4).result;
  assert.equal(result.text, "0.(0011)");
  assert.equal(result.truncated, false);
  assert.equal(result.repeatStart, 0);
});

test("長い周期と有限小数の途中表示を区別し、丸めない", () => {
  const repeating = convert("0.0001", 10, 2, 16).result;
  assert.equal(repeating.truncated, true);
  assert.equal(repeating.repeating, true);
  assert.equal(repeating.repeatStart, null);
  assert.equal(repeating.digits, "0000000000000110");
  const input = `0.${"0".repeat(62)}1`;
  const finite = convert(input, 2, 10, 16).result;
  assert.equal(finite.truncated, true);
  assert.equal(finite.repeating, false);
  const full = convert(input, 2, 10, 256).result;
  assert.equal(full.truncated, false);
  const parsed = parseNumber(full.text, 10);
  assert.deepEqual(fraction(parsed.numerator, parsed.denominator), fraction(1n, 2n ** 63n));
});

test("割り算・掛け算の各行が等式を満たし、読む向きも結果と一致する", () => {
  for (const base of [2, 16]) {
    const { parsed, divisions, result } = convert("45.8125", 10, base);
    for (const row of divisions) assert.equal(row.dividend, row.quotient * BigInt(base) + row.remainder);
    assert.equal(divisions.map((row) => row.digit).reverse().join(""), result.integer);
    for (const row of result.steps) {
      assert.equal(row.before * BigInt(base), row.product);
      assert.equal(row.product, BigInt(Number.parseInt(row.digit, base)) * parsed.denominator + row.remainder);
    }
    assert.equal(result.steps.map((row) => row.digit).join(""), result.digits);
    assert.equal(result.steps.at(-1).remainder, 0n);
  }
});

test("小数の負の指数と16進数のA〜Fを正しく分解する", () => {
  const model = convert("AF.08", 16, 10);
  assert.deepEqual(model.terms.integer.map((term) => term.exponent), [1, 0]);
  assert.deepEqual(model.terms.fractional.map((term) => term.exponent), [-1, -2]);
  assert.deepEqual(fraction(model.terms.fractional[1].numerator, model.terms.fractional[1].denominator), fraction(1n, 32n));
  let sum = fraction(0n);
  for (const term of [...model.terms.integer, ...model.terms.fractional]) sum = fraction(sum.numerator * term.denominator + term.numerator * sum.denominator, sum.denominator * term.denominator);
  assert.deepEqual(sum, fraction(model.parsed.numerator, model.parsed.denominator));
});

test("小数点の左右で桁合わせの方向を変え、内部の0は残す", () => {
  const binary = convert("1.1", 2, 16);
  assert.equal(binary.groups.integer[0].binary, "0001");
  assert.equal(binary.groups.fractional[0].binary, "1000");
  assert.equal(binary.groups.integer[0].padding, 3);
  assert.equal(binary.groups.fractional[0].padding, 3);
  assert.equal(binary.result.text, "1.8");
  const hex = convert("10.01", 16, 2);
  assert.deepEqual(hex.groups.integer.map((g) => g.binary), ["0001", "0000"]);
  assert.deepEqual(hex.groups.fractional.map((g) => g.binary), ["0000", "0001"]);
  assert.equal(hex.result.text, "10000.00000001");
});

test("不正な桁、式、循環記法、過大入力を明確に拒否する", () => {
  for (const [input, base] of [["", 10], ["102", 2], ["A", 10], ["G", 16], ["0xA", 16], ["1e3", 10], ["1/3", 10], ["0.(3)", 10], ["1..1", 2], ["1+1", 10], ["Infinity", 10], ["<script>", 16], ["1".repeat(MAX_INPUT_DIGITS + 1), 2]]) assert.throws(() => parseNumber(input, base), Error, `${input} (${base})`);
  assert.throws(() => convert("1", 8, 2));
  assert.throws(() => convert("1", 10, 8));
  assert.throws(() => convert("1", 10, 2, 0));
});

test("学習用の例題は多段階の整数・小数変換とA〜Cの読み替えを含む", () => {
  const expected = {
    "decimal-binary": "101101.1011", "decimal-hex": "1AB.BC",
    position: "45.6875", "hex-decimal": "427.734375",
    "binary-hex": "1AB.BC", "hex-binary": "110101011.101111", cycle: "0.0(0011)",
  };
  for (const [id, example] of Object.entries(CONVERSION_EXAMPLES)) {
    const model = convert(example.value, example.source, example.target);
    assert.equal(model.result.text, expected[id], id);
    if (model.method === "divide-multiply" && id !== "cycle") {
      assert.ok(model.divisions.length >= 3, `${id}: integer requires repeated division`);
      assert.ok(model.result.steps.length >= 2, `${id}: fraction requires repeated multiplication`);
    }
  }
  const example = CONVERSION_EXAMPLES["decimal-hex"];
  const hex = convert(example.value, example.source, example.target);
  assert.deepEqual(hex.divisions.map(row => [row.remainder, row.digit]), [[11n, "B"], [10n, "A"], [1n, "1"]]);
  assert.deepEqual(hex.result.steps.map(row => row.digit), ["B", "C"]);
  const binary = CONVERSION_EXAMPLES["binary-hex"];
  const grouped = convert(binary.value, binary.source, binary.target);
  assert.equal(grouped.groups.integer.length, 3);
  assert.equal(grouped.groups.fractional.length, 2);
  assert.equal(grouped.groups.integer[0].padding, 3);
  assert.equal(grouped.groups.fractional.at(-1).padding, 2);
  assert.ok(grouped.groups.integer.some(group => group.decimal === 11 && group.hex === "B"));
});

test("表示桁数は終端・周期に合わせて自動で決まり、長い変換は64桁で止まる", () => {
  const finite = convert("0.625", 10, 2);
  assert.equal(finite.limit, 64);
  assert.equal(finite.result.text, "0.101");
  assert.equal(finite.result.steps.length, 3);
  const cycle = convert("0.1", 10, 2);
  assert.equal(cycle.result.text, "0.0(0011)");
  assert.equal(cycle.result.steps.length, 5);
  const longCycle = convert("0.0001", 10, 2);
  assert.equal(longCycle.result.steps.length, 64);
  assert.equal(longCycle.result.digits.length, 64);
  assert.equal(longCycle.result.truncated, true);
  assert.equal(longCycle.result.repeating, true);
  const longFinite = convert(`0.${"0".repeat(62)}1`, 16, 10);
  assert.equal(longFinite.result.steps.length, 64);
  assert.equal(longFinite.result.truncated, true);
  assert.equal(longFinite.result.repeating, false);
});
