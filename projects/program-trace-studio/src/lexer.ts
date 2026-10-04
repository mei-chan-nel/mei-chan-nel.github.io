import { StudioError, LIMITS } from './errors.js';
export interface Token { kind: 'number' | 'string' | 'name' | 'symbol' | 'input' | 'eof'; text: string; value?: number | string; column: number }
const special: Record<string, string> = { '≤': '<=', '≦': '<=', '≥': '>=', '≧': '>=', '≠': '!=', '×': '*', '−': '-' };
export function splitComment(text: string): { code: string; comment: string } {
  let quote = '', escaped = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quote) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === quote) quote = ''; }
    else if (char === '"' || char === "'") quote = char;
    else if (char === '#') return { code: text.slice(0, i), comment: text.slice(i) };
  }
  return { code: text, comment: '' };
}
export function normalizeSymbols(text: string): string {
  let quote = '', closeQuote = '', escaped = false, result = '';
  for (const char of text) {
    if (quote) {
      if (!escaped && char === closeQuote) { result += quote; quote = ''; }
      else { result += !escaped && char === quote && closeQuote !== quote ? '\\' + char : char; if (escaped) escaped = false; else if (char === '\\') escaped = true; }
    }
    else if (['"', "'", '“', '＂', '‘', '＇'].includes(char)) {
      quote = ['"', '“', '＂'].includes(char) ? '"' : "'";
      closeQuote = char === '“' ? '”' : char === '‘' ? '’' : char; result += quote;
    }
    else { const point = char.codePointAt(0)!; result += special[char] ?? (point >= 0xff01 && point <= 0xff5e ? String.fromCodePoint(point - 0xfee0) : char === '　' ? ' ' : char); }
  }
  return result;
}
export function tokenize(text: string, line = 1, offset = 1): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const fail = (message: string, column = i + offset): never => { throw new StudioError(message, line, column); };
  while (i < text.length) {
    if (tokens.length > 8_000) fail('1行の式が長すぎます。');
    const start = i, char = text[i], column = i + offset;
    if (/\s/u.test(char)) { i++; continue; }
    if (char === '"' || char === "'") {
      const quote = char; i++; let value = '', closed = false;
      while (i < text.length) {
        const next = text[i++];
        if (next === quote) { closed = true; break; }
        if (next === '\\') {
          const escaped = text[i++];
          if (escaped === 'u') { const hex = text.slice(i, i + 4); if (!/^[\da-f]{4}$/i.test(hex)) fail('文字列のUnicode指定を確認してください。'); value += String.fromCharCode(parseInt(hex, 16)); i += 4; }
          else if (['n', 'r', 't', '\\', '"', "'"].includes(escaped)) value += ({ n: '\n', r: '\r', t: '\t' } as Record<string, string>)[escaped] ?? escaped;
          else fail('文字列の\\の後にはn・t・r・引用符などを指定してください。');
        } else value += next;
      }
      if (!closed) fail('文字列を囲む引用符が閉じていません。', column);
      if (value.length > LIMITS.string) fail('文字列が長すぎます。', column);
      tokens.push({ kind: 'string', text: text.slice(start, i), value, column }); continue;
    }
    if (text.startsWith('【外部からの入力】', i)) { tokens.push({ kind: 'input', text: '【外部からの入力】', column }); i += '【外部からの入力】'.length; continue; }
    const number = text.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
    if (number) {
      const value = Number(number[0]); if (!Number.isFinite(value) || Number.isInteger(value) && !Number.isSafeInteger(value)) fail('数値が正確に扱える範囲を超えています。');
      tokens.push({ kind: 'number', text: number[0], value, column }); i += number[0].length; continue;
    }
    const name = text.slice(i).match(/^[\p{L}_][\p{L}\p{N}_]*/u);
    if (name) { tokens.push({ kind: 'name', text: name[0], column }); i += name[0].length; continue; }
    const pair = text.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '**'].includes(pair)) { tokens.push({ kind: 'symbol', text: pair, column }); i += 2; continue; }
    if ('+-*/÷%=<>()[],'.includes(char)) { tokens.push({ kind: 'symbol', text: char, column }); i++; continue; }
    fail(`「${char}」を解釈できません。`);
  }
  tokens.push({ kind: 'eof', text: '', column: i + offset });
  return tokens;
}
