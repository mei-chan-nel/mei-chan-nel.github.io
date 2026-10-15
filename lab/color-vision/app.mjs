import {drawLesson, STEPS, REGIONS, COLORS} from './lesson.mjs';
import {contrast, simulatePixels} from './simulation.mjs';

const $ = (id) => document.getElementById(id);
const types = [['normal','通常','ORIGINAL'],['p','P型','PROTANOPIA'],['d','D型','DEUTERANOPIA'],['t','T型','TRITANOPIA']];
let mode = 'learn', step = 0, zoom = 1, center = {x:.5,y:.5};
let renderId = 0, uploadId = 0, uploadSet = null, uploadDescription = '', displayed = null;
const cache = new Map();
const grid = $('comparison-grid');
const status = (message) => { $('status-message').textContent = message; };
const error = (message='') => { $('error-message').hidden=!message; $('error-message').textContent=message; };
const reset = () => { zoom=1;center={x:.5,y:.5};$('focus-region').value='all';syncPositions(); };
let worker, jobId = 0;
const jobs = new Map();
try {
  worker = new Worker(new URL('./worker.mjs', import.meta.url), {type:'module'});
  worker.onmessage = ({data}) => {
    const job = jobs.get(data.id); if(!job) return;
    jobs.delete(data.id);
    if(data.error) job.reject(new Error(data.error)); else job.resolve(data.results);
  };
  worker.onerror = () => {
    for(const job of jobs.values()) job.reject(new Error('画像処理を起動できませんでした。ページを再読み込みしてください。'));
    jobs.clear();worker.terminate();worker=null;
  };
} catch { worker=null; }
async function transform(pixels) {
  if(worker) return new Promise((resolve,reject)=>{
    const id=++jobId;jobs.set(id,{resolve,reject});worker.postMessage({id,pixels},[pixels.buffer]);
  });
  const results=[];
  for(const type of ['p','d','t']) {
    await new Promise((resolve)=>setTimeout(resolve,0));
    results.push({type,pixels:simulatePixels(pixels,type)});
  }
  return results;
}
async function makeSet(source) {
  const {width,height}=source;
  const data=source.getContext('2d',{colorSpace:'srgb',willReadFrequently:true}).getImageData(0,0,width,height);
  const result={normal:source};
  for(const {type,pixels} of await transform(data.data)) {
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    canvas.getContext('2d',{colorSpace:'srgb'}).putImageData(new ImageData(pixels,width,height),0,0);
    result[type]=canvas;
  }
  return result;
}
async function lessonSet(index) {
  if(!cache.has(index)) {
    const pending=makeSet(drawLesson(index));cache.set(index,pending);
    pending.catch(()=>cache.delete(index));
  }
  const value=await cache.get(index);
  // Keep adjacent states; release distant raster images on small devices.
  if(cache.size>3)for(const key of cache.keys())if(Math.abs(key-step)>1)cache.delete(key);
  return value;
}

