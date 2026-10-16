import {drawLesson, STEPS, IMPROVEMENTS, REGIONS, CONTRAST_EXAMPLES} from './lesson.mjs';
import {contrast, simulatePixels} from './simulation.mjs';

const $ = (id) => document.getElementById(id);
const types = [['normal','通常','ORIGINAL'],['p','P型','PROTANOPIA'],['d','D型','DEUTERANOPIA'],['t','T型','TRITANOPIA']];
let mode = 'learn', step = 0, zoom = 1, center = {x:.5,y:.5};
let renderId = 0, uploadId = 0, uploadSet = null, uploadDescription = '', displayed = null;
const cache = new Map();
let expandedView = null;
const grid = $('comparison-grid');
const card=$('comparison-card'), workspace=card.closest('.workspace'), imageDialog=$('image-dialog'), imageViewport=$('image-viewport');
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
  if(cache.size>3)for(const key of cache.keys())if(Math.abs(key-STEPS[step].state)>1)cache.delete(key);
  return value;
}

for (const [id, region] of Object.entries(REGIONS)) {
  const option = document.createElement('option');
  option.value = id; option.textContent = region.label; $('focus-region').append(option);
}
const initialButton = document.createElement('button');
initialButton.className = 'step-button initial-step'; initialButton.dataset.step = '0';
initialButton.textContent = '0 ページ全体'; initialButton.addEventListener('click', () => setStep(0));
$('step-buttons').append(initialButton);
IMPROVEMENTS.forEach((item, index) => {
  const group = document.createElement('div'); group.className = 'step-group';
  const title = document.createElement('p'); title.textContent = `${index + 1} ${item.name}`; group.append(title);
  for (const [offset, label] of [[1, '拡大して観察'], [2, '改善する'], [3, '全体を見る']]) {
    const target = index * 3 + offset;
    const button = document.createElement('button'); button.className = 'step-button'; button.type = 'button';
    button.dataset.step = String(target); button.textContent = label;
    button.setAttribute('aria-label', `${index + 1} ${item.name}：${label}`);
    button.addEventListener('click', () => setStep(target)); group.append(button);
  }
  $('step-buttons').append(group);
});
const completedButton = document.createElement('button');
completedButton.className = 'step-button final-step'; completedButton.type = 'button';
completedButton.dataset.step = String(STEPS.length - 1); completedButton.textContent = '完成品を見る';
completedButton.addEventListener('click', () => setStep(STEPS.length - 1));
$('step-buttons').append(completedButton);
function updateNotes() {
  const item = STEPS[step];
  $('step-number').textContent = item.phase === 'initial' ? `START / ${IMPROVEMENTS.length}つの改善`
    : item.phase === 'complete' ? `FINISH / ${IMPROVEMENTS.length}つの改善を反映` : `工程 ${String(item.number).padStart(2, '0')} / ${String(IMPROVEMENTS.length).padStart(2, '0')} · ${item.short}`;
  $('step-title').textContent = item.title; $('step-question').textContent = item.question;
  for (const field of ['change', 'benefit']) {
    $('step-' + field.replace(/[A-Z]/g, c => '-' + c.toLowerCase())).textContent = item[field];
  }
  $('step-tip').textContent = item.tip; $('change-links').replaceChildren();
  $('lesson-notes').scrollTop = 0;
  item.regions.forEach(key => {
    const button = document.createElement('button'); button.textContent = `${REGIONS[key].label}に注目`;
    button.addEventListener('click', () => { $('focus-region').value = key; focusRegion(key); });
    $('change-links').append(button);
  });
  $('step-buttons').querySelectorAll('[data-step]').forEach(button => {
    if (Number(button.dataset.step) === step) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  requestAnimationFrame(scrollActiveStep);
  const evidence = CONTRAST_EXAMPLES[item.evidence];
  $('contrast-evidence').hidden = !evidence;
  $('contrast-evidence').replaceChildren();
  if (evidence) {
    const before = contrast(...evidence.before), after = contrast(...evidence.after);
    const title = document.createElement('strong'); title.textContent = evidence.title;
    const body = document.createElement('span'); body.textContent = `変更前 ${before.toFixed(2)} : 1 → 現在 ${after.toFixed(2)} : 1`;
    const small = document.createElement('small'); small.textContent = evidence.kind === 'graphic'
      ? '元のsRGB値から計算。意味を伝えるグラフの線と背景は3 : 1以上がWCAG AAの目安。文字の基準とは別です。'
      : '元のsRGB値から計算。通常の文字は4.5 : 1以上がWCAG AAの目安（大きな文字は3 : 1）。';
    $('contrast-evidence').replaceChildren(title, body, small);
  }
}
function scrollActiveStep() {
  const active = $('step-buttons').querySelector('[aria-current="step"]');
  if (!active || $('learning-panel').hidden) return;
  const a=active.getBoundingClientRect(), r=$('learning-panel').getBoundingClientRect();
  if(a.bottom>r.bottom-8)$('learning-panel').scrollTop+=a.bottom-r.bottom+8;
  else if(a.top<r.top+8)$('learning-panel').scrollTop-=r.top-a.top+8;
}
function setStep(index) {
  if (index < 0 || index >= STEPS.length) return;
  if (index === step) {
    const item = STEPS[step];
    focusRegion(item.phase === 'overview' ? 'all' : item.regions[0] ?? 'all');
    return;
  }
  step = index; updateNotes(); error(); render();
}
function setMode(next) {
  if (next === mode) return;
  mode = next; clearDropState(); error(); reset(); if (imageDialog.open) imageDialog.close();
  const learning = mode === 'learn';
  for (const [id, active] of [['learn-tab', learning], ['upload-tab', !learning]]) {
    $(id).setAttribute('aria-selected', String(active)); $(id).tabIndex = active ? 0 : -1;
  }
  $('learning-panel').hidden = !learning; $('lesson-notes').hidden = !learning;
  $('upload-panel').hidden = learning; $('upload-notes').hidden = learning;
  card.classList.toggle('is-upload', !learning);
  $('show-changes').closest('label').hidden = !learning; $('focus-region').disabled = !learning;
  render();
}
$('learn-tab').addEventListener('click', () => setMode('learn'));
$('upload-tab').addEventListener('click', () => setMode('upload'));
document.querySelector('.mode-bar').addEventListener('keydown', e => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const next = e.key === 'Home' ? 'learn' : e.key === 'End' ? 'upload' : mode === 'learn' ? 'upload' : 'learn';
  setMode(next); $(next === 'learn' ? 'learn-tab' : 'upload-tab').focus();
});
async function render() {
  const id = ++renderId; grid.setAttribute('aria-busy', 'true');
  const currentMode = mode, item = STEPS[step];
  if (imageDialog.open) imageDialog.close();
  if (mode === 'upload' && !uploadSet) {
    grid.replaceChildren(); grid.hidden = true; $('empty-state').hidden = false; displayed = null;
    grid.setAttribute('aria-busy', 'false'); status('画像はブラウザ内で処理され、サーバーへ送信されません。'); return;
  }
  $('empty-state').hidden = true; grid.hidden = false; status('見え方を計算しています…');
  try {
    const current = currentMode === 'learn' ? await lessonSet(item.state) : uploadSet;
    if (id !== renderId) return;
    displayed = {current}; grid.replaceChildren();
    grid.dataset.state = String(item.state); grid.dataset.phase = item.phase;
    types.forEach(([type, label, english]) => {
      const column = document.createElement('section'); column.className = 'view-column'; column.dataset.type = type;
      const heading = document.createElement('h3'); heading.className = 'view-heading'; heading.textContent = label;
      const small = document.createElement('small'); small.textContent = english; heading.append(small);
      column.append(heading);
      const figure = document.createElement('figure');
      const viewport = document.createElement('div'); viewport.className = 'viewport'; viewport.tabIndex = 0;
      viewport.setAttribute('role', 'button'); viewport.setAttribute('aria-haspopup', 'dialog');
      viewport.setAttribute('aria-label', `${label}・${mode === 'learn' ? item.version : '自分の画像'}。クリックかEnterで拡大。矢印キーで移動、プラスとマイナスで拡大縮小できます。`);
      const canvas = document.createElement('canvas'); canvas.width = current[type].width; canvas.height = current[type].height;
      canvas.setAttribute('aria-hidden', 'true'); canvas.getContext('2d', {colorSpace:'srgb'}).drawImage(current[type], 0, 0);
      viewport.append(canvas); bindViewport(viewport, type); figure.append(viewport); column.append(figure); grid.append(column);
    });
    if (currentMode === 'learn') focusRegion(item.phase === 'overview' ? 'all' : item.regions[0] ?? 'all'); else syncPositions();
    grid.setAttribute('aria-busy', 'false');
    status(currentMode === 'upload' ? uploadDescription : '');
  } catch (e) {
    if (id !== renderId) return; grid.setAttribute('aria-busy', 'false'); error(e.message); status('処理を完了できませんでした。');
  }
}
function allViewports() { return [...grid.querySelectorAll('.viewport'), ...(imageDialog.open ? [imageViewport] : [])]; }
function drawOutlines() {
  document.querySelectorAll('.change-outline').forEach(el => el.remove());
  if (mode !== 'learn' || !$('show-changes').checked) return;
  const keys = STEPS[step].regions;
  allViewports().forEach(viewport => {
    keys.forEach(key => {
      const outline = document.createElement('div'); outline.className = 'change-outline'; outline.dataset.region = key;
      outline.setAttribute('aria-hidden', 'true'); const badge = document.createElement('span');
      badge.textContent = `${STEPS[step].phase === 'observe' ? '注目' : '変更'}：${REGIONS[key].label}`;
      outline.append(badge); viewport.append(outline);
    });
  });
}
function syncPositions() {
  $('zoom').value = String(Math.round(zoom * 100)); $('zoom-value').value = `${Math.round(zoom * 100)}%`;
  $('image-zoom-value').value = `${Math.round(zoom * 100)}%`;
  for (const id of ['zoom-out', 'image-zoom-out']) $(id).disabled = zoom <= 1;
  for (const id of ['zoom-in', 'image-zoom-in']) $(id).disabled = zoom >= 6;
  allViewports().forEach(viewport => {
    const canvas = viewport.querySelector('canvas'), w = viewport.clientWidth, h = viewport.clientHeight;
    if (!canvas || !w || !h) return;
    const scale = Math.min(w / canvas.width, h / canvas.height) * zoom;
    const dw = canvas.width * scale, dh = canvas.height * scale;
    const cx = dw <= w ? .5 : Math.max(w / 2 / dw, Math.min(1 - w / 2 / dw, center.x));
    const cy = dh <= h ? .5 : Math.max(h / 2 / dh, Math.min(1 - h / 2 / dh, center.y));
    const left = w / 2 - cx * dw, top = h / 2 - cy * dh;
    Object.assign(canvas.style, {width:`${dw}px`, height:`${dh}px`, left:`${left}px`, top:`${top}px`});
    viewport.querySelectorAll('.change-outline').forEach(outline => {
      const [x, y, rw, rh] = REGIONS[outline.dataset.region].box;
      Object.assign(outline.style, {left:`${left + x * scale}px`, top:`${top + y * scale}px`, width:`${rw * scale}px`, height:`${rh * scale}px`});
    });
  });
}
function changeZoom(value) { zoom = Math.max(1, Math.min(6, value)); syncPositions(); }
function focusRegion(key) {
  $('focus-region').value = key;
  if (key === 'all') { reset(); drawOutlines(); syncPositions(); return; }
  if (!displayed) return;
  const viewport = grid.querySelector('.viewport'); if (!viewport) return;
  const source = displayed.current.normal, [x, y, w, h] = REGIONS[key].box;
  center = {x:(x + w / 2) / source.width, y:(y + h / 2) / source.height};
  const fit = Math.min(viewport.clientWidth / source.width, viewport.clientHeight / source.height);
  zoom = Math.max(1, Math.min(6, Math.min(viewport.clientWidth / (w + 40), viewport.clientHeight / (h + 50)) / fit));
  drawOutlines(); syncPositions();
}
function bindViewport(viewport, expandType) {
  const pointers = new Map(); let last = null, pinch = null, start = null, moved = false;
  viewport.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    viewport.setPointerCapture(e.pointerId); pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if (pointers.size === 1) { start = {x:e.clientX, y:e.clientY}; moved = false; }
    last = {x:e.clientX, y:e.clientY};
    if (pointers.size === 2) { const [a,b] = [...pointers.values()]; pinch = {distance:Math.hypot(a.x-b.x,a.y-b.y), zoom}; moved = true; }
  });
  viewport.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if (start && Math.hypot(e.clientX-start.x,e.clientY-start.y) > 5) moved = true;
    if (pointers.size === 2 && pinch) { const [a,b] = [...pointers.values()]; changeZoom(pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance)); return; }
    if (!last || !moved) return;
    const canvas = viewport.querySelector('canvas'); if (!canvas) return;
    const dw = parseFloat(canvas.style.width), dh = parseFloat(canvas.style.height);
    const halfX = Math.min(.5,viewport.clientWidth/(2*dw)), halfY = Math.min(.5,viewport.clientHeight/(2*dh));
    center.x = Math.max(halfX,Math.min(1-halfX,center.x))-(e.clientX-last.x)/dw;
    center.y = Math.max(halfY,Math.min(1-halfY,center.y))-(e.clientY-last.y)/dh;
    center.x = Math.max(halfX,Math.min(1-halfX,center.x)); center.y = Math.max(halfY,Math.min(1-halfY,center.y));
    last = {x:e.clientX,y:e.clientY}; syncPositions();
  });
  const release = e => { pointers.delete(e.pointerId); pinch = null; last = pointers.size ? [...pointers.values()][0] : null; };
  viewport.addEventListener('pointerup', release); viewport.addEventListener('pointercancel', e => { moved = true; release(e); });
  viewport.addEventListener('lostpointercapture', release);
  if (expandType) viewport.addEventListener('click', () => { if (!moved) openExpanded(expandType); moved = false; });
  viewport.addEventListener('wheel', e => { if(e.ctrlKey || e.metaKey) { e.preventDefault(); changeZoom(zoom*(e.deltaY<0?1.1:1/1.1)); } }, {passive:false});
  viewport.addEventListener('keydown', e => {
    if (expandType && ['Enter',' '].includes(e.key)) { e.preventDefault(); openExpanded(expandType); return; }
    if (['+','=','-','0'].includes(e.key)) { e.preventDefault(); e.key === '0' ? reset() : changeZoom(zoom+(e.key==='-'?-.25:.25)); return; }
    const directions = {ArrowLeft:[-.08,0],ArrowRight:[.08,0],ArrowUp:[0,-.08],ArrowDown:[0,.08]};
    if (directions[e.key]) { e.preventDefault(); center.x=Math.max(0,Math.min(1,center.x+directions[e.key][0]/zoom)); center.y=Math.max(0,Math.min(1,center.y+directions[e.key][1]/zoom)); syncPositions(); }
  });
}
function openExpanded(type) {
  if (!displayed) return;
  expandedView = {zoom, center:{...center}, focus:$('focus-region').value};
  const source = displayed.current[type], canvas = document.createElement('canvas');
  canvas.width = source.width; canvas.height = source.height; canvas.setAttribute('aria-hidden','true');
  canvas.getContext('2d',{colorSpace:'srgb'}).drawImage(source,0,0); imageViewport.replaceChildren(canvas);
  $('image-title').textContent = `${types.find(t=>t[0]===type)[1]} · ${mode==='learn'?STEPS[step].title:'自分の画像'}`;
  imageDialog.showModal();
  const key=$('focus-region').value;
  if(mode==='learn' && REGIONS[key]) {
    const [x,y,w,h]=REGIONS[key].box;
    center={x:(x+w/2)/source.width,y:(y+h/2)/source.height};
    const fit=Math.min(imageViewport.clientWidth/source.width,imageViewport.clientHeight/source.height);
    zoom=Math.max(1,Math.min(6,Math.min(imageViewport.clientWidth/(w+40),imageViewport.clientHeight/(h+50))/fit));
  }
  drawOutlines(); syncPositions();
}
bindViewport(imageViewport);
$('close-image').addEventListener('click', () => imageDialog.close());
$('image-zoom-out').addEventListener('click', () => changeZoom(zoom-.25));
$('image-zoom-in').addEventListener('click', () => changeZoom(zoom+.25));
$('image-reset-view').addEventListener('click', () => { reset(); drawOutlines(); syncPositions(); });
imageDialog.addEventListener('close', () => { imageViewport.replaceChildren(); if(expandedView){zoom=expandedView.zoom;center=expandedView.center;$('focus-region').value=expandedView.focus;expandedView=null;}drawOutlines();syncPositions(); });
$('zoom').addEventListener('input', e => changeZoom(Number(e.target.value)/100));
$('zoom-in').addEventListener('click', () => changeZoom(zoom+.25)); $('zoom-out').addEventListener('click', () => changeZoom(zoom-.25));
$('reset-view').addEventListener('click', () => { reset(); drawOutlines(); syncPositions(); });
$('show-changes').addEventListener('change', () => { drawOutlines(); syncPositions(); });
$('focus-region').addEventListener('change', e => focusRegion(e.target.value));
new ResizeObserver(syncPositions).observe(grid); new ResizeObserver(syncPositions).observe(imageViewport);
let fullscreenActive = false, fullscreenScroll = 0;
function setFullscreenMode(active) {
  if (active === fullscreenActive) return;
  if (active) fullscreenScroll = window.scrollY;
  fullscreenActive = active; workspace.classList.toggle('is-fullscreen',active); document.body.classList.toggle('has-fullscreen-card',active);
  if (active) $('lesson-notes').scrollTop = 0;
  $('fullscreen-toggle').textContent = active ? '全画面を終了' : '全画面'; $('fullscreen-toggle').setAttribute('aria-pressed',String(active));
  if (!active) requestAnimationFrame(() => { window.scrollTo(0,fullscreenScroll); $('fullscreen-toggle').focus({preventScroll:true}); });
  requestAnimationFrame(() => {syncPositions();scrollActiveStep();});
}
$('fullscreen-toggle').addEventListener('click', async () => {
  if (fullscreenActive) {
    if (document.fullscreenElement === workspace) { try { await document.exitFullscreen(); } catch { setFullscreenMode(false); } }
    else setFullscreenMode(false);
    return;
  }
  setFullscreenMode(true);
  if (workspace.requestFullscreen && document.fullscreenEnabled) { try { await workspace.requestFullscreen(); } catch { /* The viewport-sized workspace also works in embedded browsers. */ } }
});
document.addEventListener('fullscreenchange', () => setFullscreenMode(document.fullscreenElement === workspace));
document.addEventListener('keydown', e => {
  if (e.key==='Escape' && fullscreenActive && !document.fullscreenElement && !imageDialog.open) { e.preventDefault(); setFullscreenMode(false); }
});

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
    $('image-info').textContent=uploadDescription;$('image-info').hidden=false;
    $('save-image').disabled=false;$('remove-image').disabled=false;reset();if(mode==='upload')render();
  }catch(e){if(id===uploadId){error(e.message.startsWith('4,000')?e.message:'画像を読み込めませんでした。対応形式の別の画像を選んでください。');status('読込を完了できませんでした。');$('save-image').disabled=!uploadSet;}}
  finally{URL.revokeObjectURL(url);$('image-input').value='';}
}
$('image-input').addEventListener('change',(e)=>readImage(e.target.files?.[0]));
let dragDepth=0;
const fileDrag=e=>[...(e.dataTransfer?.types??[])].includes('Files');
function clearDropState(){
  dragDepth=0;
  $('drop-zone').classList.remove('is-dragging');card.classList.remove('is-dragging');
}
// The whole upload view accepts files, including the empty area, existing images
// and fullscreen. File dragging stays separate from pointer-based image panning.
window.addEventListener('dragenter',e=>{
  if(!fileDrag(e)||mode!=='upload')return;
  e.preventDefault();dragDepth++;
  $('drop-zone').classList.add('is-dragging');card.classList.add('is-dragging');
});
window.addEventListener('dragover',e=>{
  if(!fileDrag(e))return;
  e.preventDefault();e.dataTransfer.dropEffect=mode==='upload'?'copy':'none';
});
window.addEventListener('dragleave',e=>{
  if(fileDrag(e)&&--dragDepth<=0)clearDropState();
});
window.addEventListener('drop',e=>{
  if(!fileDrag(e))return;
  e.preventDefault();clearDropState();
  if(mode!=='upload')return;
  if(e.dataTransfer.files.length!==1){error('画像は1枚ずつドロップしてください。');return;}
  readImage(e.dataTransfer.files[0]);
});
window.addEventListener('dragend',clearDropState);
$('remove-image').addEventListener('click',()=>{uploadId++;uploadSet=null;uploadDescription='';$('image-info').textContent='';$('image-info').hidden=true;$('image-input').value='';$('save-image').disabled=true;$('remove-image').disabled=true;error();reset();render();});
$('save-image').addEventListener('click',async()=>{
  if(!uploadSet)return;const selected=$('save-type').value;const set=uploadSet;$('save-image').disabled=true;error();
  try{
    const chosen=selected==='all'?types:types.filter(([type])=>type===selected);
    const source=set.normal,padding=20,header=74,footer=35;
    const canvas=document.createElement('canvas');const cols=selected==='all'?2:1,rows=selected==='all'?2:1;canvas.width=(source.width+padding)*cols+padding;canvas.height=(source.height+header)*rows+padding*(rows-1)+footer;
    const ctx=canvas.getContext('2d',{colorSpace:'srgb'});ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
    chosen.forEach(([type,label],i)=>{const x=padding+(i%cols)*(source.width+padding),y=Math.floor(i/cols)*(source.height+header+padding);ctx.fillStyle='#203b40';ctx.font='bold 20px sans-serif';ctx.fillText(label,x,y+30);ctx.font='12px sans-serif';ctx.fillText(type==='normal'?'元画像 / 白背景':'Brettel et al. (1997) / 2色覚の近似',x,y+51,source.width);ctx.drawImage(set[type],x,y+header);});
    ctx.font='12px sans-serif';ctx.fillStyle='#203b40';ctx.fillText('見え方の近似です。個人差・画面環境は再現しません。Study Atlas Interactive Lab',padding,canvas.height-12);
    const blob=await new Promise((resolve)=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error();
    const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=`color-vision-${selected}.png`;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status('画像全体のPNGを作成しました。端末のダウンロード先をご確認ください。');
  }catch{error('画像を保存できませんでした。より小さい画像でお試しください。');}
  finally{$('save-image').disabled=!uploadSet;}
});
$('open-method').addEventListener('click',()=>{
  $('learning-points').open=true;$('simulation-method').open=true;
  $('simulation-method').querySelector('summary').focus({preventScroll:true});
});
updateNotes();render();
