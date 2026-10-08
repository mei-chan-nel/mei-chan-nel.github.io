import { validateDraft, validateInputSpec } from './documents.js?v=20261009-functions';
import { assertReady, builderSource, modelFromDraft, modelFromSource, rowId, validateBuilder } from './builder-model.js?v=20261009-functions';
import { LIMITS, StudioError, validName } from './errors.js';
// These tables are part of share v2. Append in a future format; never reorder.
const unary = ['+', '-', 'not'];
const binary = ['+', '-', '*', '/', '÷', '%', '**', '==', '!=', '<', '<=', '>', '>=', 'and', 'or'];
const builtins = ['要素数', '乱数'];
const inputKinds = ['number', 'text', 'array', 'matrix'];
const inputFields = ['kind', 'integer', 'min', 'max', 'minLength', 'maxLength', 'elementKind', 'rows', 'columns'];
// Wire defaults must remain fixed even if the editor's defaults change later.
const inputDefaults = Object.freeze({ kind: 'number', integer: true, min: -1000000, max: 1000000,
    minLength: 1, maxLength: 100, elementKind: 'number', rows: 2, columns: 3 });
const fail = () => { throw new StudioError('共有URLのプログラムや設定を読み取れません。URL全体をコピーするか、ファイルで読み込んでください。'); };
function packExpression(expr) {
    switch (expr.kind) {
        case 'literal': return expr.value;
        case 'variable': return [0, expr.name];
        case 'array': return [1, ...expr.items.map(packExpression)];
        case 'index': return [2, packExpression(expr.target), ...expr.indices.map(packExpression)];
        case 'unary': return [3, unary.indexOf(expr.operator), packExpression(expr.expression)];
        case 'binary': return [4, binary.indexOf(expr.operator), packExpression(expr.left), packExpression(expr.right)];
        case 'call': return [5, builtins.includes(expr.name) ? builtins.indexOf(expr.name) : expr.name, ...expr.args.map(packExpression)];
    }
}
const packTarget = (target) => target.indices.length ? [target.name, ...target.indices.map(packExpression)] : target.name;
function packNode(node) {
    let row;
    switch (node.kind) {
        case 'blank':
            row = [0];
            break;
        case 'assign':
            row = [1, ...node.assignments.flatMap(assignment => [packTarget(assignment.target), packExpression(assignment.expression)])];
            break;
        case 'print':
            row = [2, ...node.args.map(packExpression)];
            break;
        case 'input':
            row = [3, node.name];
            break;
        case 'if':
            row = [4, packExpression(node.condition), node.body.map(packNode), ...(node.otherwise ? [packNode(node.otherwise)] : [])];
            break;
        case 'else':
            row = [5, node.body.map(packNode)];
            break;
        case 'for':
            row = [6, node.name, packExpression(node.start), packExpression(node.end), node.body.map(packNode),
                ...(node.direction === 1 && node.step.kind === 'literal' && node.step.value === 1 ? [] : [[packExpression(node.step), node.direction]])];
            break;
        case 'while':
            row = [7, packExpression(node.condition), node.body.map(packNode)];
            break;
        case 'comment':
            row = [8, node.text];
            break;
        case 'define':
            row = [9, node.name, node.parameters, node.body.map(packNode)];
            break;
        case 'return':
            row = [10, ...(node.expression ? [packExpression(node.expression)] : [])];
            break;
        case 'call':
            row = [11, packExpression(node.expression)];
            break;
    }
    if (node.comment)
        row.push({ c: node.comment });
    return row;
}
function inputValues(spec) {
    return inputFields.map(key => key === 'kind' ? inputKinds.indexOf(spec.kind) : key === 'integer' ? Number(spec.integer) : key === 'elementKind' ? Number(spec.elementKind === 'text') : spec[key]);
}
function packInputs(settings) {
    const defaults = inputValues(inputDefaults);
    return Object.keys(settings.inputs).sort().map(name => {
        const values = inputValues(settings.inputs[name]), changed = [];
        let mask = 0;
        values.forEach((value, index) => { if (value !== defaults[index]) {
            mask |= 1 << index;
            changed.push(value);
        } });
        return [name, mask, ...changed];
    });
}
/** Candidates preserve exact source text. Structured rows are used only when
 * they reproduce that text, and are required for unfinished nested blocks. */
