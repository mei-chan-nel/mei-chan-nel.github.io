import {circuitDocument} from '../lab/logic-circuit/documents.mjs';
import {encodeShare,decodeShare} from '../lab/logic-circuit/sharing.mjs';
import {fromProgram} from '../lab/flowchart/conversion.mjs';
import {encodeShare as encodeFlow,decodeShare as decodeFlow} from '../lab/flowchart/documents.mjs';
function circuit(extra){
 const nodes=[{id:'n1',type:'input',x:40,y:60,label:'A',value:0},{id:'n2',type:'input',x:40,y:220,label:'B',value:0},{id:'n3',type:'not',x:240,y:60,number:1},{id:'n4',type:'and',x:620,y:100,number:2},{id:'n5',type:'output',x:820,y:100,label:'Y'}];
 const edges=[];const wire=(a,b,p=0)=>edges.push({id:'w'+(edges.length+1),from:{node:'n'+a,port:0},to:{node:'n'+b,port:p}});
 wire(1,3);wire(3,4);wire(4,5);
 if(extra){nodes.push({id:'n6',type:'input',x:40,y:380,label:'C',value:0},{id:'n7',type:'or',x:400,y:250,number:3});wire(2,7);wire(6,7,1);wire(7,4,1);}else wire(2,4,1);
 return circuitDocument({nodes,edges,nextNode:extra?8:6,nextWire:edges.length+1,nextGate:4,nextBranch:1,example:''},'No.002 第1問 '+(extra?'手動ボタン付き給水回路':'給水回路'));
}
const urls={};
for(const [key,extra] of [['q1-06',false],['q1-07',true]]) {const d=circuit(extra);const u=await encodeShare(d,'https://mei-chan-nel.com/lab/logic-circuit/');await decodeShare(u);urls[key]=u;}
const source=`P = [1, 1, 0, 1, 1, 0, 0, 0]
T = 0
D = 0
W = 0
i を 1 から 8 まで 1 ずつ増やしながら繰り返す：
  W = W + P[i] * P[i % 8 + 1]
W > 0 の間繰り返す：
  D = D + W
  N = [0, 0, 0, 0, 0, 0, 0, 0]
  i を 1 から 8 まで 1 ずつ増やしながら繰り返す：
    L = P[(i + 6) % 8 + 1]
    C = P[i]
    R = P[i % 8 + 1]
    N[i] = C * R + L * (1 - C)
  P = N
  T = T + 1
  W = 0
  i を 1 から 8 まで 1 ずつ増やしながら繰り返す：
    W = W + P[i] * P[i % 8 + 1]
表示する(T, D)`;
const flow=fromProgram({version:1,title:'No.002 第2問B 図4 同時更新',source,settings:{indexBase:1,inputs:{}}});
urls['q2b-06']=await encodeFlow(flow);await decodeFlow(urls['q2b-06']);
console.log(JSON.stringify(urls));
