import { convert, decimalText, DIGITS, MAX_INPUT_DIGITS } from "./conversion.mjs";

const $ = (id) => document.getElementById(id);
const form = $("conversion-form");
const input = $("number-input");
const source = $("source-base");
const target = $("target-base");
const precision = $("precision");
const esc = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const baseLabel = (base) => `<sub>(${base})</sub>`;
const outputHTML = (result) => `${result.sign}${result.integer}${result.digits ? `.${result.nonRepeat}${result.repeat ? `<span class="repeat-digits" title="この桁が繰り返します">${result.repeat}</span><span class="visually-hidden">（繰り返し）</span>…` : ""}${result.truncated ? "…" : ""}` : ""}`;
let totalSteps = 0;
let shownSteps = 0;
let lastModel;
const step = () => `data-step="${++totalSteps}"`;
const after = (count = totalSteps) => `data-after="${count}"`;

function card(part, value, heading, description, body) {
  return `<article class="calculation-card ${part}-part"><header><p class="part-label">${part === "integer" ? "整数部分" : "小数部分"}<span>${esc(value)}</span></p><h3>${heading}</h3><p>${description}</p></header><div class="calculation-body">${body}</div></article>`;
}

function resultNote(model) {
  const { result, targetBase, limit } = model;
  if (result.repeat) return `上線の <strong>${result.repeat}</strong> がずっと繰り返します。括弧で書くと ${esc(result.text)}。小数の計算で同じ余りに戻るため、循環します。`;
  if (result.truncated) return `小数点以下${limit}桁までの表示です。末尾の「…」は続きを省略した印で、丸めはしていません。${result.repeating ? `${targetBase}進数では循環しますが、繰り返し全体はまだ表示しきれていません。` : "この数は有限小数です。表示上限を増やすと、続きを確認できます。"}`;
  if (model.method === "identity") return "同じ進数なので、変換する必要はありません。不要な先頭・末尾の0を省略しています。";
  if (model.method === "position") return "各桁の「数字 × 桁の重み」を足し合わせた値です。小数点の右には、負の指数を使います。";
  if (model.method === "nibbles") return "16進数の1桁と、2進数の4桁を対応させた値です。小数点の位置はそのまま保ちます。";
  return result.digits ? "小数部分の余りが0になったので、ここで変換が終わります。" : "小数部分のない整数です。";
}

