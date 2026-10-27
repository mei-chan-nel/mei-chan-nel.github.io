/* Browser integration. Transport/Turnstile are simulated; server-http.mjs covers real SQL. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const server=http.createServer((req,res)=>{
 let p=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
 if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{if(fs.statSync(p).isDirectory())p=path.join(p,'index.html');res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.css':'text/css'})[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const context=await browser.newContext(),p=await context.newPage();
  const submissions=[],snapshots=new Map(),errors=[];
  let loseResponse=true,challengeCount=0;
  p.on('pageerror',e=>errors.push(e.message));
  await context.route('https://challenges.cloudflare.com/**',r=>r.fulfill({contentType:'text/javascript',body:`window.turnstile={render:(host,options)=>{setTimeout(()=>{if(host.isConnected)options.callback(crypto.randomUUID());},25);return crypto.randomUUID();},remove:()=>{}};`}));
  await context.route('https://*.supabase.co/**',async route=>{
   const req=route.request();
   if(req.url().includes('/rest/v1/rpc/get_mock_exam_stats')){
    const values=[...snapshots.values()];
    await route.fulfill({json:values.length?[{scoring_id:'q1-01',section_id:'q1',answered_count:values.length,correct_count:values.filter(v=>v.answers['q1-ア']==='0').length,points_sum:values.filter(v=>v.answers['q1-ア']==='0').length*2}]:[]});return;
   }
   if(req.method()==='GET'){await route.fulfill({json:{protocol:2,ready:true,turnstileSiteKey:'browser-test',verificationEnabled:false}});return;}
   if(req.method()==='OPTIONS'){await route.fulfill({status:204});return;}
   const body=req.postDataJSON();submissions.push(body);challengeCount++;
   assert.equal(body.kind,'attempt-grade');assert.equal(body.points,undefined);assert.equal(body.results,undefined);
   const previous=snapshots.get(body.attemptId);
   const duplicate=previous?.revision===body.revision;
   snapshots.set(body.attemptId,body);
   if(loseResponse){loseResponse=false;await route.abort('failed');return;}
   await route.fulfill({json:{status:duplicate?'duplicate':'recorded',revision:body.revision}});
  });
  const url='http://127.0.0.1:'+server.address().port+'/mock-exams/';
  await p.goto(url);await p.getByRole('button',{name:'時間制限なしで解く',exact:true}).click();
  const f=p.frameLocator('iframe');
  await f.locator('[data-field="q1-ア"]').first().click();await p.locator('#answer-options>button').nth(0).click();
  await p.getByRole('button',{name:'採点する',exact:true}).click();
  await p.getByRole('button',{name:'再送する',exact:true}).waitFor();
  assert.equal(submissions.length,1);
  const local=()=>p.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('study-atlas:mock-exams:v1:attempt:')&&!k.endsWith(':backup')).map(k=>JSON.parse(localStorage[k])));
  assert.equal((await local())[0].pendingSubmission.revision,1);
  await p.getByRole('button',{name:'再送する',exact:true}).click();await p.getByText('統計送信済み',{exact:true}).waitFor();
  assert.equal(submissions.length,2);assert.equal(submissions[0].attemptId,submissions[1].attemptId);
  assert.equal(submissions[0].revision,submissions[1].revision);assert.deepEqual(submissions[0].answers,submissions[1].answers);
  assert.notEqual(submissions[0].challengeToken,submissions[1].challengeToken);
  assert.equal((await local())[0].pendingSubmission,undefined);
  await p.locator('#stat-q1-01').filter({hasText:'1 / 100.0% / 100.0%'}).waitFor();
  await p.getByRole('button',{name:'続きから解く',exact:true}).click();await p.getByRole('button',{name:'正誤表示なし',exact:true}).click();
  await f.locator('[data-field="q1-ア"]').first().click();await p.locator('#answer-options>button').nth(1).click();
  await p.getByRole('button',{name:'採点する',exact:true}).click();await p.getByText('統計送信済み',{exact:true}).waitFor();
  await p.locator('#stat-q1-01').filter({hasText:'1 / 0.0% / 0.0%'}).waitFor();
  assert.equal(submissions.length,3);assert.equal(submissions[2].revision,2);assert.equal(snapshots.size,1);
  await p.getByRole('button',{name:'間違えたところを復習',exact:true}).click();
  await f.locator('[data-field="q1-ア"]').first().click();await p.locator('#answer-options>button').nth(0).click();
  await p.getByRole('button',{name:'復習を採点する',exact:true}).click();
  assert.equal(submissions.length,3);assert.equal((await local())[0].revision,2);
  // Opening the same results after reload must not send review answers.
  await p.goto(url+'#'+submissions[0].attemptId);await p.reload();await p.getByRole('heading',{name:'採点結果',exact:true}).waitFor();
  await p.getByText('統計送信済み',{exact:true}).waitFor();assert.equal(submissions.length,3);
  await p.getByRole('button',{name:'最初から解き直す',exact:true}).click();
  await f.locator('[data-field="q1-ア"]').first().click();await p.locator('#answer-options>button').nth(0).click();
  await p.getByRole('button',{name:'採点する',exact:true}).click();await p.getByText('統計送信済み',{exact:true}).waitFor();
  await p.locator('#stat-q1-01').filter({hasText:'2 / 50.0% / 50.0%'}).waitFor();
  assert.equal(submissions.length,4);assert.notEqual(submissions[0].attemptId,submissions[3].attemptId);assert.equal(submissions[3].revision,1);
  assert.deepEqual(errors,[]);
  console.log('PASS: browser persists outbox before send, lost ACK retry, fresh challenges, regrade replacement, refreshed stats, review excluded, repeat attempt');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
