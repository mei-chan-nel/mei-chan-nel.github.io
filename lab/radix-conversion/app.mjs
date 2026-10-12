import { convert, decimalText, DIGITS, MAX_INPUT_DIGITS } from "./conversion.mjs";
import { CONVERSION_EXAMPLES } from "./examples.mjs";

const $ = (id) => document.getElementById(id);
const form = $("conversion-form");
const input = $("number-input");
const source = $("source-base");
const target = $("target-base");
const precision = $("precision");
const esc = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const baseLabel = (base) => `<sub>(${base})</sub>`;
// Japanese textbook notation: dots over the first and last recurring digits.
// A one-digit period receives one dot, rather than two overlapping markers.
const repeatHTML = (digits) => `<span class="repeat-digits">${[...digits].map((digit, i) => `<span class="repeat-digit${i === 0 || i === digits.length - 1 ? " cycle-dot" : ""}">${digit}</span>`).join("")}</span>`;
const outputHTML = (result) => `${result.sign}<span class="integer-color">${result.integer}</span>${result.digits ? `<span class="fractional-color">.${result.nonRepeat}${result.repeat ? repeatHTML(result.repeat) : ""}${result.truncated ? "…" : ""}</span>` : ""}`;

function card(part, value, heading, description, body) {
  return `<article class="calculation-card ${part}-part"><header><p class="part-label">${part === "integer" ? "整数部分" : "小数部分"}<span>${esc(value)}</span></p><h3>${heading}</h3><p>${description}</p></header><div class="calculation-body">${body}</div></article>`;
}

function arrowCell(count, direction, label) {
  return `<td class="arrow-cell" rowspan="${count}" data-reading-arrow><span class="column-arrow ${direction}" aria-hidden="true"></span><span class="visually-hidden">${label}</span></td>`;
}

function pickedValue(digit) {
  const decimal = DIGITS.indexOf(digit);
  return `<span class="picked-value"><span class="picked-digit">${digit}</span>${decimal >= 10 ? `<small>${decimal} → ${digit}</small>` : ""}</span>`;
}

