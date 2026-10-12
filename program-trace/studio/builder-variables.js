import { constantValue } from './expressions.js?v=20261009-function-help3';
import { hasValueReturn } from './builder-functions.js?v=20261009-function-help3';
export function builderContext(model, specs, base, functionId) {
    const catalog = new Map(), strings = new Set();
    const add = (item) => {
        const previous = catalog.get(item.name);
        catalog.set(item.name, previous && item.kind === 'variable' && previous.kind !== 'variable' ? previous : { ...previous, ...item });
    };
    function kindOf(expr) {
        if (expr.kind === 'variable')
            return catalog.get(expr.name)?.kind ?? 'variable';
        if (expr.kind === 'array')
            return expr.items.some(item => kindOf(item) !== 'variable') ? 'matrix' : 'array';
        if (expr.kind === 'index')
            return kindOf(expr.target) === 'matrix' && expr.indices.length === 1 ? 'array' : 'variable';
        return 'variable';
    }
    function scan(expr) {
        if (expr.kind === 'literal' && typeof expr.value === 'string')
            strings.add(expr.value);
        else if (expr.kind === 'index') {
            scan(expr.target);
            expr.indices.forEach(scan);
        }
        else if (expr.kind === 'array')
            expr.items.forEach(scan);
        else if (expr.kind === 'binary') {
            scan(expr.left);
            scan(expr.right);
        }
        else if (expr.kind === 'unary')
            scan(expr.expression);
        else if (expr.kind === 'call')
            expr.args.forEach(scan);
    }
    function visit(node) {
        if (node.kind === 'assign')
            for (const assignment of node.assignments) {
                let value;
                try {
                    value = constantValue(assignment.expression);
                }
                catch { /* Arithmetic diagnostics belong to the row, not the candidate list. */ }
                const kind = assignment.target.indices.length === 2 ? 'matrix' : assignment.target.indices.length ? catalog.get(assignment.target.name)?.kind === 'matrix' ? 'matrix' : 'array' : kindOf(assignment.expression);
                add({ name: assignment.target.name, kind, ...(value !== undefined && !assignment.target.indices.length ? { value } : {}) });
                assignment.target.indices.forEach(scan);
                scan(assignment.expression);
            }
        if (node.kind === 'for') {
            add({ name: node.name, kind: 'variable' });
            scan(node.start);
            scan(node.end);
            scan(node.step);
        }
        if (node.kind === 'input') {
            const kind = specs[node.name]?.kind;
            add({ name: node.name, kind: kind === 'array' ? 'array' : kind === 'matrix' ? 'matrix' : 'variable' });
        }
        if (node.kind === 'if' || node.kind === 'while')
            scan(node.condition);
        if (node.kind === 'print')
            node.args.forEach(scan);
        if ((node.kind === 'return' || node.kind === 'call') && node.expression)
            scan(node.expression);
        if ('body' in node)
            node.body.forEach(visit);
        if (node.kind === 'if' && node.otherwise)
            visit(node.otherwise);
    }
    const functions = model.nodes.filter((node) => node.kind === 'define');
    const active = functions.find(node => node.id === functionId);
    if (active) {
        active.parameters.forEach(name => add({ name, kind: 'variable' }));
        active.body.forEach(visit);
    }
    else
        model.nodes.filter(node => node.kind !== 'define').forEach(visit);
    return { variables: [...catalog.keys()], arrays: [...catalog.values()].filter(item => item.kind !== 'variable').map(item => item.name), catalog: [...catalog.values()], strings: [...strings], base, parameters: active?.parameters, activeFunction: active?.name, functions: functions.map(({ name, parameters, body }) => ({ name, parameters, returnsValue: hasValueReturn(body) })) };
}