function divisionAndMultiplication(model) {
  const { parsed, divisions, result, targetBase } = model;
  const magnitude = parsed.numerator < 0n ? -parsed.numerator : parsed.numerator;
  const integer = magnitude / parsed.denominator;
  const remainder = magnitude % parsed.denominator;
  const rows = divisions.map((row, i) => `<tr ${step()}><td>${i + 1}</td><td class="arithmetic">${row.dividend} ÷ ${targetBase} = ${row.quotient}</td><td><span class="picked-digit">${row.digit}</span>${row.remainder >= 10n ? `<small>（${row.remainder}）</small>` : ""}</td></tr>`).join("");
  const integerBody = `<div class="scroll-table" tabindex="0" role="region" aria-label="整数部分の割り算"><table><thead><tr><th scope="col">手順</th><th scope="col">割り算と商</th><th scope="col">余り</th></tr></thead><tbody>${rows}</tbody></table></div><div ${after()} class="read-direction"><span aria-hidden="true">↑</span>余りを下から上へ読む</div><p ${after()} class="part-answer">整数部分は <b>${result.integer}</b>${baseLabel(targetBase)}</p>`;
  const fractionalStart = totalSteps;
  const fractionalRows = result.steps.map((row, i) => `<tr ${step()}${result.repeatStart !== null && i >= result.repeatStart ? ' class="cycle-row"' : ""}><td>${i + 1}</td><td class="arithmetic">${decimalText(row.before, row.denominator)} × ${targetBase}<br />= ${decimalText(row.product, row.denominator)}</td><td><span class="picked-digit">${row.digit}</span>${DIGITS.indexOf(row.digit) >= 10 ? `<small>（${DIGITS.indexOf(row.digit)}）</small>` : ""}</td><td class="arithmetic">${decimalText(row.remainder, row.denominator)}</td></tr>`).join("");
  let note = "";
  if (result.repeatStart !== null) {
    const returned = decimalText(result.remainder, parsed.denominator);
    note = `<p ${after()} class="part-note cycle-note">↻ 残った小数が <strong>${returned}</strong> に戻りました。これは手順${result.repeatStart + 1}の計算前と同じ。ここから <strong>${result.repeat}</strong> を繰り返します（緑の行）。</p>`;
  } else if (result.truncated) {
    note = `<p ${after()} class="part-note cycle-note">表示上限の${model.limit}桁に達しました。残った小数は ${decimalText(result.remainder, parsed.denominator)} で、計算は続きます。${result.repeating ? "この数は循環小数ですが、周期の全体はまだ見つかっていません。" : "表示上限を増やすと続きを確認できます。"}</p>`;
  } else if (remainder !== 0n) note = `<p ${after()} class="part-note">残った小数が0になったら、終了です。</p>`;
  const fractionalResult = result.digits ? `0.${result.nonRepeat}${result.repeat ? `<span class="repeat-digits">${result.repeat}</span>…` : ""}${result.truncated ? "…" : ""}` : "0";
  const fractionalBody = remainder === 0n ? '<p class="empty-part">小数部分は0なので、掛け算は不要です。</p>' : `<div class="scroll-table" tabindex="0" role="region" aria-label="小数部分の掛け算"><table><thead><tr><th scope="col">手順</th><th scope="col">掛け算</th><th scope="col">整数部分</th><th scope="col">残った小数</th></tr></thead><tbody>${fractionalRows}</tbody></table></div><p data-after="${fractionalStart}" class="part-note">取り出した整数部分を除き、残った小数で次の掛け算をします。</p><div ${after()} class="read-direction"><span aria-hidden="true">↓</span>整数部分を上から下へ読む</div><p ${after()} class="part-answer">小数部分は <b>${fractionalResult}</b>${baseLabel(targetBase)}</p>${note}`;
  $("calculation-panels").innerHTML = `<div class="calculation-grid">${card("integer", integer, `${targetBase}で割り、余りを記録`, "商が0になるまで続けます。先に出る余りは下位の桁です。", integerBody)}${card("fractional", decimalText(remainder, parsed.denominator), `${targetBase}を掛け、整数部分を記録`, "最初に出る整数部分が、小数点のすぐ右の桁になります。", fractionalBody)}</div>`;
  $("assembly").innerHTML = `<div ${after()}><h3>整数と小数を、小数点でつなぐ</h3><div class="assembly-equation"><span>${result.sign}<span class="integer-color">${result.integer}</span><span class="fractional-color">${result.digits ? `.${result.nonRepeat}${result.repeat ? `<span class="repeat-digits">${result.repeat}</span>…` : ""}${result.truncated ? "…" : ""}` : ""}</span>${baseLabel(targetBase)}</span><span> ${result.truncated ? "≈" : "="} </span><span>${esc(parsed.normalized)}${baseLabel(10)}</span></div><p>整数は下から上、小数は上から下。読む向きが違うことに注目しよう。${targetBase === 16 ? "余り・整数部分が10〜15なら、A〜Fに置き換えます。" : ""}</p></div>`;
}

function termSum(terms) {
  const nonzero = terms.filter((term) => term.numerator !== 0n);
  return nonzero.length ? nonzero.map((term) => decimalText(term.numerator, term.denominator)).join(" + ") : "0";
}

function positional(model) {
  const { parsed, terms, sourceBase } = model;
  const renderPart = (part, list) => {
    const body = list.length ? `<div class="position-list">${list.map((term) => `<div ${step()} class="position-term"><span class="picked-digit">${term.digit}</span><span>× ${sourceBase}<sup>${term.exponent < 0 ? "−" + -term.exponent : term.exponent}</sup></span><span>=</span><strong>${decimalText(term.numerator, term.denominator)}</strong>${term.exponent < 0 ? `<small>${sourceBase}<sup>−${-term.exponent}</sup> = 1 / ${BigInt(sourceBase) ** BigInt(-term.exponent)}${term.decimalDigit >= 10n ? ` ／ ${term.digit}は10進数で${term.decimalDigit}` : ""}</small>` : term.decimalDigit >= 10n ? `<small>${term.digit}は10進数で${term.decimalDigit}</small>` : ""}</div>`).join("")}</div><div ${after()} class="expanded-sum"><p>各桁の値を足す（0の項は省略）</p><p class="arithmetic">${termSum(list)}</p></div>` : '<p class="empty-part">小数部分の桁はありません。</p>';
    return card(part, part === "integer" ? parsed.integer : `0.${parsed.fractional || "0"}`, "各桁 × 桁の重み", part === "integer" ? `右端から ${sourceBase}⁰、${sourceBase}¹、${sourceBase}²…。` : `小数点の右から ${sourceBase}⁻¹、${sourceBase}⁻²、${sourceBase}⁻³…。`, body);
  };
  $("calculation-panels").innerHTML = `<div class="calculation-grid">${renderPart("integer", terms.integer)}${renderPart("fractional", terms.fractional)}</div>`;
  const all = [...terms.integer, ...terms.fractional];
  const expansion = all.map((term) => `${term.digit === String(term.decimalDigit) ? term.digit : `${term.decimalDigit}（${term.digit}）`} × ${sourceBase}<sup>${term.exponent < 0 ? "−" + -term.exponent : term.exponent}</sup>`).join(" + ");
  $("assembly").innerHTML = `<div ${after()}><h3>すべての桁の値を足す</h3><p class="arithmetic">${expansion}</p><p class="arithmetic">= ${termSum(all)}</p><div class="assembly-equation"><span>= ${decimalText(parsed.numerator < 0n ? -parsed.numerator : parsed.numerator, parsed.denominator)}${baseLabel(10)}</span></div>${parsed.negative ? `<p>最後に元の符号「−」を付けて、${decimalText(parsed.numerator, parsed.denominator)}${baseLabel(10)} です。</p>` : ""}</div>`;
}