function divisionAndMultiplication(model) {
  const { parsed, divisions, result, targetBase } = model;
  const magnitude = parsed.numerator < 0n ? -parsed.numerator : parsed.numerator;
  const integer = magnitude / parsed.denominator;
  const remainder = magnitude % parsed.denominator;
  const rows = divisions.map((row, i) => `<tr><td>${i + 1}</td><td class="arithmetic">${row.dividend} ÷ ${targetBase} = ${row.quotient}</td><td class="digit-cell">${pickedValue(row.digit)}</td>${i === 0 ? arrowCell(divisions.length, "up", "余りを下から上へ読む") : ""}</tr>`).join("");
  const integerBody = `<div class="scroll-table" tabindex="0" role="region" aria-label="整数部分の割り算"><table><thead><tr><th scope="col">手順</th><th scope="col">割り算と商</th><th scope="col" class="digit-heading">余り</th><th scope="col" class="arrow-heading"><span class="visually-hidden">読む向き</span></th></tr></thead><tbody>${rows}</tbody></table><p class="read-caption">余りを下から上へ読む</p></div><p class="part-answer">整数部分は <b>${result.integer}</b>${baseLabel(targetBase)}</p>`;
  const fractionalRows = result.steps.map((row, i) => `<tr ${result.repeatStart !== null && i >= result.repeatStart ? ' class="cycle-row"' : ""}><td>${i + 1}</td><td class="arithmetic">${decimalText(row.before, row.denominator)} × ${targetBase}<br />= ${decimalText(row.product, row.denominator)}</td><td class="digit-cell">${pickedValue(row.digit)}</td>${i === 0 ? arrowCell(result.steps.length, "down", "整数部分を上から下へ読む") : ""}<td class="arithmetic">${decimalText(row.remainder, row.denominator)}</td></tr>`).join("");
  let note = "";
  if (result.repeatStart !== null) {
    note = `<p class="part-note cycle-note">↻ 残った小数が <strong>${decimalText(result.remainder, parsed.denominator)}</strong> に戻りました。手順${result.repeatStart + 1}の計算前と同じなので、ここから <strong>${result.repeat}</strong> を繰り返します（緑の行）。</p>`;
  } else if (result.truncated) {
    note = `<p class="part-note cycle-note">表示上限の${model.limit}桁に達しました。残った小数は ${decimalText(result.remainder, parsed.denominator)} で、計算は続きます。${result.repeating ? "この数は循環小数ですが、周期の全体はまだ見つかっていません。" : "表示上限を増やすと続きを確認できます。"}</p>`;
  } else if (remainder !== 0n) note = `<p class="part-note">残った小数が0になったら、終了です。</p>`;
  const fractionalResult = outputHTML({ ...result, sign: "", integer: "0" });
  const fractionalBody = remainder === 0n ? '<p class="empty-part">小数部分は0なので、掛け算は不要です。</p>' : `<div class="scroll-table" tabindex="0" role="region" aria-label="小数部分の掛け算"><table><thead><tr><th scope="col">手順</th><th scope="col">掛け算</th><th scope="col" class="digit-heading">整数部分</th><th scope="col" class="arrow-heading"><span class="visually-hidden">読む向き</span></th><th scope="col">残った小数</th></tr></thead><tbody>${fractionalRows}</tbody></table><p class="read-caption">整数部分を上から下へ読む</p></div><p class="part-note">取り出した整数部分を除き、残った小数で次の掛け算をします。</p><p class="part-answer">小数部分は <b>${fractionalResult}</b>${baseLabel(targetBase)}</p>${note}`;
  $("calculation-panels").innerHTML = `<div class="calculation-grid">${card("integer", integer, `${targetBase}で割り、余りを記録`, "商が0になるまで続けます。先に出る余りは下位の桁です。", integerBody)}${card("fractional", decimalText(remainder, parsed.denominator), `${targetBase}を掛け、整数部分を記録`, "最初に出る整数部分が、小数点のすぐ右の桁になります。", fractionalBody)}</div>`;
}

function termSum(terms) {
  const nonzero = terms.filter((term) => term.numerator !== 0n);
  return nonzero.length ? nonzero.map((term) => decimalText(term.numerator, term.denominator)).join(" + ") : "0";
}

function positionalEquation(term, base) {
  const exponent = term.exponent < 0 ? `−${-term.exponent}` : term.exponent;
  const power = BigInt(base) ** BigInt(Math.abs(term.exponent));
  const substitution = base === 16 && term.decimalDigit >= 10n
    ? `<span>=</span><span>${term.decimalDigit} × ${term.exponent < 0 ? `(1 / ${power})` : power}</span>`
    : "";
  const weightNote = term.exponent < 0 && !substitution
    ? `<small>${base}<sup>${exponent}</sup> = 1 / ${power}</small>`
    : "";
  return `<span class="picked-digit">${term.digit}</span><span>× ${base}<sup>${exponent}</sup></span>${substitution}<span>=</span><strong>${decimalText(term.numerator, term.denominator)}</strong>${weightNote}`;
}

function positional(model) {
  const { parsed, terms, sourceBase } = model;
  const renderPart = (part, list) => {
    const body = list.length ? `<div class="position-list">${list.map((term) => `<div class="position-term">${positionalEquation(term, sourceBase)}</div>`).join("")}</div><div class="expanded-sum"><p>各桁の値を足す（0の項は省略）</p><p class="arithmetic">${termSum(list)}</p></div>` : '<p class="empty-part">小数部分の桁はありません。</p>';
    return card(part, part === "integer" ? parsed.integer : `0.${parsed.fractional || "0"}`, "各桁 × 桁の重み", part === "integer" ? `右端から ${sourceBase}⁰、${sourceBase}¹、${sourceBase}²…。` : `小数点の右から ${sourceBase}⁻¹、${sourceBase}⁻²、${sourceBase}⁻³…。`, body);
  };
  $("calculation-panels").innerHTML = `<div class="calculation-grid">${renderPart("integer", terms.integer)}${renderPart("fractional", terms.fractional)}</div>`;
  const all = [...terms.integer, ...terms.fractional];
  const expansion = all.map((term) => `${term.decimalDigit} × ${sourceBase}<sup>${term.exponent < 0 ? "−" + -term.exponent : term.exponent}</sup>`).join(" + ");
  $("calculation-panels").insertAdjacentHTML("beforeend", `<div class="sum-calculation"><h3>すべての桁の値を足す</h3><p class="arithmetic">${expansion}</p><p class="arithmetic">= ${termSum(all)}</p></div>`);
}

