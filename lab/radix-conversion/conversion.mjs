// All arithmetic uses integer fractions, so decimal input never acquires a
// floating-point rounding error. The DOM renderer is deliberately separate.
export const DIGITS = "0123456789ABCDEF";
export const MAX_INPUT_DIGITS = 64;
export const MAX_FRACTION_DIGITS = 256;
const BASES = [2, 10, 16];

export function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

export function fraction(numerator, denominator = 1n) {
  const divisor = gcd(numerator < 0n ? -numerator : numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function checkBase(base) {
  if (!BASES.includes(base)) throw new Error("2・10・16進数から選んでください。");
}

function integerValue(text, base) {
  return [...text].reduce((value, digit) => value * BigInt(base) + BigInt(DIGITS.indexOf(digit)), 0n);
}

export function parseNumber(input, base) {
  checkBase(base);
  const text = String(input).trim().toUpperCase();
  if (!text) throw new Error("変換する数値を入力してください。");
  if (!/^[+-]?(?:[0-9A-F]+(?:\.[0-9A-F]*)?|\.[0-9A-F]+)$/.test(text)) {
    throw new Error("数値と小数点で入力してください。符号は先頭の + または −（半角 -）を使います。");
  }
  const negative = text.startsWith("-");
  const unsigned = text.replace(/^[+-]/, "");
  const [rawInteger, fractional = ""] = unsigned.split(".");
  const integer = (rawInteger || "0").replace(/^0+(?=.)/, "");
  const characters = unsigned.replace(".", "");
  if ([...characters].some((digit) => DIGITS.indexOf(digit) >= base)) {
    throw new Error(`${base}進数では ${base === 2 ? "0・1" : base === 10 ? "0〜9" : "0〜9・A〜F"} を使ってください。`);
  }
  if (characters.length > MAX_INPUT_DIGITS) throw new Error(`整数・小数を合わせて${MAX_INPUT_DIGITS}桁以内で入力してください。`);
  const denominator = BigInt(base) ** BigInt(fractional.length);
  const magnitude = integerValue(integer, base) * denominator + integerValue(fractional, base);
  return {
    ...fraction(negative ? -magnitude : magnitude, denominator),
    integer, fractional, negative: negative && magnitude !== 0n,
    normalized: `${negative && magnitude !== 0n ? "-" : ""}${integer}${fractional ? `.${fractional}` : ""}`,
  };
}

export function expandFraction(value, base, limit = MAX_FRACTION_DIGITS) {
  checkBase(base);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_FRACTION_DIGITS) throw new Error("小数の表示桁数は1〜256桁にしてください。");
  const magnitude = value.numerator < 0n ? -value.numerator : value.numerator;
  const integer = (magnitude / value.denominator).toString(base).toUpperCase();
  let remainder = magnitude % value.denominator;
  let reducedDenominator = value.denominator;
  for (let divisor = gcd(reducedDenominator, BigInt(base)); divisor > 1n; divisor = gcd(reducedDenominator, BigInt(base))) reducedDenominator /= divisor;
  const repeating = reducedDenominator !== 1n;
  const seen = new Map();
  const steps = [];
  let digits = "";
  let repeatStart = null;
  while (remainder !== 0n) {
    if (seen.has(remainder)) {
      repeatStart = seen.get(remainder);
      break;
    }
    if (digits.length >= limit) break;
    seen.set(remainder, digits.length);
    const before = remainder;
    const product = remainder * BigInt(base);
    const digit = product / value.denominator;
    remainder = product % value.denominator;
    steps.push({ before, product, digit: DIGITS[Number(digit)], remainder, denominator: value.denominator });
    digits += DIGITS[Number(digit)];
  }
  const truncated = remainder !== 0n && repeatStart === null;
  const sign = value.numerator < 0n ? "-" : "";
  const nonRepeat = repeatStart === null ? digits : digits.slice(0, repeatStart);
  const repeat = repeatStart === null ? "" : digits.slice(repeatStart);
  const text = `${sign}${integer}${digits ? `.${nonRepeat}${repeat ? `(${repeat})` : ""}${truncated ? "…" : ""}` : ""}`;
  return { integer, sign, digits, nonRepeat, repeat, repeatStart, repeating, truncated, remainder, steps, text };
}

// Fractions originating in a finite decimal input always terminate in base 10.
export function decimalText(numerator, denominator = 1n) {
  return expandFraction(fraction(numerator, denominator), 10).text;
}

export function divisionSteps(value, base) {
  let integer = (value.numerator < 0n ? -value.numerator : value.numerator) / value.denominator;
  const steps = [];
  do {
    const quotient = integer / BigInt(base);
    const remainder = integer % BigInt(base);
    steps.push({ dividend: integer, quotient, remainder, digit: DIGITS[Number(remainder)] });
    integer = quotient;
  } while (integer !== 0n);
  return steps;
}

export function positionalTerms(parsed, base) {
  const term = (digit, exponent) => {
    const value = BigInt(DIGITS.indexOf(digit));
    return { digit, exponent, decimalDigit: value, ...fraction(exponent >= 0 ? value * BigInt(base) ** BigInt(exponent) : value, exponent >= 0 ? 1n : BigInt(base) ** BigInt(-exponent)) };
  };
  return {
    integer: [...parsed.integer].map((digit, i) => term(digit, parsed.integer.length - i - 1)),
    fractional: [...parsed.fractional].map((digit, i) => term(digit, -i - 1)),
  };
}

export function nibbleGroups(parsed, sourceBase) {
  if (![2, 16].includes(sourceBase)) throw new Error("4桁の対応は2進数・16進数で使います。");
  function groups(text, part) {
    if (!text) return [];
    if (sourceBase === 16) return [...text].map((hex) => ({ hex, decimal: DIGITS.indexOf(hex), binary: DIGITS.indexOf(hex).toString(2).padStart(4, "0"), padding: 0, part }));
    const padding = (4 - text.length % 4) % 4;
    const padded = part === "integer" ? "0".repeat(padding) + text : text + "0".repeat(padding);
    return padded.match(/.{4}/g).map((binary, i, all) => {
      const decimal = Number.parseInt(binary, 2);
      return { binary, decimal, hex: DIGITS[decimal], padding: (part === "integer" && i === 0) || (part === "fractional" && i === all.length - 1) ? padding : 0, part };
    });
  }
  return { integer: groups(parsed.integer, "integer"), fractional: groups(parsed.fractional, "fractional") };
}

export function convert(input, sourceBase, targetBase, limit = 64) {
  checkBase(targetBase);
  const parsed = parseNumber(input, sourceBase);
  const result = expandFraction(parsed, targetBase, limit);
  const model = { parsed, result, sourceBase, targetBase, limit };
  if (sourceBase === targetBase) return { ...model, method: "identity" };
  if (sourceBase === 10) return { ...model, method: "divide-multiply", divisions: divisionSteps(parsed, targetBase) };
  if (targetBase === 10) return { ...model, method: "position", terms: positionalTerms(parsed, sourceBase) };
  return { ...model, method: "nibbles", groups: nibbleGroups(parsed, sourceBase) };
}
