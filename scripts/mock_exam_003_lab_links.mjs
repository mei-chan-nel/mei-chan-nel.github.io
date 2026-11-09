import { fromProgram } from '../lab/flowchart/conversion.mjs';
import { encodeShare, decodeShare } from '../lab/flowchart/documents.mjs';

// The eight given random numbers, applying method C's previous-minute rule.
const source=`R = [1, 10, 8, 2, 10, 6, 9, 1]
W = 0
M = 0
t を 1 から 8 まで 1 ずつ増やしながら繰り返す：
  S = 1
  もし W >= 3 ならば：
    S = 2
  r = R[t]
  もし r <= 2 ならば：
    N = 0
  そうでなくもし r <= 6 ならば：
    N = 1
  そうでなくもし r <= 9 ならば：
    N = 2
  そうでなければ：
    N = 3
  W = W + N - S
  もし W < 0 ならば：
    W = 0
  もし W > M ならば：
    M = W
  表示する(t, "分目：待ち人数", W, "人，最大", M, "人")`;
const flow=fromProgram({version:1,title:'No.003 第2問B 方法C・最初の8分',source,settings:{indexBase:1,inputs:{}}});
const url=await encodeShare(flow);
await decodeShare(url);
process.stdout.write(JSON.stringify(url));