function binaryHTML(group) {
  return [...group.binary].map((digit, i) => {
    const added = group.padding && (group.part === "integer" ? i < group.padding : i >= 4 - group.padding);
    return `<span class="bit-digit${added ? " padding" : ""}">${digit}</span>`;
  }).join("");
}

function groupingVisual(groups) {
  const side = (part) => `<div class="grouped-side ${part}">${groups[part].map((group, i) => `<div class="bit-group"><span class="bit-quad">${binaryHTML(group)}</span><small>${i + 1}組目 · 4桁</small></div>`).join("")}</div>`;
  return `<div class="grouping-visual"><h3>小数点を基準に、4桁ずつ区切る</h3><p>整数部分は左へ、小数部分は右へ。灰色の0は、端に足した桁合わせです。</p><div class="grouping-parts">${side("integer")}${groups.fractional.length ? `<span class="grouped-point" aria-label="小数点">.</span>${side("fractional")}` : ""}</div></div>`;
}

function nibbles(model) {
  const { parsed, sourceBase, targetBase, groups } = model;
  const renderPart = (part, list) => {
    let body = "";
    if (!list.length) body = '<p class="empty-part">小数部分の桁はありません。</p>';
    else {
      body += `<div class="nibble-list">${list.map((group, i) => {
        const binary = `<div><small>2進数・4桁</small><b class="bit-quad">${binaryHTML(group)}</b></div>`;
        const decimal = `<div><small>10進数</small><b>${group.decimal}</b></div>`;
        const hex = `<div><small>16進数・1桁</small><b>${group.hex}</b></div>`;
        return `<div class="nibble"><span class="group-index">${i + 1}組目</span>${sourceBase === 2 ? binary : hex}<i aria-hidden="true">→</i>${decimal}<i aria-hidden="true">→</i>${sourceBase === 2 ? hex : binary}</div>`;
      }).join("")}</div><div class="joined-groups">${list.map((group) => `<span>${targetBase === 16 ? group.hex : group.binary}</span>`).join("")}<small>を順につなぐ</small></div>`;
    }
    return card(part, part === "integer" ? parsed.integer : `0.${parsed.fractional || "0"}`, sourceBase === 2 ? "4桁のまとまり → 16進数の1桁" : "16進数の1桁 → 2進数の4桁", sourceBase === 2 ? "4ビットの値を、0〜Fの1文字で表します。" : "各桁の値を0〜15に読み替えてから、4ビットにします。", body);
  };
  $("calculation-panels").innerHTML = `${sourceBase === 2 ? groupingVisual(groups) : ""}<div class="calculation-grid">${renderPart("integer", groups.integer)}${renderPart("fractional", groups.fractional)}</div>`;
}

