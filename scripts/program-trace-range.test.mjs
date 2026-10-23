import assert from 'node:assert/strict';
import { compileProgram, createState, step } from '../program-trace/interpreter.js';
import { parseProgram } from '../program-trace/source-parser.js';
import { rangeTests } from '../projects/program-trace-studio/test/range-cases.mjs';

rangeTests('Program Trace', source => {
  // The original parser uses branch markers; Studio accepts two-space indents.
  const lines = source.split('\n').map(line => '｜ '.repeat((line.match(/^ */u)[0].length) / 2) + line.trim().replace(/^(定義する .*)：$/u, '$1'));
  const compiled = compileProgram(parseProgram(lines)), trace = [];
  let state = createState(compiled, { seed: 12345 });
  while (!state.completed) {
    assert.ok(trace.length < 1000, 'range must terminate independently of counter assignments');
    const kind = compiled.instructions[state.pc].type, before = JSON.stringify(state);
    const next = step(compiled, state, {});
    assert.equal(JSON.stringify(state), before, 'previous state must be immutable for backwards stepping');
    state = next; trace.push({ ...state, kind });
  }
  return { state, trace, output: state.output.map(item => item.text) };
});
