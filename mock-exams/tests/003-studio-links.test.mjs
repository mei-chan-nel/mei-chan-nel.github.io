import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeShare } from '../../program-trace/studio/sharing.js';
import { compile, initialState, step } from '../../program-trace/studio/runtime.js';
import { decodeShare as decodeFlow } from '../../lab/flowchart/documents.mjs';
import { toProgram } from '../../lab/flowchart/conversion.mjs';

test('No.003 completed Studio links execute the counted and arranged seats', async () => {
  const html = readFileSync(new URL('../exams/003/1/screen/q3-solution.html', import.meta.url), 'utf8');
  const links = [...html.matchAll(/<a\b[^>]+data-studio-program="([^"]+)"[^>]*>/g)]
    .map(([tag,id]) => ({id,href:tag.match(/href="([^"]+)"/)[1]}));
  assert.deepEqual(links.map(l=>l.id),['q3-fig2','q3-fig4','q3-fig6']);
  for (const link of links) {
    const draft = await decodeShare(new URL(link.href,'https://example.org').hash);
    assert.equal(draft.settings.indexBase,1);
    const program=compile(draft.source);
    let state=initialState(program,1);
    while(!state.completed && !state.error && state.steps<1500) state=step(program,state,draft.settings);
    assert.equal(state.error,undefined);
    assert.equal(state.completed,true);
    assert.deepEqual(state.variables.Ninzu,[8,6,4,2]);
    if(link.id==='q3-fig4') assert.deepEqual(state.variables.Zaseki,[[1,2,3,4,1],[2,3,4,1,2],[3,1,2,3,1],[2,1,2,1,1]]);
    if(link.id==='q3-fig6') assert.deepEqual(state.variables.Zaseki,[[1,2,1,2,1],[2,1,3,1,2],[1,3,1,2,3],[4,1,2,3,4]]);
    if(link.id!=='q3-fig2') assert.deepEqual(state.variables.Nokori,[0,0,0,0]);
  }
});

test('No.003 method C flowchart uses the previous minute and records the maximum', async () => {
  const html=readFileSync(new URL('../exams/003/1/screen/q2b-solution.html',import.meta.url),'utf8');
  const tag=html.match(/<a\b[^>]+data-flowchart-program="q2b-method-c"[^>]*>/)[0];
  const flow=await decodeFlow(tag.match(/href="([^"]+)"/)[1]);
  const draft=toProgram(flow),program=compile(draft.source);
  let state=initialState(program,1);
  while(!state.completed && !state.error && state.steps<1000)state=step(program,state,draft.settings);
  assert.equal(state.error,undefined);assert.equal(state.completed,true);
  assert.equal(state.variables.W,1);assert.equal(state.variables.M,3);
  assert.deepEqual(state.output,[0,2,3,1,3,2,3,1].map((w,i)=>`${i+1}分目：待ち人数${w}人，最大${i===0?0:i===1?2:3}人`));
});
