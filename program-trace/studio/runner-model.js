/** Match whole-array and row references too, while respecting the index base. */
export function matchesReference(reference, name, indices) {
    return reference.name === name && reference.indices.length <= indices.length
        && reference.indices.every((index, position) => index === indices[position]);
}
/** Include every active cell, even when source and destination are far apart.
 * An omission occupies a slot, just as in the published fullscreen runner.
 * Indices supplied here are zero-based positions, not displayed indices.
 */
export function previewIndices(length, capacity, references = []) {
    if (!length)
        return [];
    const selected = new Set(references.filter(index => Number.isInteger(index) && index >= 0 && index < length));
    const slots = Math.max(3, capacity);
    const slotCount = (indices) => {
        const sorted = [...indices].sort((a, b) => a - b);
        if (!sorted.length)
            return 0;
        return sorted.length + Number(sorted[0] > 0) + Number(sorted.at(-1) < length - 1)
            + sorted.slice(1).filter((index, position) => index > sorted[position] + 1).length;
    };
    const candidates = new Set([0, length - 1, ...[...selected].flatMap(index => [index - 1, index + 1])]);
    for (let index = 0; index < Math.min(length, slots); index++) {
        candidates.add(index);
        candidates.add(length - index - 1);
    }
    const limit = Math.max(slots, slotCount(selected));
    for (const index of candidates) {
        if (index < 0 || index >= length || selected.has(index))
            continue;
        const proposed = new Set([...selected, index]);
        if (slotCount(proposed) <= limit)
            selected.add(index);
    }
    return [...selected].sort((a, b) => a - b);
}