export function sharePackets(value) {
    const draft = validateDraft(value), model = modelFromDraft(draft), inputs = packInputs(draft.settings);
    const packet = (program) => [draft.title, program,
        ...(inputs.length ? [draft.settings.indexBase, inputs] : draft.settings.indexBase ? [1] : [])];
    const candidates = draft.builder ? [] : [packet(draft.source)];
    if (draft.builder || builderSource(model) === draft.source) {
        // The same bounds as imported builder data keep every emitted packet decodable.
        try {
            validateBuilder(model);
            candidates.push(packet(model.nodes.map(packNode)));
        }
        catch (error) {
            if (draft.builder)
                throw error;
        }
    }
    return candidates;
}
export function readSharePacket(value) {
    const list = (value, min, max) => Array.isArray(value) && value.length >= min && value.length <= max ? value : fail();
    const text = (value, max = LIMITS.string) => typeof value === 'string' && value.length <= max ? value : fail();
    const name = (value) => typeof value === 'string' && validName(value) ? value : fail();
    const enumValue = (table, value) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < table.length ? table[value] : fail();
    let nodeCount = 0, expressionCount = 0;
    function expression(value, depth = 0) {
        if (depth > LIMITS.depth || ++expressionCount > 20000)
            return fail();
        const column = 1;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
            return { kind: 'literal', value, column };
        const row = list(value, 1, LIMITS.arrayCells + 1);
        switch (row[0]) {
            case 0:
                if (row.length !== 2)
                    return fail();
                return { kind: 'variable', name: name(row[1]), column };
            case 1: return { kind: 'array', items: row.slice(1).map(item => expression(item, depth + 1)), column };
            case 2:
                if (row.length < 3 || row.length > 4)
                    return fail();
                return { kind: 'index', target: expression(row[1], depth + 1), indices: row.slice(2).map(item => expression(item, depth + 1)), column };
            case 3:
                if (row.length !== 3)
                    return fail();
                return { kind: 'unary', operator: enumValue(unary, row[1]), expression: expression(row[2], depth + 1), column };
            case 4:
                if (row.length !== 4)
                    return fail();
                return { kind: 'binary', operator: enumValue(binary, row[1]), left: expression(row[2], depth + 1), right: expression(row[3], depth + 1), column };
            case 5:
                if (row.length < 2 || row.length > 130)
                    return fail();
                return { kind: 'call', name: typeof row[1] === 'number' ? enumValue(builtins, row[1]) : name(row[1]), args: row.slice(2).map(item => expression(item, depth + 1)), column };
            default: return fail();
        }
    }
    function target(value) {
        if (typeof value === 'string')
            return { name: name(value), indices: [] };
        const parts = list(value, 2, 3);
        return { name: name(parts[0]), indices: parts.slice(1).map(item => expression(item)) };
    }
    function nodes(value, depth) { return list(value, 0, LIMITS.lines).map(item => node(item, depth)); }
    function node(value, depth) {
        if (depth > LIMITS.depth || ++nodeCount > LIMITS.lines)
            return fail();
        const row = [...list(value, 1, LIMITS.arrayCells + 2)], last = row.at(-1);
        const base = { id: rowId(), comment: '' };
        if (last && typeof last === 'object' && !Array.isArray(last)) {
            if (Object.keys(last).length !== 1 || !('c' in last))
                return fail();
            base.comment = text(last.c);
            row.pop();
        }
        switch (row[0]) {
            case 0:
                if (row.length !== 1)
                    return fail();
                return { ...base, kind: 'blank' };
            case 1: {
                if (row.length < 3 || row.length % 2 !== 1 || row.length > 257)
                    return fail();
                const assignments = [];
                for (let i = 1; i < row.length; i += 2)
                    assignments.push({ target: target(row[i]), expression: expression(row[i + 1]) });
                return { ...base, kind: 'assign', assignments };
            }
            case 2:
                if (row.length > 129)
                    return fail();
                return { ...base, kind: 'print', args: row.slice(1).map(item => expression(item)) };
            case 3:
                if (row.length !== 2)
                    return fail();
                return { ...base, kind: 'input', name: name(row[1]) };
            case 4: {
                if (row.length !== 3 && row.length !== 4)
                    return fail();
                const condition = expression(row[1]), body = nodes(row[2], depth + 1), otherwise = row.length === 4 ? node(row[3], depth) : undefined;
                if (otherwise && otherwise.kind !== 'if' && otherwise.kind !== 'else')
                    return fail();
                return { ...base, kind: 'if', condition, body, ...(otherwise ? { otherwise } : {}) };
            }
            case 5:
                if (row.length !== 2)
                    return fail();
                return { ...base, kind: 'else', body: nodes(row[1], depth + 1) };
            case 6: {
                if (row.length !== 5 && row.length !== 6)
                    return fail();
                const extra = row.length === 6 ? list(row[5], 2, 2) : [1, 1];
                if (extra[1] !== 1 && extra[1] !== -1)
                    return fail();
                return { ...base, kind: 'for', name: name(row[1]), start: expression(row[2]), end: expression(row[3]), step: expression(extra[0]), direction: extra[1], body: nodes(row[4], depth + 1) };
            }
            case 7:
                if (row.length !== 3)
                    return fail();
                return { ...base, kind: 'while', condition: expression(row[1]), body: nodes(row[2], depth + 1) };
            case 8:
                if (row.length !== 2)
                    return fail();
                return { ...base, kind: 'comment', text: text(row[1]) };
            case 9:
                if (row.length !== 4)
                    return fail();
                return { ...base, kind: 'define', name: name(row[1]), parameters: list(row[2], 0, LIMITS.variables).map(name), body: nodes(row[3], depth + 1) };
            case 10:
                if (row.length > 2)
                    return fail();
                return { ...base, kind: 'return', ...(row.length === 2 ? { expression: expression(row[1]) } : {}) };
            case 11:
                if (row.length !== 2)
                    return fail();
                return { ...base, kind: 'call', expression: expression(row[1]) };
            default: return fail();
        }
    }
    function inputs(value) {
        const result = Object.create(null);
        for (const entry of list(value, 0, LIMITS.variables)) {
            const parts = list(entry, 2, 11), key = name(parts[0]), mask = parts[1];
            if (key in result || typeof mask !== 'number' || !Number.isInteger(mask) || mask < 0 || mask > 511)
                return fail();
            const spec = { ...inputDefaults };
            let next = 2;
            for (const [i, field] of inputFields.entries())
                if (mask & (1 << i)) {
                    if (next >= parts.length)
                        return fail();
                    const value = parts[next++];
                    if (field === 'kind')
                        spec.kind = enumValue([...inputKinds], value);
                    else if (field === 'integer')
                        spec.integer = enumValue([false, true], value);
                    else if (field === 'elementKind')
                        spec.elementKind = enumValue(['number', 'text'], value);
                    else {
                        if (typeof value !== 'number')
                            return fail();
                        spec[field] = value;
                    }
                }
            if (next !== parts.length)
                return fail();
            result[key] = validateInputSpec(spec);
        }
        return result;
    }
    const packet = list(value, 2, 4), title = text(packet[0], 120), indexBase = packet.length >= 3 ? packet[2] : 0;
    if (indexBase !== 0 && indexBase !== 1)
        return fail();
    const settings = { indexBase, inputs: packet.length === 4 ? inputs(packet[3]) : Object.create(null) };
    if (typeof packet[1] === 'string') {
        const draft = validateDraft({ version: 1, title, source: packet[1], settings });
        // A complete source-only packet is still parsed as this app's language.
        modelFromSource(draft.source);
        return draft;
    }
    const builder = validateBuilder({ version: 1, nodes: nodes(packet[1], 0) });
    let complete = true;
    try {
        assertReady(builder);
    }
    catch {
        complete = false;
    }
    return validateDraft({ version: 1, title, source: builderSource(builder), settings, ...(!complete ? { builder } : {}) });
}
