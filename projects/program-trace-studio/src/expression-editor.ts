import { element, button } from './dom.js';
import { expressionText, valueExpression } from './expressions.js';
import { builtinRegistry, getBuiltin } from './builtins.js';
import { StudioError, LIMITS } from './errors.js';
import { literal, variable } from './builder-model.js';
import { readExpressionInput, normalizeExpressionInput, validateExpression } from './expression-input.js';
import type { ExpressionContext, ExpectedExpression } from './expression-input.js';
import { openTapPad, tapControls } from './tap-controls.js';
import type { Expr } from './types.js';
export type { ExpressionContext, VariableChoice } from './expression-input.js';

let serial = 0;
export interface ExpressionEditor { node: HTMLElement; read: () => Expr }
export function field(label: string, value: string, type = 'text'): { node: HTMLElement; input: HTMLInputElement } {
  const node = element('div', 'builder-field'), caption = element('label', '', label), input = element('input');
  input.id = `builder-field-${++serial}`; input.type = type; input.value = value; input.autocomplete = 'off'; caption.htmlFor = input.id;
  if (type === 'number') input.step = 'any'; else input.maxLength = LIMITS.string;
  node.append(caption, input); return { node, input };
}
export function selection(label: string, choices: readonly (readonly [string, string])[], value: string): { node: HTMLElement; input: HTMLSelectElement } {
  const node = element('div', 'builder-field'), caption = element('label', '', label), input = element('select');
  input.id = `builder-field-${++serial}`; caption.htmlFor = input.id;
  for (const [key, text] of choices) { const option = element('option', '', text); option.value = key; input.append(option); }
  input.value = value; node.append(caption, input); return { node, input };
}
export function nameField(label: string, value: string): ReturnType<typeof field> {
  const item = field(label, value); item.input.dataset.newName = 'true'; item.input.maxLength = 80; return item;
}
export function subExpression(initial: Expr, label: string, context: ExpressionContext, expected: ExpectedExpression = 'scalar'): ExpressionEditor {
  const node = element('details', 'sub-expression'), caption = element('summary', '', `${label}：${expressionText(initial)}`); node.append(caption);
  let editor: ExpressionEditor | undefined;
  node.addEventListener('expression-change', () => { if (editor) { try { caption.textContent = `${label}：${expressionText(editor.read())}`; } catch { caption.textContent = `${label}：編集中`; } } });
  node.addEventListener('toggle', () => { if (node.open && !editor) { editor = expressionEditor(initial, label, context, false, expected); node.append(editor.node); } });
  return { node, read: () => editor ? editor.read() : validateExpression(structuredClone(initial), context, expected) };
}

