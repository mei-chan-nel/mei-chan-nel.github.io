import { getBuiltin } from './builtins.js';
import { parseProgram } from './parser.js';
import { StudioError, LIMITS } from './errors.js';
import { binary, cloneValue, formatValue, numeric, readVariable, readIndices, truth, validateVariables, validateValue } from './values.js';
export function compile(source) {
    const parsed = parseProgram(source), instructions = [];
    const bodyLines = (nodes) => nodes.flatMap(node => [node.line,
        ...('body' in node ? bodyLines(node.body) : []), ...('otherwise' in node && node.otherwise ? bodyLines([node.otherwise]) : [])]);
    function block(nodes, next) {
        let entry = next;
        for (let i = nodes.length - 1; i >= 0; i--) {
            const node = nodes[i], pc = instructions.length;
            const instruction = { ...node, next: entry, bodyEntry: null, falseEntry: entry, bodyLines: 'body' in node ? bodyLines(node.body) : [] };
            instructions.push(instruction);
            if ('body' in node)
                instruction.bodyEntry = block(node.body, node.kind === 'for' || node.kind === 'while' ? pc : entry);
            if (node.kind === 'if' && node.otherwise)
                instruction.falseEntry = block([node.otherwise], entry);
            entry = pc;
        }
        return entry;
    }
    return { ...parsed, instructions, entry: block(parsed.nodes, null) };
}
export function initialState(compiled, seed = 0xc0ffee) {
    return { pc: compiled.entry, steps: 0, currentLine: null, completed: compiled.entry === null,
        variables: Object.create(null), output: [], changes: [], reads: [], skippedLines: [], event: null,
        loops: Object.create(null), randomState: seed >>> 0 };
}
function evaluate(expr, state, settings, depth = 0, sources) {
    if (depth > LIMITS.depth)
        throw new StudioError('式の入れ子が深すぎます。');
    const recurse = (child) => evaluate(child, state, settings, depth + 1, sources);
    switch (expr.kind) {
        case 'literal': return { value: expr.value, resolved: formatValue(expr.value, 80) };
        case 'variable': {
            const value = readVariable(state.variables, expr.name);
            sources?.push({ name: expr.name, indices: [] });
            state.reads.push({ name: expr.name, indices: [] });
            return { value, resolved: formatValue(value, 80) };
        }
        case 'array': {
            const value = expr.items.map(item => recurse(item).value);
            validateValue(value);
            validateVariables({ array: value });
            return { value, resolved: formatValue(value, 80) };
        }
        case 'index': {
            let target = expr.target, indices = [...expr.indices];
            while (target.kind === 'index') {
                indices = [...target.indices, ...indices];
                target = target.target;
            }
            if (indices.length > 2)
                throw new StudioError('配列は二次元までです。');
            // Index expressions select a cell. They are references, but their values
            // aren't the values being transferred to the left-hand side.
            const actual = indices.map(index => numeric(evaluate(index, state, settings, depth + 1).value));
            const value = target.kind === 'variable' ? readVariable(state.variables, target.name) : recurse(target).value;
            const name = target.kind === 'variable' ? target.name : '配列';
            const result = readIndices(value, actual, settings.indexBase, name);
            if (target.kind === 'variable') {
                state.reads.push({ name, indices: actual });
                sources?.push({ name, indices: actual });
            }
            return { value: result, resolved: formatValue(result, 80) };
        }
        case 'unary': {
            const result = recurse(expr.expression);
            const value = expr.operator === 'not' ? !truth(result.value) : numeric((expr.operator === '-' ? -1 : 1) * numeric(result.value));
            return { value, resolved: `${expr.operator === 'not' ? 'not ' : expr.operator}(${result.resolved})` };
        }
        case 'binary': {
            const left = recurse(expr.left);
            if (expr.operator === 'and' || expr.operator === 'or') {
                const first = truth(left.value);
                if (expr.operator === 'and' && !first || expr.operator === 'or' && first)
                    return { value: first, resolved: `${left.resolved} ${expr.operator} （右側は評価しない）` };
                const right = recurse(expr.right);
                return { value: truth(right.value), resolved: `${left.resolved} ${expr.operator} ${right.resolved}` };
            }
            const right = recurse(expr.right);
            return { value: binary(expr.operator, left.value, right.value), resolved: `(${left.resolved} ${expr.operator} ${right.resolved})` };
        }
        case 'call': {
            const args = expr.args.map(recurse), definition = getBuiltin(expr.name, args.length);
            if (definition.effect === 'output')
                throw new StudioError('表示する()は式の中で使えません。');
            const value = definition.invoke(args.map(item => item.value), {
                random: () => { state.randomState = (Math.imul(state.randomState, 1664525) + 1013904223) >>> 0; return state.randomState / 4294967296; },
                display: () => { throw new StudioError('この式は表示を行えません。'); },
            });
            if (value === undefined)
                throw new StudioError('この関数には計算結果がありません。');
            validateValue(value);
            return { value, resolved: `${expr.name}(${args.map(item => item.resolved).join(', ')}) → ${formatValue(value, 80)}` };
        }
    }
}
function write(target, value, state, settings) {
    validateValue(value);
    const indices = target.indices.map(index => numeric(evaluate(index, state, settings).value));
    const beforeWhole = state.variables[target.name];
    let before = beforeWhole, after = cloneValue(value);
    if (indices.length) {
        const original = readVariable(state.variables, target.name);
        before = readIndices(original, indices, settings.indexBase, target.name);
        const copy = cloneValue(original);
        let container = copy;
        for (const index of indices.slice(0, -1))
            container = container[index - settings.indexBase];
        container[indices.at(-1) - settings.indexBase] = after;
        after = copy;
    }
    const prospective = { ...state.variables, [target.name]: after };
    validateVariables(prospective);
    state.variables = prospective;
    if (JSON.stringify(before) !== JSON.stringify(value))
        state.changes.push({ name: target.name, indices, before, after: cloneValue(value) });
    return indices;
}
export function step(compiled, previous, settings, input) {
    if (previous.completed || previous.pc === null)
        return previous;
    const instruction = compiled.instructions[previous.pc];
    if (previous.steps >= LIMITS.steps)
        throw new StudioError(`${LIMITS.steps.toLocaleString('ja-JP')}ステップの上限に達しました。繰り返しの条件や値を確認してください。`, instruction.line);
    const state = { ...previous, variables: { ...previous.variables }, loops: { ...previous.loops }, output: previous.output,
        changes: [], reads: [], skippedLines: [], steps: previous.steps + 1, currentLine: instruction.line,
        event: { title: '', explanation: '' }, pc: instruction.next };
    const evaluateHere = (expr) => evaluate(expr, state, settings);
    try {
        switch (instruction.kind) {
            case 'assign': {
                const descriptions = [], assignments = [];
                for (const assignment of instruction.assignments) {
                    const sources = [];
                    const result = evaluate(assignment.expression, state, settings, 0, sources);
                    const indices = write(assignment.target, result.value, state, settings);
                    assignments.push({ name: assignment.target.name, indices, sources });
                    const target = assignment.target.name + (indices.length ? `[${indices.join(', ')}]` : '');
                    descriptions.push(`${result.resolved} の結果 ${formatValue(result.value, 80)} を ${target} に代入しました。`);
                }
                state.event = { title: instruction.assignments.some(a => a.target.indices.length) ? '配列の要素に代入' : instruction.assignments.some(a => Array.isArray(state.variables[a.target.name])) ? '配列を用意する' : '変数に値を代入',
                    explanation: descriptions.join(' '), assignments, sources: assignments.flatMap(item => item.sources) };
                break;
            }
            case 'input': {
                if (input === undefined)
                    throw new StudioError('入力してから実行してください。');
                write({ name: instruction.name, indices: [] }, input, state, settings);
                state.event = { title: '外部からの入力を受け取る', explanation: `入力した ${formatValue(input, 100)} を ${instruction.name} に代入しました。`,
                    assignments: [{ name: instruction.name, indices: [], sources: [] }], sources: [] };
                break;
            }
            case 'print': {
                const args = instruction.args.map(expr => evaluateHere(expr).value);
                getBuiltin('表示する', args.length).invoke(args, { random: () => { throw new StudioError('表示のために乱数を再生成できません。'); }, display: text => {
                        if (state.output.length >= LIMITS.outputs || text.length + state.output.reduce((sum, row) => sum + row.length, 0) > LIMITS.outputCharacters)
                            throw new StudioError('出力の上限に達しました。表示回数や内容を減らしてください。');
                        state.output = [...state.output, text];
                        state.event = { title: '表示する', explanation: `「${text.length > 160 ? text.slice(0, 159) + '…' : text}」と表示する。` };
                    } });
                break;
            }
            case 'if':
            case 'while': {
                const evaluated = evaluateHere(instruction.condition), result = truth(evaluated.value);
                state.pc = result ? instruction.bodyEntry : instruction.falseEntry;
                if (!result)
                    state.skippedLines = instruction.bodyLines;
                state.event = { title: instruction.kind === 'while' ? result ? '条件が成り立つ → 繰り返す' : '条件が成り立たない → 繰り返しを終了'
                        : result ? '条件が成り立つ → 内側へ' : '条件が成り立たない → 次へ',
                    explanation: `${evaluated.resolved} は「${result ? '真' : '偽'}」です。${result ? '内側の行を実行します。' : '内側の行を飛ばして進みます。'}`,
                    condition: { resolved: evaluated.resolved, result } };
                break;
            }
            case 'else':
                state.pc = instruction.bodyEntry;
                state.event = { title: 'そうでなければの処理へ', explanation: 'ここまでの条件が成り立たなかったので、この枝の内側の行を実行します。' };
                break;
            case 'for': {
                const loop = previous.loops[previous.pc];
                const end = loop?.end ?? numeric(evaluateHere(instruction.end).value);
                const amount = loop ? Math.abs(loop.increment) : numeric(evaluateHere(instruction.step).value);
                const candidate = loop ? numeric(readVariable(state.variables, instruction.name)) + loop.increment : numeric(evaluateHere(instruction.start).value);
                if (![end, amount, candidate].every(Number.isSafeInteger) || amount <= 0)
                    throw new StudioError('繰り返しの開始・終了は整数にし、増減する値は1以上の整数にしてください。');
                const increment = amount * instruction.direction, result = increment > 0 ? candidate <= end : candidate >= end;
                write({ name: instruction.name, indices: [] }, candidate, state, settings);
                if (result) {
                    state.loops[previous.pc] = { end, increment, iteration: (loop?.iteration ?? 0) + 1 };
                    state.pc = instruction.bodyEntry;
                }
                else {
                    delete state.loops[previous.pc];
                    state.pc = instruction.next;
                    if (!loop)
                        state.skippedLines = instruction.bodyLines;
                }
                const comparison = `${candidate} ${increment > 0 ? '≤' : '≥'} ${end}`;
                state.event = { title: result ? '範囲内 → 繰り返す' : '範囲を超えた → 繰り返しを終了',
                    explanation: `${instruction.name} を ${candidate} にしました。${comparison} は「${result ? '真' : '偽'}」です。${result ? `内側を実行します（${state.loops[previous.pc].iteration}回目）。` : '繰り返しの次の行へ進みます。'}`,
                    condition: { resolved: comparison, result } };
                break;
            }
        }
        state.completed = state.pc === null;
        return state;
    }
    catch (error) {
        if (error instanceof StudioError) {
            error.line = instruction.line;
            throw error;
        }
        throw new StudioError(error instanceof Error ? error.message : '実行できませんでした。', instruction.line);
    }
}
export function finish(state) {
    return state.completed ? { ...state, currentLine: null, event: null, changes: [], reads: [], skippedLines: [] } : state;
}
