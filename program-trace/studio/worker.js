import { compile, initialState, step, finish } from './runtime.js?v=20261009-functions';
import { defaultInput, validateDraft, validateInput } from './documents.js?v=20261009-functions';
import { diagnostic, StudioError } from './errors.js';
let compiled, state, draft;
let generation = -1, seed = 1;
let history = [];
function response(kind, resetOutput = false) {
    const result = { generation, kind, canGoBack: history.length > 0 };
    if (state)
        result.state = { ...state, output: [] };
    if (resetOutput)
        result.outputAppend = [];
    return result;
}
const scope = self;
scope.addEventListener('message', (event) => {
    const message = event.data;
    if (!message || !Number.isSafeInteger(message.generation))
        return;
    if (message.action !== 'prepare' && message.generation !== generation)
        return;
    if (message.action === 'prepare')
        generation = message.generation;
    let outputCount = state?.output.length ?? 0;
    try {
        if (message.action === 'prepare') {
            compiled = undefined;
            state = undefined;
            history = [];
            draft = validateDraft(message.draft);
            compiled = compile(draft.source);
            seed = crypto.getRandomValues(new Uint32Array(1))[0];
            state = initialState(compiled, seed);
            outputCount = 0;
            const result = response('ready', true);
            result.info = { lines: compiled.lines, variableNames: compiled.variableNames, inputNames: compiled.inputNames, editable: compiled.editable };
            scope.postMessage(result);
            return;
        }
        if (!compiled || !state || !draft)
            throw new StudioError('プログラムを準備してから実行してください。');
        if (message.action === 'reset') {
            state = initialState(compiled, seed);
            history = [];
            scope.postMessage(response('ready', true));
            return;
        }
        if (message.action === 'previous') {
            state = history.pop() ?? state;
            scope.postMessage({ ...response('state'), outputReset: true, outputAppend: state.output });
            return;
        }
        if (message.action !== 'step')
            throw new StudioError('操作を読み取れませんでした。');
        const instruction = state.pc === null ? undefined : compiled.instructions[state.pc];
        if (instruction?.kind === 'input') {
            const spec = draft.settings.inputs[instruction.name] ?? defaultInput();
            if (message.input === undefined) {
                scope.postMessage({ ...response('state'), request: { name: instruction.name, line: instruction.line, spec } });
                return;
            }
            try {
                validateInput(message.input, spec);
            }
            catch (error) {
                if (error instanceof StudioError)
                    error.line = instruction.line;
                throw error;
            }
        }
        else if (message.input !== undefined)
            throw new StudioError('この行では外部入力を受け付けません。', instruction?.line);
        const previous = state;
        state = state.completed ? finish(state) : step(compiled, state, draft.settings, message.input);
        if (state !== previous)
            history.push(previous);
        scope.postMessage({ ...response('state'), outputAppend: state.output.slice(outputCount) });
    }
    catch (error) {
        scope.postMessage({ ...response('error'), error: diagnostic(error) });
    }
});