function nibbles(model) {
  const { parsed, sourceBase, targetBase, groups, result } = model;
  const binaryHTML = (group) => {
    if (!group.padding || sourceBase === 16) return group.binary;
    return group.part === "integer" ? `<span class="padding">${group.binary.slice(0, group.padding)}</span>${group.binary.slice(group.padding)}` : `${group.binary.slice(0, 4 - group.padding)}<span class="padding">${group.binary.slice(4 - group.padding)}</span>`;
  };
  const renderPart = (part, list) => {
    let body = "";
    if (!list.length) body = '<p class="empty-part">小数部分の桁はありません。</p>';
    else {
      if (sourceBase === 2) body += `<p class="padding-explanation">${part === "integer" ? "小数点から左へ" : "小数点から右へ"}4桁ずつ区切ります。${list.some((group) => group.padding) ? `${part === "integer" ? "左端" : "右端"}に足した灰色の0は、値を変えない桁合わせです。` : "4桁で、16進数の1桁になります。"}</p>`;
      else body += '<p class="padding-explanation">16進数の各桁を、必ず4ビットで表します。途中の桁の先頭の0も残します。</p>';
      body += `<div class="nibble-list">${list.map((group) => {
        const binary = `<div><small>2進数・4桁</small><b>${binaryHTML(group)}</b></div>`;
        const decimal = `<div><small>10進数</small><b>${group.decimal}</b></div>`;
        const hex = `<div><small>16進数・1桁</small><b>${group.hex}</b></div>`;
        return `<div ${step()} class="nibble">${sourceBase === 2 ? binary : hex}<i aria-hidden="true">→</i>${decimal}<i aria-hidden="true">→</i>${sourceBase === 2 ? hex : binary}</div>`;
      }).join("")}</div><div ${after()} class="joined-groups">${list.map((group) => `<span>${targetBase === 16 ? group.hex : group.binary}</span>`).join("")}<small>を順につなぐ</small></div>`;
    }
    return card(part, part === "integer" ? parsed.integer : `0.${parsed.fractional || "0"}`, sourceBase === 2 ? "4桁のまとまり → 16進数の1桁" : "16進数の1桁 → 2進数の4桁", sourceBase === 2 ? "4ビットの値を、0〜Fの1文字で表します。" : "各桁の値を0〜15に読み替えてから、4ビットにします。", body);
  };
  $("calculation-panels").innerHTML = `<div class="calculation-grid">${renderPart("integer", groups.integer)}${renderPart("fractional", groups.fractional)}</div>`;
  const groupedInteger = groups.integer.map((g) => targetBase === 2 ? g.binary : g.hex).join(" ");
  const groupedFraction = groups.fractional.map((g) => targetBase === 2 ? g.binary : g.hex).join(" ");
  $("assembly").innerHTML = `<div ${after()}><h3>小数点の位置を保って、つなぐ</h3><div class="assembly-equation"><span>${result.sign}<span class="integer-color">${groupedInteger}</span>${groupedFraction ? `<span class="fractional-color"> . ${groupedFraction}</span>` : ""}${baseLabel(targetBase)}</span></div><p>＝ ${outputHTML(result)}${baseLabel(targetBase)}。整数の先頭・小数の末尾にある不要な0は省略できます。<strong>小数点をまたいで区切らない</strong>ことが大切です。</p></div>`;
}

