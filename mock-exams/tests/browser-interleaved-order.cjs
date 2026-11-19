// Semantic regression: context markers must never move answers/choices below
// their explanations. Includes retained editions and every catalog entry.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const manifests = [];
function walk(folder) {
  for (const entry of fs.readdirSync(folder, {withFileTypes:true})) {
    const file = path.join(folder,entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name === 'exam.json') manifests.push(file);
  }
}
walk(path.join(root,'mock-exams/exams'));
const fixtures = manifests.map(file => {
  const exam = JSON.parse(fs.readFileSync(file));
  return {exam, sources:Object.fromEntries(exam.sections.map(s => [s.id,fs.readFileSync(path.join(path.dirname(file),s.screenProblem),'utf8')]))};
});
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
 if (!file.startsWith(root+path.sep)) return res.writeHead(403).end();
 try {res.setHeader('Content-Type',file.endsWith('.mjs')?'text/javascript':'text/html; charset=utf-8');res.end(fs.readFileSync(file));}
 catch {res.writeHead(404).end();}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try {
  const page=await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/mock-exams/index.html`);
  const results=await page.evaluate(async fixtures=>{
   const {interleavedProblemHTML}=await import('./ui/interleaved-reading.mjs');
   return fixtures.flatMap(({exam,sources})=>exam.sections.map(s=>{
    const original=new DOMParser().parseFromString(sources[s.id],'text/html');
    original.querySelectorAll('header,footer,.book-source,.pagehead,.page-head,.page-foot,.page-footer,.footer,.running,.pagenum,.page-number,.version').forEach(e=>e.remove());
    const expected=[...original.querySelectorAll('[data-reading-units]')].map(e=>e.dataset.readingUnits);
    const d=new DOMParser().parseFromString(interleavedProblemHTML(sources[s.id],exam.scoring),'text/html');
    const chunks=[...d.querySelectorAll('.interleaved-problem')];
    const failures=[];
    chunks.forEach((chunk,i)=>{
     const ids=chunk.dataset.problemUnits.split(' '), units=exam.scoring.filter(u=>ids.includes(u.id));
     const fields=units.flatMap(u=>u.fields);
     const actual=[...chunk.querySelectorAll('[data-field]')].map(e=>e.dataset.field);
     for(const field of fields) {
      if(!actual.includes(field))failures.push(`${ids}: answer ${field} moved out of its problem`);
      const choices=[...original.querySelectorAll('[data-choice-fields]')].filter(e=>e.dataset.choiceFields.split(' ').includes(field));
      const available=chunks.slice(0,i+1).flatMap(c=>[...c.querySelectorAll('[data-choice-fields]')]).filter(e=>e.dataset.choiceFields.split(' ').includes(field));
      for(const choice of choices)if(!available.some(e=>e.dataset.choiceValue===choice.dataset.choiceValue))failures.push(`${ids}: choice ${field}/${choice.dataset.choiceValue} appears after explanation`);
     }
     const anchors=[...chunk.querySelectorAll('[data-reading-units]')].map(e=>e.dataset.readingUnits);
     if(anchors.length!==1||anchors[0]!==expected[i])failures.push(`${ids}: anchor split/duplicated`);
     if(!chunk.textContent.trim()&&!chunk.querySelector('img,svg'))failures.push(`${ids}: empty problem`);
     if(chunk.nextElementSibling?.dataset.explanationUnits!==chunk.dataset.problemUnits)failures.push(`${ids}: wrong explanation`);
    });
    const clean=s=>s.replace(/\s/g,'');
    if(clean(original.body.textContent)!==clean(chunks.map(c=>c.textContent).join('')))failures.push('Problem text changed or duplicated');
    return {exam:exam.id,version:exam.version,section:s.id,groups:chunks.length,failures};
   }));
  },fixtures);
  assert.deepEqual(results.flatMap(r=>r.failures.map(f=>`${r.exam}/${r.version}/${r.section}: ${f}`)),[]);
  console.log(`PASS: ${results.length} sections, ${results.reduce((n,r)=>n+r.groups,0)} problem→explanation groups; answers/choices before explanation, no split anchors or lost text`);
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