function renderResult(model) {
  const { parsed, result, sourceBase, targetBase } = model;
  const note = result.truncated ? `小数点以下${model.limit}桁までの表示です。「…」は続きの省略で、丸めはしていません。${result.repeating ? "この数は循環しますが、周期全体はまだ表示しきれていません。" : "表示上限を増やすと続きを確認できます。"}` : result.repeat ? `ドットを付けた最初から最後の桁（${result.repeat}）を繰り返します。${result.repeat.length === 1 ? "1桁の循環では、その桁にドットを1つ付けます。" : ""}` : "";
  $("assembly").innerHTML = `<div class="result-top"><h3 id="result-heading">計算結果</h3><span id="result-kind" class="result-kind">${result.repeating ? "循環小数" : result.digits ? "有限小数" : "整数"}${result.truncated ? " · 途中まで" : ""}</span></div><div class="result-equation"><div class="equation-side"><small>変換前</small><span id="result-source">${esc(parsed.normalized)}${baseLabel(sourceBase)}</span></div><span class="equals-sign">${result.truncated ? "≈" : "＝"}</span><div class="equation-side"><small>変換後</small><div><output id="result-number" for="source-base number-input target-base precision">${outputHTML(result)}</output>${baseLabel(targetBase)}</div></div></div>${note ? `<p id="result-note" class="result-note">${note}</p>` : ""}${parsed.negative ? '<p class="sign-note">絶対値を変換し、最後に元の符号「−」を付けます。</p>' : ""}`;
  const readable = `${result.sign}${result.integer}${result.digits ? `.${result.nonRepeat}${result.repeat ? `、${result.repeat}が循環` : ""}${result.truncated ? "、以下省略" : ""}` : ""}`;
  $("result-number").setAttribute("aria-label", `${readable}、${targetBase}進数`);
}

function render(model) {
  const { sourceBase, targetBase, method } = model;
  $("working-section").hidden = false;
  if (method === "divide-multiply") {
    $("method-description").textContent = `10進数から${targetBase}進数へ。整数と小数を分けて計算し、最後につなぎます。`;
    divisionAndMultiplication(model);
  } else if (method === "position") {
    $("method-description").textContent = `${sourceBase}進数から10進数へ。各桁に「基数のべき乗」を掛け、すべて足します。`;
    positional(model);
  } else if (method === "nibbles") {
    $("method-description").textContent = `${sourceBase}進数 → 10進数の値 → ${targetBase}進数。2⁴ = 16なので、4ビットと16進数の1桁が対応します。`;
    nibbles(model);
  } else {
    $("method-description").textContent = "入力と変換先が同じ進数です。別の進数を選ぶと、途中計算が表示されます。";
    $("calculation-panels").innerHTML = '<div class="identity-note"><p>進数が同じなので、変換は不要です。不要な先頭・末尾の0は省略して表示しています。</p></div>';
  }
  renderResult(model);
  $("conversion-status").textContent = "途中計算と計算結果を更新しました。";
}

function runConversion() {
  try {
    const model = convert(input.value, Number(source.value), Number(target.value), Number(precision.value));
    $("input-error").hidden = true;
    input.removeAttribute("aria-invalid");
    render(model);
  } catch (error) {
    $("input-error").textContent = error.message;
    $("input-error").hidden = false;
    input.setAttribute("aria-invalid", "true");
    $("working-section").hidden = true;
    $("conversion-status").textContent = "入力を確認してください。";
  }
}

function updateInputHelp() {
  const base = Number(source.value);
  $("input-help").textContent = `${base === 2 ? "0・1" : base === 16 ? "0〜9・A〜F（小文字も可）" : "0〜9"}を使用。小数点は「.」、負の数は先頭に「-」。数値は合計${MAX_INPUT_DIGITS}桁まで。`;
  input.inputMode = base === 16 ? "text" : "decimal";
}

form.addEventListener("submit", (event) => { event.preventDefault(); runConversion(); });
form.addEventListener("input", (event) => {
  if (event.target !== precision) $("example-focus").hidden = true;
  updateInputHelp();
  $("working-section").hidden = true;
  $("conversion-status").textContent = "入力を変更しました。変換ボタンを押してください。";
});
precision.addEventListener("change", runConversion);
$("example-buttons").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-example]");
  if (!button) return;
  const { source: from, value, target: to, focus } = CONVERSION_EXAMPLES[button.dataset.example];
  $("example-focus").textContent = focus;
  $("example-focus").hidden = false;
  source.value = String(from);
  input.value = value;
  target.value = String(to);
  updateInputHelp();
  runConversion();
});
updateInputHelp();
runConversion();
