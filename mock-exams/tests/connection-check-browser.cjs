// Checks the administrator test-page flow against a deterministic transport fixture.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'../..');
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+req.url.split('?')[0]);if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.json':'application/json','.css':'text/css'})[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const p=await browser.newPage(),snapshots=new Map(),errors=[];let sends=0;
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('https://challenges.cloudflare.com/**',r=>r.fulfill({contentType:'text/javascript',body:`window.turnstile={render:(host,o)=>{setTimeout(()=>o.callback(crypto.randomUUID()),25);return crypto.randomUUID()},remove:()=>{}}`}));
  await p.route('https://*.supabase.co/**',async route=>{
   const req=route.request();
   if(req.method()==='GET'){await route.fulfill({json:{protocol:2,ready:true,turnstileSiteKey:'test-public',verificationEnabled:true}});return;}
   const b=req.postDataJSON();
   if(req.url().includes('get_mock_exam_stats')){
    if(b.p_exam_id==='001'){await route.fulfill({json:[]});return;}
    assert.equal(b.p_exam_id,'__verify_001');
    const answered=[...snapshots.values()].filter(x=>x.verificationRun===b.p_exam_version && Object.values(x.answers).some(Boolean));
    const correct=answered.filter(x=>['1|5','5|1'].includes([x.answers['q2a-イ'],x.answers['q2a-ウ']].join('|'))).length;
    await route.fulfill({json:[{scoring_id:'q2a-02',answered_count:answered.length,correct_count:correct,points_sum:correct*3}]});return;
   }
   sends++;assert.ok(b.verificationRun);
   if(b.kind==='review'){await route.fulfill({status:400,json:{error:'not_an_exam_grade'}});return;}
   const old=snapshots.get(b.attemptId);
   if(old?.revision>b.revision){await route.fulfill({json:{status:'stale',revision:old.revision}});return;}
   if(old?.revision===b.revision){
    if(JSON.stringify(old.answers)!==JSON.stringify(b.answers)){await route.fulfill({status:409,json:{status:'conflict'}});return;}
    await route.fulfill({json:{status:'duplicate',revision:b.revision}});return;
   }
   snapshots.set(b.attemptId,b);await route.fulfill({json:{status:'recorded',revision:b.revision}});
  });
  await p.goto('http://127.0.0.1:'+server.address().port+'/mock-exams/connection-check.html');
  await p.getByRole('button',{name:'実際の送受信を検証する'}).click();
  await p.getByText('送受信検証に成功しました。検証結果を保存してください。',{exact:true}).waitFor();
  assert.equal(sends,9);assert.deepEqual(errors,[]);assert.equal(await p.locator('#download-check').isDisabled(),false);
  console.log('PASS: administrator verification-page flow, isolated dataset and report download enabled');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
