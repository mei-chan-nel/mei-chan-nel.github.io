import assert from 'node:assert/strict';
import { compile, initialState, step } from '../../../program-trace/studio/runtime.js';
import { rangeTests } from './range-cases.mjs';

rangeTests('Studio', source => {
  const compiled = compile(source), settings = { indexBase: 0, inputs: {} }, trace = [];
  let state = initialState(compiled, 12345);
  while (!state.completed) {
    assert.ok(trace.length < 1000, 'range must terminate independently of counter assignments');
    const kind = compiled.instructions[state.pc].kind, before = JSON.stringify(state);
    const next = step(compiled, state, settings);
    assert.equal(JSON.stringify(state), before, 'previous state must be immutable for backwards stepping');
    state = next; trace.push({ ...state, kind });
  }
  return { state, trace, output: state.output };
});
