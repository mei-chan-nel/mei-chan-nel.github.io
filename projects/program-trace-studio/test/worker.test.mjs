import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultInput } from '../../../program-trace/studio/documents.js';
let handler, responses = [];
globalThis.self = { addEventListener(name, callback) { if (name === 'message') handler = callback; }, postMessage(value) { responses.push(structuredClone(value)); } };
await import('../../../program-trace/studio/worker.js');
const send = message => { const count = responses.length; handler({ data: message }); return responses[count]; };
const document = source => ({ version: 1, title: 'test', source, settings: { indexBase: 0, inputs: { age: { ...defaultInput(), min: 0, max: 120 } } } });
test('worker external input suspends without executing, enforces validation, then runs a single line', () => {
  const ready = send({ generation: 1, action: 'prepare', draft: document('age = 【外部からの入力】\n表示する(age)') });
  assert.equal(ready.kind, 'ready'); assert.equal(ready.state.currentLine, null); assert.equal(ready.state.steps, 0);
  const request = send({ generation: 1, action: 'step' }); assert.equal(request.request.name, 'age'); assert.equal(request.state.steps, 0); assert.equal(request.state.variables.age, undefined);
  const invalid = send({ generation: 1, action: 'step', input: 121 }); assert.equal(invalid.kind, 'error'); assert.equal(invalid.error.line, 1); assert.equal(invalid.state.steps, 0);
  const accepted = send({ generation: 1, action: 'step', input: 18 }); assert.equal(accepted.state.currentLine, 1); assert.equal(accepted.state.variables.age, 18); assert.equal(accepted.state.steps, 1);
  const printed = send({ generation: 1, action: 'step' }); assert.deepEqual(printed.outputAppend, ['18']); assert.equal(printed.state.completed, true);
  const dismissed = send({ generation: 1, action: 'step' }); assert.equal(dismissed.state.currentLine, null); assert.deepEqual(dismissed.outputAppend, []);
  assert.equal(send({ generation: 0, action: 'reset' }), undefined);
  const reset = send({ generation: 1, action: 'reset' }); assert.equal(reset.state.steps, 0); assert.deepEqual(reset.state.variables, {});
});
test('worker rejects input on noninput lines, and prepare replaces invalid or old state', () => {
  send({ generation: 2, action: 'prepare', draft: document('x = 1\ny = x / 0') });
  assert.equal(send({ generation: 2, action: 'step', input: 5 }).kind, 'error');
  assert.equal(send({ generation: 2, action: 'step' }).state.variables.x, 1);
  const error = send({ generation: 2, action: 'step' }); assert.equal(error.error.line, 2); assert.equal(error.state.steps, 1); assert.equal(error.state.variables.y, undefined);
  assert.equal(send({ generation: 3, action: 'prepare', draft: document('alert(1)') }).kind, 'error');
  const recovered = send({ generation: 4, action: 'prepare', draft: document('表示する("recovered")') }); assert.equal(recovered.kind, 'ready');
  assert.deepEqual(send({ generation: 4, action: 'step' }).outputAppend, ['recovered']);
});
