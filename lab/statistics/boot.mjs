// Intentionally dependency-free: let the static, usable page shell paint first.
const id=document.body.dataset.statLab||document.body.dataset.statistics;
const root=document.querySelector('#experiment,#project-root');
const state=document.querySelector('#statistics-load-status');
performance.mark('statistics-shell');
const nextPaint=()=>new Promise(resolve=>{
  if(document.hidden){setTimeout(resolve,0);return;}
  requestAnimationFrame(()=>requestAnimationFrame(resolve));
});
const status=(phase,text)=>{root.dataset.loadState=phase;root.setAttribute('aria-busy',String(['shell','loading','calculating'].includes(phase)));if(state)state.textContent=text;};
document.addEventListener('statistics-data-ready',()=>status('calculating','データを集計して表示しています…'),{once:true});
// The full app replaces this early handler. One change must cause one navigation.
const picker=document.querySelector('#lab-picker');
if(picker)picker.onchange=e=>location.href=`../${e.target.value}/`;
async function start(){
  await nextPaint();performance.mark('statistics-shell-painted');status('loading','データを読み込んでいます…');
  const entry=id==='projects'?'./projects.mjs?v=20261026-final-upgrade':['graph-reading','missing-values'].includes(id)?'./foundations/app.mjs?v=20261026-final-upgrade':'./app.mjs?v=20261026-final-upgrade';
  try{
    // The generated manifest covers only static dependencies of this lab.
    // Discover them together after the shell paint, avoiding a request waterfall.
    const dependencies=JSON.parse(document.querySelector('#statistics-module-list')?.textContent||'[]');
    for(const href of dependencies){const link=document.createElement('link');link.rel='modulepreload';link.href=new URL(href,import.meta.url);document.head.append(link);}
    await import(entry);
    if(root.dataset.renderError)throw Error('Initial render failed');
    performance.mark('statistics-ready');status('ready','データの準備ができました。分析するタブを選んでください。');
    document.querySelector('[data-stat-fullscreen]')?.removeAttribute('disabled');
    const observe=new MutationObserver(()=>{
      if(!root.querySelector('svg'))return;
      performance.mark('statistics-first-graph');observe.disconnect();
    });observe.observe(root,{subtree:true,childList:true});
  }catch{
    status('error','データの読み込みを完了できません。再読み込みを試してください。');
    const button=document.createElement('button');button.type='button';button.textContent='再読み込み';button.onclick=()=>location.reload();root.append(button);
    // Do not log uploaded data or exceptions containing cell contents.
  }
}
start();
