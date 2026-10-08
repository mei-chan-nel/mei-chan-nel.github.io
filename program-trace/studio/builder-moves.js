import { validateBuilder } from './builder-model.js?v=20261009-function-editor2';
import { StudioError, LIMITS } from './errors.js';
export function rowLocations(model) {
    const result = new Map();
    function visit(node, position) {
        result.set(node.id, position);
        if ('body' in node)
            visitList(node.body, position.depth + 1, node);
        if (node.kind === 'if' && node.otherwise)
            visit(node.otherwise, { node: node.otherwise, depth: position.depth, index: position.index, parent: position.parent, branchOwner: node });
    }
    function visitList(list, depth, parent) { list.forEach((node, index) => visit(node, { node, list, index, depth, parent })); }
    visitList(model.nodes, 0);
    return result;
}
function anchor(location, locations) {
    while (location.branchOwner)
        location = locations.get(location.branchOwner.id);
    return location;
}
export function rowMoveDestination(model, id, action) {
    const locations = rowLocations(model), row = locations.get(id);
    if (!row?.list || row.branchOwner)
        return;
    const place = (index) => ({ parentId: row.parent?.id, index, depth: row.depth });
    if (action === 'up')
        return row.index > 0 ? place(row.index - 1) : undefined;
    if (action === 'down')
        return row.index < row.list.length - 1 ? place(row.index + 2) : undefined;
    if (action === 'inner') {
        const previous = row.list[row.index - 1];
        if (previous && 'body' in previous) {
            let target = previous;
            while (target.kind === 'if' && target.otherwise)
                target = target.otherwise;
            return { parentId: target.id, index: 'body' in target ? target.body.length : 0, depth: row.depth + 1 };
        }
        return;
    }
    if (row.parent) {
        const parent = anchor(locations.get(row.parent.id), locations);
        return { parentId: parent.parent?.id, index: parent.index + 1, depth: row.depth - 1 };
    }
}
function descendants(node) {
    const ids = new Set();
    const walk = (item) => { ids.add(item.id); if ('body' in item)
        item.body.forEach(walk); if (item.kind === 'if' && item.otherwise)
        walk(item.otherwise); };
    walk(node);
    return ids;
}
export function moveRow(model, id, destination) {
    const next = structuredClone(model), locations = rowLocations(next), source = locations.get(id);
    if (!source?.list || source.branchOwner)
        throw new StudioError('「そうでなくもし」「そうでなければ」は、元の「もし」の行と一緒に移動します。');
    const parent = destination.parentId ? locations.get(destination.parentId)?.node : undefined;
    if (destination.parentId && (!parent || !('body' in parent)))
        throw new StudioError('この場所には行を移せません。');
    if (parent && descendants(source.node).has(parent.id))
        throw new StudioError('まとまりを自身の内側へ移すことはできません。');
    const target = parent && 'body' in parent ? parent.body : next.nodes, actualDepth = parent ? locations.get(parent.id).depth + 1 : 0;
    if (destination.depth !== actualDepth || !Number.isInteger(destination.index) || destination.index < 0 || destination.index > target.length)
        throw new StudioError('行の移動先を確認してください。');
    let index = destination.index;
    if (target === source.list && index > source.index)
        index--;
    source.list.splice(source.index, 1);
    target.splice(index, 0, source.node);
    return validateBuilder(next);
}
export function dropDestination(model, sourceId, targetId, edge, requestedDepth) {
    const locations = rowLocations(model), source = locations.get(sourceId), target = locations.get(targetId);
    if (!source?.list || source.branchOwner || !target || descendants(source.node).has(targetId))
        return;
    const excluded = descendants(source.node), candidates = [];
    const add = (parent, index, depth) => {
        if (!parent || !excluded.has(parent.id))
            candidates.push({ parentId: parent?.id, index, depth });
    };
    let current = anchor(target, locations);
    if (!target.branchOwner)
        add(target.parent, target.index + (edge === 'after' ? 1 : 0), target.depth);
    if (edge === 'after' && 'body' in target.node)
        add(target.node, 0, target.depth + 1);
    if (edge === 'before' && target.list) {
        let previous = target.list[target.index - 1];
        while (previous?.kind === 'if' && previous.otherwise)
            previous = previous.otherwise;
        if (previous && 'body' in previous && !excluded.has(previous.id))
            add(previous, previous.body.length, target.depth + 1);
    }
    if (target.branchOwner) {
        // A branch header cannot have an independent sibling inserted between it and its if.
        add(current.parent, current.index + (edge === 'after' ? 1 : 0), current.depth);
        if (edge === 'before')
            add(target.branchOwner, target.branchOwner.body.length, target.depth + 1);
    }
    while (current.parent) {
        current = anchor(locations.get(current.parent.id), locations);
        add(current.parent, current.index + (edge === 'after' ? 1 : 0), current.depth);
    }
    const subtreeHeight = Math.max(...[...excluded].map(id => locations.get(id).depth - source.depth));
    const possible = candidates.filter(candidate => candidate.depth + subtreeHeight <= LIMITS.depth);
    possible.sort((a, b) => Math.abs(a.depth - requestedDepth) - Math.abs(b.depth - requestedDepth));
    return possible[0];
}