for(const [id,region] of Object.entries(REGIONS)){
  const option=document.createElement('option');option.value=id;option.textContent=region.label;$('focus-region').append(option);
}
STEPS.forEach((item,index)=>{
  const button=document.createElement('button');button.type='button';button.className='step-button';
  const number=document.createElement('span');number.className='step-index';number.textContent=index;
  const label=document.createElement('span');label.textContent=item.short;button.append(number,label);
  button.setAttribute('aria-label',`ステップ${index}：${item.title}`);
  button.addEventListener('click',()=>setStep(index));$('step-buttons').append(button);
});
function updateNotes(){
  const item=STEPS[step];
  $('step-number').textContent=`STEP ${String(step).padStart(2,'0')} / 04`;
  $('step-title').textContent=item.title;$('step-question').textContent=item.question;
  for(const field of ['change','benefit','remaining','sideEffect'])$('step-'+field.replace(/[A-Z]/g,(c)=>'-'+c.toLowerCase())).textContent=item[field];
  $('step-tip').textContent=item.tip;
  $('change-links').replaceChildren();
  item.regions.forEach((key,index)=>{
    const button=document.createElement('button');button.textContent=`${index+1} ${REGIONS[key].label}`;
    button.addEventListener('click',()=>{$('focus-region').value=key;focusRegion(key);});$('change-links').append(button);
  });
  [...$('step-buttons').children].forEach((button,index)=>{
    if(index===step)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
  });
  $('previous-step').disabled=step===0;$('next-step').disabled=step===4;
  $('contrast-evidence').hidden=step!==1&&step!==2;
  if(step===1||step===2){
    const before=step===1?contrast('#ffffff','#567658'):contrast('#ffffff',COLORS.orange);
    const after=step===1?contrast('#ffffff',COLORS.orange):contrast(COLORS.ink,'#fff3d6');
    $('contrast-evidence').replaceChildren();
    const title=document.createElement('strong');title.textContent='飲食パネル：文字と背景の比率';
    const body=document.createElement('span');body.textContent=`改善前 ${before.toFixed(2)} : 1 → 改善後 ${after.toFixed(2)} : 1`;
    const small=document.createElement('small');small.textContent='元のsRGB値から計算。通常の文字は4.5 : 1以上がWCAG AAの目安（大きな文字は3 : 1）。';
    $('contrast-evidence').append(title,body,small);
  }
}
function setStep(index){
  if(index===step||index<0||index>=STEPS.length)return;
  step=index;updateNotes();error();render();
}
$('previous-step').addEventListener('click',()=>setStep(step-1));
$('next-step').addEventListener('click',()=>setStep(step+1));
function setMode(next){
  if(next===mode)return;mode=next;error();reset();
  const learning=mode==='learn';
  for(const [id,active] of [['learn-tab',learning],['upload-tab',!learning]]){
    $(id).setAttribute('aria-selected',String(active));$(id).tabIndex=active?0:-1;
  }
  $('learning-panel').hidden=!learning;$('lesson-notes').hidden=!learning;
  $('upload-panel').hidden=learning;$('upload-notes').hidden=learning;
  $('show-changes').closest('label').hidden=!learning;$('focus-region').disabled=!learning;
  render();
}
$('learn-tab').addEventListener('click',()=>setMode('learn'));
$('upload-tab').addEventListener('click',()=>setMode('upload'));
document.querySelector('.mode-bar').addEventListener('keydown',(e)=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  e.preventDefault();const next=e.key==='Home'?'learn':e.key==='End'?'upload':mode==='learn'?'upload':'learn';
  setMode(next);$(next==='learn'?'learn-tab':'upload-tab').focus();
});
async function render(){
  const id=++renderId;grid.setAttribute('aria-busy','true');
  const currentMode=mode,currentStep=step;
  if(mode==='upload'&&!uploadSet){
    grid.replaceChildren();grid.hidden=true;$('empty-state').hidden=false;displayed=null;
    grid.setAttribute('aria-busy','false');status('画像はブラウザ内で処理され、保存先にも自動送信されません。');return;
  }
  $('empty-state').hidden=true;grid.hidden=false;status('見え方を計算しています…');
  try{
    let before,after;
    if(currentMode==='learn'){
      before=await lessonSet(Math.max(0,currentStep-1));after=currentStep===0?before:await lessonSet(currentStep);
    }else{before=uploadSet;}
    if(id!==renderId)return;
    displayed={before,after};grid.replaceChildren();
    types.forEach(([type,label,english])=>{
      const column=document.createElement('section');column.className='view-column';column.dataset.type=type;
      const heading=document.createElement('h3');heading.className='view-heading';heading.append(document.createTextNode(label));
      const small=document.createElement('small');small.textContent=english;heading.append(small);column.append(heading);
      const rows=mode==='learn'?[['before',before,Math.max(0,currentStep-1)],['after',after,currentStep]]:[['current',before,0]];
      for(const [row,set,version] of rows){
        const figure=document.createElement('figure');figure.className=row;
        const caption=document.createElement('figcaption');const strong=document.createElement('strong');
        strong.textContent=mode==='upload'?'現状':row==='before'?'改善前':'改善後';
        const captionText=document.createElement('span');captionText.textContent=mode==='upload'?'元画像を確認':`v${version} · ${STEPS[version].short}`;
        caption.append(strong,captionText);
        const viewport=document.createElement('div');viewport.className='viewport';viewport.tabIndex=0;viewport.dataset.row=row;
        viewport.setAttribute('role','img');viewport.setAttribute('aria-label',`${label}・${strong.textContent}。${mode==='learn'?STEPS[version].version:'自分の画像'}。矢印キーで移動、プラスとマイナスで拡大縮小、0で全体表示。`);
        const canvas=document.createElement('canvas');canvas.width=set[type].width;canvas.height=set[type].height;canvas.setAttribute('aria-hidden','true');
        canvas.getContext('2d',{colorSpace:'srgb'}).drawImage(set[type],0,0);viewport.append(canvas);bindViewport(viewport);
        figure.append(caption,viewport);column.append(figure);
      }
      grid.append(column);
    });
    drawOutlines();syncPositions();grid.setAttribute('aria-busy','false');
    status(mode==='learn'?step===0?'上下は同じ初期状態。色だけで伝えている情報を探してみよう。':`v${Math.max(0,step-1)} → v${step}。上が直前の状態、下が今回の改善後。破線の枠は確認する箇所です。`:uploadDescription);
  }catch(e){
    if(id!==renderId)return;grid.setAttribute('aria-busy','false');error(e.message);status('処理を完了できませんでした。');
  }
}
function drawOutlines(){
  grid.querySelectorAll('.change-outline').forEach((el)=>el.remove());
  if(mode!=='learn'||!$('show-changes').checked)return;
  const focused=$('focus-region').value;
  const keys=focused==='all'?STEPS[step].regions:[focused];
  grid.querySelectorAll('.viewport').forEach((viewport)=>{
    keys.forEach((key,i)=>{
      const outline=document.createElement('div');outline.className='change-outline';outline.dataset.region=key;outline.setAttribute('aria-hidden','true');
      const badge=document.createElement('span');badge.textContent=focused==='all'?String(i+1):`${i+1} ${REGIONS[key].label}`;outline.append(badge);viewport.append(outline);
    });
  });
}
function syncPositions(){
  $('zoom').value=String(Math.round(zoom*100));$('zoom-value').value=`${Math.round(zoom*100)}%`;
  $('zoom-out').disabled=zoom<=1;$('zoom-in').disabled=zoom>=6;
  grid.querySelectorAll('.viewport').forEach((viewport)=>{
    const canvas=viewport.querySelector('canvas'),w=viewport.clientWidth,h=viewport.clientHeight;if(!w||!h)return;
    const fit=Math.min(w/canvas.width,h/canvas.height),scale=fit*zoom;
    const dw=canvas.width*scale,dh=canvas.height*scale;
    const cx=dw<=w?.5:Math.max(w/2/dw,Math.min(1-w/2/dw,center.x));
    const cy=dh<=h?.5:Math.max(h/2/dh,Math.min(1-h/2/dh,center.y));
    const left=w/2-cx*dw,top=h/2-cy*dh;
    Object.assign(canvas.style,{width:`${dw}px`,height:`${dh}px`,left:`${left}px`,top:`${top}px`});
    viewport.querySelectorAll('.change-outline').forEach((outline)=>{
      const [x,y,rw,rh]=REGIONS[outline.dataset.region].box;
      Object.assign(outline.style,{left:`${left+x*scale}px`,top:`${top+y*scale}px`,width:`${rw*scale}px`,height:`${rh*scale}px`});
    });
  });
}
function changeZoom(value){zoom=Math.max(1,Math.min(6,value));syncPositions();}
function focusRegion(key){
  if(key==='all'){reset();drawOutlines();return;}
  if(!displayed)return;
  const viewport=[...grid.querySelectorAll('.viewport')].find((v)=>v.clientWidth>0);if(!viewport)return;
  const source=displayed.before.normal,[x,y,w,h]=REGIONS[key].box;
  center={x:(x+w/2)/source.width,y:(y+h/2)/source.height};
  const fit=Math.min(viewport.clientWidth/source.width,viewport.clientHeight/source.height);
  zoom=Math.max(1,Math.min(6,Math.min(viewport.clientWidth/(w+35),viewport.clientHeight/(h+45))/fit));
  drawOutlines();syncPositions();
}
function bindViewport(viewport){
  const pointers=new Map();let last=null,pinch=null;
  viewport.addEventListener('pointerdown',(e)=>{
    if(e.button!==0)return;viewport.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});last={x:e.clientX,y:e.clientY};
    if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom};}
  });
  viewport.addEventListener('pointermove',(e)=>{
    if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2&&pinch){const [a,b]=[...pointers.values()];changeZoom(pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance));return;}
    if(!last)return;const canvas=viewport.querySelector('canvas');const dw=parseFloat(canvas.style.width),dh=parseFloat(canvas.style.height);
    // Clamp the shared center before applying deltas to avoid a dead zone at edges.
    const halfX=Math.min(.5,viewport.clientWidth/(2*dw)),halfY=Math.min(.5,viewport.clientHeight/(2*dh));
    center.x=Math.max(halfX,Math.min(1-halfX,center.x))-(e.clientX-last.x)/dw;
    center.y=Math.max(halfY,Math.min(1-halfY,center.y))-(e.clientY-last.y)/dh;
    center.x=Math.max(halfX,Math.min(1-halfX,center.x));center.y=Math.max(halfY,Math.min(1-halfY,center.y));
    last={x:e.clientX,y:e.clientY};syncPositions();
  });
  const release=(e)=>{pointers.delete(e.pointerId);pinch=null;last=pointers.size?[...pointers.values()][0]:null;};
  viewport.addEventListener('pointerup',release);viewport.addEventListener('pointercancel',release);viewport.addEventListener('lostpointercapture',release);
  viewport.addEventListener('wheel',(e)=>{if(e.ctrlKey||e.metaKey){e.preventDefault();changeZoom(zoom*(e.deltaY<0?1.1:1/1.1));}},{passive:false});
  viewport.addEventListener('keydown',(e)=>{
    if(['+','=','-','0'].includes(e.key)){e.preventDefault();e.key==='0'?reset():changeZoom(zoom+(e.key==='-'?-.25:.25));return;}
    const directions={ArrowLeft:[-.08,0],ArrowRight:[.08,0],ArrowUp:[0,-.08],ArrowDown:[0,.08]};
    if(directions[e.key]){e.preventDefault();center.x=Math.max(0,Math.min(1,center.x+directions[e.key][0]/zoom));center.y=Math.max(0,Math.min(1,center.y+directions[e.key][1]/zoom));syncPositions();}
  });
}
$('zoom').addEventListener('input',(e)=>changeZoom(Number(e.target.value)/100));
$('zoom-in').addEventListener('click',()=>changeZoom(zoom+.25));$('zoom-out').addEventListener('click',()=>changeZoom(zoom-.25));
$('reset-view').addEventListener('click',()=>{reset();drawOutlines();});
$('show-changes').addEventListener('change',()=>{drawOutlines();syncPositions();});
$('focus-region').addEventListener('change',(e)=>focusRegion(e.target.value));
new ResizeObserver(syncPositions).observe(grid);

