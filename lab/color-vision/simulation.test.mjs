import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {simulateRGB,simulatePixels,decode,encode,contrast,fromHex,PARAMETERS} from './simulation.mjs';
import {COLORS,ROUTE_COLORS,VENUES,PANELS,CONTRAST_EXAMPLES,STEPS,IMPROVEMENTS,REGIONS,SIZE} from './lesson.mjs';
const fixtures=JSON.parse(await readFile(new URL('./reference-fixtures.json',import.meta.url),'utf8'));

test('native public-domain C reference: both Brettel planes, sRGB decoding, and clipping',()=>{
  const branches={p:new Set(),d:new Set(),t:new Set()};
  for(const {rgb,...expected} of fixtures.cases)for(const type of ['p','d','t']){
    const actual=simulateRGB(rgb,type);
    actual.forEach((value,i)=>assert.ok(Math.abs(value-expected[type][i])<=1,`${type} ${rgb}: ${actual} vs ${expected[type]}`));
    const n=PARAMETERS[type].n;
    branches[type].add(rgb.map(v=>decode(v/255)).reduce((sum,v,i)=>sum+v*n[i],0)>=0);
  }
  for(const branch of Object.values(branches))assert.equal(branch.size,2);
});
test('sRGB round trip and neutral colors remain neutral',()=>{
  for(let v=0;v<256;v++){
    assert.equal(encode(decode(v/255)),v);
    for(const type of ['p','d','t'])for(const channel of simulateRGB([v,v,v],type))assert.ok(Math.abs(channel-v)<=1);
  }
  assert.equal(encode(-.5),0);assert.equal(encode(1.5),255);
});
test('pixel conversion is independent per pixel and preserves alpha',()=>{
  const input=new Uint8ClampedArray([255,0,0,255,0,255,0,128,1,2,3,0]);
  for(const kind of ['p','d','t']){
    const output=simulatePixels(input,kind);
    for(let i=0;i<input.length;i+=4){assert.deepEqual([...output.slice(i,i+3)],simulateRGB([...input.slice(i,i+3)],kind));assert.equal(output[i+3],input[i+3]);}
  }
  assert.equal(input[0],255);
});
test('WCAG relative luminance contrast matches known black/white ratio and lesson claims',()=>{
  assert.equal(contrast('#000000','#ffffff'),21);assert.equal(contrast('#123456','#123456'),1);
  assert.ok(contrast('#ffffff',COLORS.orange)<3);
  assert.ok(contrast(COLORS.ink,'#fff3d6')>7);
  assert.ok(contrast('#c5a55b','#fff3d6')<3);
  assert.ok(contrast('#654519','#fff3d6')>7);
});
test('lesson colors support the stated observation; this is not a perceptual threshold',()=>{
  const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  const separation=(a,b,type)=>distance(simulateRGB(fromHex(a),type),simulateRGB(fromHex(b),type));
  for(const type of ['p','d'])assert.ok(separation(COLORS.blue,COLORS.orange,type)>separation(COLORS.red,COLORS.green,type)*5);
  for(const type of ['p','d'])assert.ok(separation(ROUTE_COLORS.open,ROUTE_COLORS.closed,type)<separation(ROUTE_COLORS.open,ROUTE_COLORS.closed,'normal')*.5);
  const [gym,courtyard]=VENUES;
  for(const type of ['p','d'])assert.ok(separation(gym.color,courtyard.color,type)<separation(gym.color,courtyard.color,'normal')*.6);
  assert.ok(separation(COLORS.chartBeforeBlue,COLORS.chartBeforeGreen,'t')<separation(COLORS.chartBeforeBlue,COLORS.chartBeforeGreen,'normal'));
  assert.equal(new Set(VENUES.map(v=>v.pattern)).size,VENUES.length);
  assert.equal(new Set(PANELS.map(p=>p.color)).size,1);
});
test('contrast evidence matches the strong panel example and text/graphic criteria',()=>{
  for(const evidence of Object.values(CONTRAST_EXAMPLES)){
    const before=contrast(...evidence.before),after=contrast(...evidence.after);
    const threshold=evidence.kind==='graphic'?3:4.5;
    assert.ok(after>=threshold);if(evidence.kind==='text')assert.ok(before<threshold);
  }
  assert.ok(contrast(COLORS.ink,'#ffffff')>=4.5); // Building labels keep their white plates.
  assert.equal(contrast(...CONTRAST_EXAMPLES.warning.before).toFixed(2),'1.04');
  assert.equal(contrast(...CONTRAST_EXAMPLES.warning.after).toFixed(2),'7.80');
  for(const panel of PANELS){assert.ok(contrast('#ffffff',panel.color)<2.2);assert.ok(contrast(COLORS.ink,panel.color)>5.5);}
  assert.equal(contrast(...CONTRAST_EXAMPLES.panelsText.before).toFixed(2),'1.32');
  assert.equal(contrast(...CONTRAST_EXAMPLES.panelsText.after).toFixed(2),'9.01');
  assert.equal(contrast(COLORS.chartOrange,'#ffffff').toFixed(2),'4.44');
  for(const background of ['#ffffff','#fffef9','#e9ede4','#f4f5f0'])assert.ok(contrast(COLORS.soft,background)>=4.5);
});
test('all lesson steps and regions are complete and lie within the page',()=>{
  assert.equal(STEPS.length,2+IMPROVEMENTS.length*3);
  IMPROVEMENTS.forEach((item,i)=>{
    const observation=STEPS[1+i*3], improvement=STEPS[2+i*3], overview=STEPS[3+i*3];
    assert.equal(observation.phase,'observe');assert.equal(improvement.phase,'improve');assert.equal(overview.phase,'overview');
    assert.equal(observation.state,i);assert.equal(improvement.state,i+1);assert.equal(overview.state,improvement.state);
    for(const phase of [observation,improvement,overview])assert.deepEqual(phase.regions,[item.region]);
  });
  assert.equal(STEPS.at(-1).phase,'complete');assert.equal(STEPS.at(-1).state,IMPROVEMENTS.length);
  assert.deepEqual(STEPS.at(-1).regions,[]);
  for(const step of STEPS){for(const field of ['title','question','change','benefit','tip'])assert.ok(step[field]);for(const key of step.regions)assert.ok(REGIONS[key]);}
  for(const {box:[x,y,w,h]} of Object.values(REGIONS)){assert.ok(x>=0&&y>=0&&x+w<=SIZE.width&&y+h<=SIZE.height);}
});
