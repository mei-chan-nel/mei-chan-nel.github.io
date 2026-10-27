import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const text=await readFile(new URL('../server/deploy/index.ts',import.meta.url),'utf8');
const exam=JSON.parse(await readFile(new URL('../exams/001/1.0.0/exam.json',import.meta.url)));
const variables={SUPABASE_URL:'https://db.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-only',MOCK_EXAM_ALLOWED_ORIGIN:'https://mei-chan-nel.com',MOCK_EXAM_ENABLED:'true',MOCK_EXAM_TURNSTILE_SITE_KEY:'test-public',MOCK_EXAM_TURNSTILE_SECRET:'test-only'};
let handler,received;
globalThis.Deno={env:{get:name=>variables[name]},serve:fn=>handler=fn};
const savedFetch=globalThis.fetch;
globalThis.fetch=async(url,init)=>{
 if(url.includes('siteverify'))return Response.json({success:true,hostname:'mei-chan-nel.com',action:'mock-exam-submit'});
 if(url.endsWith('consume_mock_exam_budget'))return Response.json(true);
 if(url.endsWith('replace_mock_exam_results')){received=JSON.parse(init.body);return Response.json({status:'recorded',revision:1});}
 throw Error('unexpected request');
};
try{
 await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
 const payload={kind:'attempt-grade',attemptId:crypto.randomUUID(),attemptToken:'a'.repeat(64),examId:'001',examVersion:'1.0.0',revision:1,
  sectionIds:exam.sections.map(x=>x.id),answers:Object.fromEntries(exam.scoring.flatMap(u=>u.fields.map((f,i)=>[f,u.rule.patterns[0][i]]))),challengeToken:'test-token',challengeRequestId:crypto.randomUUID()};
 const response=await handler(new Request('https://edge.invalid',{method:'POST',headers:{Origin:variables.MOCK_EXAM_ALLOWED_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify(payload)}));
 assert.equal(response.status,200);assert.equal(received.p_results.length,44);assert.equal(received.p_results.reduce((sum,r)=>sum+r.points,0),100);
 assert.notEqual(received.p_token_hash,payload.attemptToken);
 console.log('PASS: generated single-file Edge bundle executes and grades all 44 units as 100/100');
}finally{globalThis.fetch=savedFetch;delete globalThis.Deno;}