function showSteps(count) {
  shownSteps = Math.min(count, totalSteps);
  document.querySelectorAll("[data-step]").forEach((element) => {
    const number = Number(element.dataset.step);
    element.hidden = number > shownSteps;
    element.classList.toggle("current-step", shownSteps < totalSteps && number === shownSteps);
  });
  document.querySelectorAll("[data-after]").forEach((element) => { element.hidden = Number(element.dataset.after) > shownSteps; });
  $("next-step").disabled = shownSteps >= totalSteps;
  $("all-steps").disabled = shownSteps >= totalSteps;
  $("step-status").textContent = totalSteps ? `${shownSteps} / ${totalSteps} ステップを表示${shownSteps >= totalSteps ? " · すべて表示中" : ""}` : "";
}

function render(model) {
  lastModel = model;
  totalSteps = 0;
  const { parsed, result, sourceBase, targetBase, method } = model;
  $("result-section").hidden = false;
  $("working-section").hidden = false;
  $("result-section").classList.remove("is-stale");
  $("result-source").textContent = `${parsed.normalized}（${sourceBase}進数）`;
  $("result-number").innerHTML = outputHTML(result);
  $("result-number").setAttribute("aria-label", `${result.text}、${targetBase}進数${result.repeat ? "。括弧内は繰り返し" : ""}${result.truncated ? "。表示上限までの値" : ""}`);
  $("result-base").textContent = `${targetBase}進数`;
  $("result-kind").textContent = `${result.repeating ? "循環小数" : result.digits ? "有限小数" : "整数"}${result.truncated ? " · 途中まで" : ""}`;
  $("result-note").innerHTML = resultNote(model);
  $("sign-note").hidden = !parsed.negative;
  $("sign-note").textContent = "負の数は絶対値で計算し、最後に符号「−」を付けます。このラボでは2の補数表現は使いません。";
  $("assembly").hidden = method === "identity";
  if (method === "divide-multiply") {
    $("method-description").textContent = `10進数から${targetBase}進数へ。整数と小数を分けて計算し、最後につなぎます。`;
    divisionAndMultiplication(model);
  } else if (method === "position") {
    $("method-description").textContent = `${sourceBase}進数から10進数へ。桁の数字に「基数のべき乗」を掛け、すべて足します。`;
    positional(model);
  } else if (method === "nibbles") {
    $("method-description").textContent = `${sourceBase}進数 → 10進数の値 → ${targetBase}進数。2⁴ = 16なので、4ビットと16進数の1桁が対応します。`;
    nibbles(model);
  } else {
    $("method-description").textContent = "入力と変換先が同じ進数です。別の進数を選ぶと、途中計算が表示されます。";
    $("calculation-panels").innerHTML = '<div class="identity-note"><p>進数が同じなので、値も表し方も変わりません。不要な先頭・末尾の0は省略して表示しています。</p></div>';
  }
  $("restart-steps").closest(".step-controls").hidden = totalSteps === 0;
  showSteps(totalSteps);
  $("conversion-status").textContent = `変換しました。${parsed.normalized}、${sourceBase}進数は、${result.text}、${targetBase}進数です。${result.repeat ? "括弧内の桁が循環します。" : ""}${result.truncated ? "小数は表示上限までです。" : ""}`;
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
    $("result-section").hidden = true;
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
form.addEventListener("input", () => {
  updateInputHelp();
  if (lastModel && !$("result-section").hidden) {
    $("result-section").classList.add("is-stale");
    $("result-source").textContent = `前回の結果 · ${lastModel.parsed.normalized}（${lastModel.sourceBase}進数）。入力変更後は「変換」を押してください。`;
    $("working-section").hidden = true;
  }
});
precision.addEventListener("change", runConversion);
const examples = {
  integer: [10, "25", 2], fraction: [10, "13.625", 2], cycle: [10, "0.1", 2],
  position: [2, "1001.101", 10], "binary-hex": [2, "110101.101", 16], "hex-binary": [16, "2F.A", 2],
};
$("example-buttons").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-example]");
  if (!button) return;
  const [from, value, to] = examples[button.dataset.example];
  source.value = String(from);
  input.value = value;
  target.value = String(to);
  updateInputHelp();
  runConversion();
});
$("restart-steps").addEventListener("click", () => showSteps(1));
$("next-step").addEventListener("click", () => showSteps(shownSteps + 1));
$("all-steps").addEventListener("click", () => showSteps(totalSteps));
$("digit-reference-grid").innerHTML = [...DIGITS].map((hex, value) => `<div class="reference-item"><small>16進 → 10進 → 2進</small><b>${hex}</b><small>${value}</small><span>${value.toString(2).padStart(4, "0")}</span></div>`).join("");
updateInputHelp();
runConversion();
