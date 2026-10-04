import { compile, initialState, step, finish } from './runtime.js';
import { defaultInput, validateDraft, validateInput } from './documents.js';
import { diagnostic, StudioError } from './errors.js';
import type { WorkerRequest, WorkerResponse, Compiled, State, Draft } from './types.js';
let compiled: Compiled | undefined, state: State | undefined, draft: Draft | undefined;
let generation = -1, seed = 1;
function response(kind: WorkerResponse['kind'], resetOutput = false): WorkerResponse {
  const result: WorkerResponse = { generation, kind };
  if (state) result.state = { ...state, output: [] };
  if (resetOutput) result.outputAppend = [];
  return result;
}
const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (!message || !Number.isSafeInteger(message.generation)) return;
  if (message.action !== 'prepare' && message.generation !== generation) return;
  if (message.action === 'prepare') generation = message.generation;
  let outputCount = state?.output.length ?? 0;
  try {
    if (message.action === 'prepare') {
      compiled = undefined; state = undefined; draft = validateDraft(message.draft);
      compiled = compile(draft.source); seed = crypto.getRandomValues(new Uint32Array(1))[0]; state = initialState(compiled, seed); outputCount = 0;
      const result = response('ready', true);
      result.info = { lines: compiled.lines, variableNames: compiled.variableNames, inputNames: compiled.inputNames, editable: compiled.editable };
      scope.postMessage(result); return;
    }
    if (!compiled || !state || !draft) throw new StudioError('プログラムを準備してから実行してください。');
    if (message.action === 'reset') { state = initialState(compiled, seed); scope.postMessage(response('ready', true)); return; }
    if (message.action !== 'step') throw new StudioError('操作を読み取れませんでした。');
    const instruction = state.pc === null ? undefined : compiled.instructions[state.pc];
    if (instruction?.kind === 'input') {
      const spec = draft.settings.inputs[instruction.name] ?? defaultInput();
      if (message.input === undefined) {
        scope.postMessage({ ...response('state'), request: { name: instruction.name, line: instruction.line, spec } }); return;
      }
      try { validateInput(message.input, spec); } catch (error) { if (error instanceof StudioError) error.line = instruction.line; throw error; }
    } else if (message.input !== undefined) throw new StudioError('この行では外部入力を受け付けません。', instruction?.line);
    state = state.completed ? finish(state) : step(compiled, state, draft.settings, message.input);
    scope.postMessage({ ...response('state'), outputAppend: state.output.slice(outputCount) });
  } catch (error) { scope.postMessage({ ...response('error'), error: diagnostic(error) }); }
});