export function expressionEditor(initial: Expr | undefined, label: string, context: ExpressionContext, condition = false, expected: ExpectedExpression = 'any'): ExpressionEditor {
  const node = element('fieldset', 'expression-editor'); node.append(element('legend', '', label));
  const inputLabel = element('label', 'sr-only', label), input = element('textarea', 'expression-input');
  input.id = `expression-${++serial}`; inputLabel.htmlFor = input.id; input.rows = 2; input.spellcheck = false; input.autocomplete = 'off'; input.maxLength = LIMITS.sourceBytes;
  input.value = initial ? expressionText(initial) : ''; input.placeholder = condition ? '例：x >= 10' : expected === 'array' ? '[3, 5, 9]' : expected === 'matrix' ? '[[1, 2], [3, 4]]' : '例：3、x + y、"合計は"';
  node.append(inputLabel, input);
  const edits = element('div', 'expression-edit-tools'), palette = element('div', 'expression-palette'), auxiliary = element('div', 'expression-auxiliary');
  const grid = element('div', 'expression-array-grid'), switchMode = button('', () => {
    if (gridMode) { input.value = expressionText(readGrid()); gridMode = false; }
    else { const expr = readExpressionInput(input.value, context, expected); if (expr.kind !== 'array') throw new StudioError('配列を [ ] で入力すると、要素ごとに編集できます。'); gridExpr = expr; gridMode = true; renderGrid(); }
    renderMode();
  }, 'text-button');
  let gridMode = initial?.kind === 'array' && (expected === 'array' || expected === 'matrix' && initial.items.every(row => row.kind === 'array')), gridExpr = initial?.kind === 'array' ? structuredClone(initial) : valueExpression(expected === 'matrix' ? [[0, 0], [0, 0]] : [0, 0, 0]) as Extract<Expr, { kind: 'array' }>;
  let cells: HTMLInputElement[][] = [], active: HTMLInputElement | HTMLTextAreaElement = input, pendingConfig = false;
  auxiliary.hidden = true; node.append(grid, edits, palette, auxiliary);
  const changed = (): void => { node.dispatchEvent(new Event('expression-change', { bubbles: true })); };
  input.addEventListener('input', changed); input.addEventListener('focus', () => { active = input; });
  function closeConfig(): void { auxiliary.replaceChildren(); auxiliary.hidden = true; pendingConfig = false; }
  function put(value: Expr | string): void {
    if (gridMode && !cells.some(row => row.length)) { gridExpr.items = [literal(0)]; renderGrid(); active.value = ''; }
    const target = active, text = typeof value === 'string' ? value : expressionText(value), start = target.selectionStart ?? target.value.length, end = target.selectionEnd ?? start;
    const before = target.value.slice(0, start), after = target.value.slice(end);
    const prefix = before && !/\s$/u.test(before) && ![')', ']', ','].includes(text) ? ' ' : '';
    const suffix = after && !/^\s/u.test(after) && !['(', '['].includes(text) ? ' ' : '';
    target.setRangeText(prefix + text + suffix, start, end, 'end'); closeConfig(); target.focus(); changed();
  }
  function readGrid(): Extract<Expr, { kind: 'array' }> {
    const rows = cells.map(row => row.map(cell => readExpressionInput(cell.value, context, 'scalar')));
    const expr: Extract<Expr, { kind: 'array' }> = { kind: 'array', items: expected === 'matrix' ? rows.map(items => ({ kind: 'array', items, column: 1 })) : rows[0], column: 1 };
    validateExpression(expr, context, expected); return expr;
  }
  function renderGrid(): void {
    grid.replaceChildren(); cells = [];
    const rows = expected === 'matrix' ? gridExpr.items.map(row => {
      if (row.kind !== 'array') throw new StudioError('二次元配列の各行を [ ] で入力してください。'); return row.items;
    }) : [gridExpr.items];
    const count = rows.length, columns = rows[0]?.length ?? 0, controls = element('div', 'array-length-controls');
    controls.append(element('span', 'array-count', expected === 'matrix' ? `${count}行 × ${columns}列` : `${columns}要素`));
    const changeGrid = (change: (rows: Expr[][]) => void): void => {
      const previous = readGrid(), items = expected === 'matrix' ? previous.items.map(item => (item as Extract<Expr, { kind: 'array' }>).items) : [previous.items];
      change(items);
      gridExpr = { kind: 'array', items: expected === 'matrix' ? items.map(items => ({ kind: 'array', items, column: 1 })) : items[0], column: 1 };
      validateExpression(gridExpr, context, expected); renderGrid(); changed();
    };
    if (expected === 'matrix') {
      controls.append(button('行を追加する', () => changeGrid(items => items.push(Array.from({ length: columns }, () => literal(0)))), 'button array-count-button'));
      controls.append(button('列を追加する', () => changeGrid(items => items.forEach(row => row.push(literal(0)))), 'button array-count-button'));
      const removers = element('div', 'column-removers');
      for (let j = 0; j < columns; j++) { const remove = button(`列${j + context.base} ×`, () => changeGrid(items => items.forEach(row => row.splice(j, 1))), 'text-button'); remove.disabled = columns <= 1; removers.append(remove); }
      grid.append(controls, removers);
    } else { controls.append(button('要素を追加する', () => changeGrid(items => items[0].push(literal(0))), 'button array-count-button')); grid.append(controls); }
    rows.forEach((row, i) => {
      const rowNode = element('div', expected === 'matrix' ? 'matrix-edit-row' : ''), wrap = element('div', 'array-editor-cells');
      if (expected === 'matrix') {
        rowNode.append(element('strong', 'matrix-edit-label', `行 ${i + context.base}`));
        const remove = button('×', () => changeGrid(items => items.splice(i, 1)), 'array-remove'); remove.setAttribute('aria-label', `行${i + context.base}を削除`); remove.disabled = count <= 1; rowNode.append(remove);
      }
      const rowInputs: HTMLInputElement[] = [];
      row.forEach((expr, j) => {
        const caption = expected === 'matrix' ? `[${i + context.base}, ${j + context.base}]` : `[${j + context.base}]`, item = field(caption, expressionText(expr)); item.node.classList.add('array-editor-cell');
        item.input.dataset.newName = 'true'; item.input.spellcheck = false; item.input.maxLength = LIMITS.string;
        item.input.addEventListener('focus', () => { active = item.input; }); item.input.addEventListener('input', changed); rowInputs.push(item.input);
        if (expected !== 'matrix') { const remove = button('×', () => changeGrid(items => items[0].splice(j, 1)), 'array-remove'); remove.setAttribute('aria-label', `要素${j + context.base}を削除`); item.node.append(remove); }
        wrap.append(item.node);
      });
      cells.push(rowInputs); rowNode.append(wrap); grid.append(rowNode);
    });
    active = cells[0]?.[0] ?? input;
  }
  function renderMode(): void {
    grid.hidden = !gridMode; input.hidden = gridMode; switchMode.textContent = gridMode ? '式で入力する' : '要素ごとに入力する'; renderNames(); changed();
  }
  if (expected === 'array' || expected === 'matrix') edits.append(switchMode);
  edits.append(button('すべて消す', () => { if (gridMode) { active.value = ''; active.focus(); } else { input.value = ''; input.focus(); } closeConfig(); changed(); }, 'text-button'));
  function section(title: string): HTMLElement { const wrap = element('div', 'expression-choice-group'); wrap.append(element('p', 'choice-caption', title)); const choices = element('div', 'tap-choices'); wrap.append(choices); palette.append(wrap); return choices; }
  const names = section('入力の候補');
  const choices = context.catalog ?? context.variables.map(name => ({ name, kind: context.arrays.includes(name) ? 'array' as const : 'variable' as const }));
  function renderNames(): void {
  names.replaceChildren();
  for (const item of choices) {
    if (item.kind === 'variable') { if (expected !== 'collection') names.append(button(item.name, () => put(variable(item.name)), 'tap-chip variable-chip')); continue; }
    const wholeAllowed = expected === 'any' || expected === 'collection' || expected === item.kind;
    if (wholeAllowed) names.append(button(item.name, () => {
      if (gridMode) { input.value = expressionText(variable(item.name)); gridMode = false; active = input; renderMode(); input.focus(); }
      else put(variable(item.name));
    }, 'tap-chip variable-chip'));
    if (gridMode || expected !== 'matrix' && (!['array', 'collection'].includes(expected) || item.kind === 'matrix')) names.append(button(`${item.name}[ ]`, () => arrayReference(item.name, item.kind === 'matrix' && !gridMode && ['array', 'collection'].includes(expected) ? 1 : item.kind === 'matrix' ? 2 : 1), 'tap-chip variable-chip'));
  }
  if (expected !== 'collection') names.append(button('数値の入力補助', () => openTapPad('', '数値', 'number', value => put(literal(Number(value)))), 'tap-chip'),
    button('" " の入力補助', () => openTapPad('', '文字列', 'text', value => put(literal(value)), context.strings), 'tap-chip'));
  }
  const operators = section(condition ? '比較・計算記号' : '計算記号');
  for (const [text, symbol] of [['＋', '+'], ['−', '-'], ['×', '*'], ['／', '/'], ['÷', '÷'], ['%', '%'], ['**', '**'], ['(', '('], [')', ')']]) operators.append(button(text, () => put(symbol), 'tap-chip'));
  const comparisons = section('比較・条件');
  for (const symbol of ['==', '!=', '<', '<=', '>', '>=', 'and', 'or', 'not']) comparisons.append(button(symbol, () => put(symbol), 'tap-chip'));
  comparisons.append(button('真', () => put(literal(true)), 'tap-chip'), button('偽', () => put(literal(false)), 'tap-chip'));
  if (!condition) { const details = element('details', 'comparison-palette'); details.append(element('summary', '', '比較・条件も使う'), comparisons.parentElement!); palette.append(details); }
  const functions = section('関数');
  for (const definition of builtinRegistry.values()) if (definition.effect === 'value' && (expected !== 'collection' || definition.returnKind === 'array' || definition.returnKind === 'matrix')) functions.append(button(`${definition.name}()`, () => functionConfig(definition.name), 'tap-chip'));
  for (const definition of context.functions ?? []) if (definition.returnsValue) functions.append(button(`${definition.name}()`, () => functionConfig(definition.name), 'tap-chip'));
  if (expected === 'collection') { operators.parentElement!.hidden = true; comparisons.parentElement!.hidden = true; functions.parentElement!.hidden = !functions.childElementCount; }
  function config(title: string): HTMLElement { closeConfig(); pendingConfig = true; auxiliary.hidden = false; auxiliary.append(element('h3', '', title)); return auxiliary; }
  function confirmConfig(read: () => Expr): void {
    auxiliary.append(button('式に入れる', () => put(read()), 'button button-primary'), button('閉じる', closeConfig, 'text-button')); tapControls(auxiliary, context.strings);
  }
  function arrayReference(name: string, dimensions: number): void {
    const area = config(`${name} の要素`), indices = Array.from({ length: dimensions }, (_, i) => expressionEditor(literal(context.base), dimensions === 2 ? i === 0 ? '行番号' : '列番号' : '要素番号', context, false, 'scalar'));
    area.append(...indices.map(item => item.node)); confirmConfig(() => ({ kind: 'index', target: variable(name), indices: indices.map(field => field.read()), column: 1 }));
  }
  function functionConfig(name: string): void {
    const area = config(`${name}()`);
    const custom = context.functions?.find(fn => fn.name === name);
    if (custom) {
      const args = custom.parameters.map(parameter => expressionEditor(undefined, `引数 ${parameter}`, context));
      area.append(...args.map(arg => arg.node)); confirmConfig(() => ({ kind: 'call', name, args: args.map(arg => arg.read()), column: 1 })); return;
    }
    if (name === '乱数') {
      const kind = selection('乱数の種類', [['整数', '整数'], ['実数', '実数']], '整数');
      const min = expressionEditor(literal(1), '最小値', context, false, 'scalar'), max = expressionEditor(literal(10), '最大値', context, false, 'scalar'); area.append(kind.node, min.node, max.node);
      confirmConfig(() => validateExpression({ kind: 'call', name, args: [min.read(), max.read(), literal(kind.input.value)], column: 1 }, context, 'scalar'));
    } else {
      const definition = getBuiltin(name, definitionArity(name)), args = Array.from({ length: definitionArity(name) }, (_, i) => expressionEditor(name === '要素数' && context.arrays.length ? variable(context.arrays[0]) : undefined, name === '要素数' ? '要素数を数える配列' : `引数 ${i + 1}`, context, false, definition.argumentKinds?.[i] ?? 'any'));
      area.append(...args.map(arg => arg.node)); confirmConfig(() => ({ kind: 'call', name, args: args.map(arg => arg.read()), column: 1 }));
    }
  }
  function definitionArity(name: string): number { const arities = builtinRegistry.get(name)!.arities; return arities === 'any' ? 1 : arities[0]; }
  if (gridMode) renderGrid(); renderMode();
  return { node, read: () => {
    if (pendingConfig) throw new StudioError('入力補助の「式に入れる」を押すか、閉じてから確定してください。');
    try {
      const expr = gridMode ? readGrid() : readExpressionInput(input.value, context, expected, condition);
      if (!gridMode) input.value = normalizeExpressionInput(input.value, condition); input.removeAttribute('aria-invalid'); return expr;
    } catch (error) { input.setAttribute('aria-invalid', 'true'); throw error; }
  } };
}
