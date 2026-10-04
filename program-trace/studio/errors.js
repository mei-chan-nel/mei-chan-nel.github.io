export class StudioError extends Error {
    line;
    column;
    constructor(message, line = 1, column = 1) {
        super(message);
        this.line = line;
        this.column = column;
        this.name = 'StudioError';
    }
}
export function diagnostic(error, line = 1) {
    return error instanceof StudioError
        ? { message: error.message, line: error.line, column: error.column }
        : { message: error instanceof Error ? error.message : '処理できませんでした。', line, column: 1 };
}
export const LIMITS = Object.freeze({ lines: 500, sourceBytes: 50_000, steps: 10_000, variables: 128,
    arrayCells: 1_000, totalCells: 5_000, string: 10_000, totalStrings: 100_000,
    outputs: 1_000, outputCharacters: 200_000, depth: 32, fileBytes: 300_000, shareBytes: 180_000, urlCharacters: 100_000 });
export function validName(name) {
    return /^[\p{L}_][\p{L}\p{N}_]*$/u.test(name) && !['__proto__', 'constructor', 'prototype'].includes(name);
}