async function readImage(file){
  const id=++uploadId;error();$('save-image').disabled=!uploadSet;
  if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)){error('PNG・JPEG・WebP形式の画像を選んでください。');return;}
  if(file.size>20*1024*1024){error('20 MB以下の画像を選んでください。');return;}
  status('画像をブラウザ内で読み込んでいます…');$('save-image').disabled=true;
  const url=URL.createObjectURL(file);
  try{
    const image=new Image();image.src=url;await image.decode();
    const w=image.naturalWidth,h=image.naturalHeight;
    if(!w||!h||w*h>40_000_000)throw new Error('4,000万画素以下の画像を選んでください。');
    if(id!==uploadId)return;
    const ratio=Math.min(1,1600/Math.max(w,h));const source=document.createElement('canvas');
    source.width=Math.max(1,Math.round(w*ratio));source.height=Math.max(1,Math.round(h*ratio));
    const ctx=source.getContext('2d',{colorSpace:'srgb',willReadFrequently:true});ctx.fillStyle='#ffffff';ctx.fillRect(0,0,source.width,source.height);ctx.imageSmoothingQuality='high';ctx.drawImage(image,0,0,source.width,source.height);
    status('P・D・T型をブラウザ内で計算しています…');const set=await makeSet(source);if(id!==uploadId)return;
    uploadSet=set;uploadDescription=`${file.name} · ${source.width} × ${source.height}px${ratio<1?`（元画像 ${w} × ${h}pxを縮小）`:''} · 白背景で確認`;
    $('save-image').disabled=false;$('remove-image').disabled=false;reset();if(mode==='upload')render();
  }catch(e){if(id===uploadId){error(e.message.startsWith('4,000')?e.message:'画像を読み込めませんでした。対応形式の別の画像を選んでください。');status('読込を完了できませんでした。');$('save-image').disabled=!uploadSet;}}
  finally{URL.revokeObjectURL(url);$('image-input').value='';}
}
$('image-input').addEventListener('change',(e)=>readImage(e.target.files?.[0]));
let dragDepth=0;
$('drop-zone').addEventListener('dragenter',(e)=>{e.preventDefault();dragDepth++;$('drop-zone').classList.add('is-dragging');});
$('drop-zone').addEventListener('dragover',(e)=>e.preventDefault());
$('drop-zone').addEventListener('dragleave',()=>{if(--dragDepth<=0){dragDepth=0;$('drop-zone').classList.remove('is-dragging');}});
$('drop-zone').addEventListener('drop',(e)=>{e.preventDefault();dragDepth=0;$('drop-zone').classList.remove('is-dragging');readImage(e.dataTransfer.files[0]);});
// Prevent an accidental drop elsewhere from navigating away with a local image.
window.addEventListener('dragover',(e)=>e.preventDefault());window.addEventListener('drop',(e)=>e.preventDefault());
$('remove-image').addEventListener('click',()=>{uploadId++;uploadSet=null;uploadDescription='';$('image-input').value='';$('save-image').disabled=true;$('remove-image').disabled=true;error();reset();render();});
$('save-image').addEventListener('click',async()=>{
  if(!uploadSet)return;const selected=$('save-type').value;const set=uploadSet;$('save-image').disabled=true;error();
  try{
    const chosen=selected==='all'?types:types.filter(([type])=>type===selected);
    const source=set.normal,padding=20,header=74,footer=35;
    const canvas=document.createElement('canvas');canvas.width=(source.width+padding)*chosen.length+padding;canvas.height=source.height+header+footer;
    const ctx=canvas.getContext('2d',{colorSpace:'srgb'});ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
    chosen.forEach(([type,label],i)=>{const x=padding+i*(source.width+padding);ctx.fillStyle='#203b40';ctx.font='bold 20px sans-serif';ctx.fillText(label,x,30);ctx.font='12px sans-serif';ctx.fillText(type==='normal'?'元画像 / 白背景':'Brettel et al. (1997) / 2色覚の近似',x,51,source.width);ctx.drawImage(set[type],x,header);});
    ctx.font='12px sans-serif';ctx.fillStyle='#203b40';ctx.fillText('見え方の近似です。個人差・画面環境は再現しません。Study Atlas Interactive Lab',padding,canvas.height-12);
    const blob=await new Promise((resolve)=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error();
    const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=`color-vision-${selected}.png`;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status('画像全体のPNGを作成しました。端末のダウンロード先をご確認ください。');
  }catch{error('画像を保存できませんでした。より小さい画像でお試しください。');}
  finally{$('save-image').disabled=!uploadSet;}
});
const dialog=$('method-dialog');
for(const id of ['open-method','note-method'])$(id).addEventListener('click',()=>dialog.showModal());
$('close-method').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',(e)=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
updateNotes();render();
