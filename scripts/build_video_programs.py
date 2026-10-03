"""Build the reviewed executable programs for video questions Q231–Q330."""
from __future__ import annotations
import ast
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TITLES = '''2つの値の合計
平均点の計算順を直す
変数に再代入する
別の変数の値を代入する
一時変数で値を交換する
変数を1増やす
自分自身の値を掛ける
足し算と引き算で値を交換する
文字列をつなぐ
数値と文字列を比較する
配列の要素を表示する
配列の要素を更新する
別の要素の値を代入する
配列から平均点を計算する
科目と得点を対応させる
添字を変数で指定する
配列の要素を交換する
二次元配列を参照する
二次元配列を更新する
会員の情報を表示する
座席の状態を調べる
条件が成り立つ場合
条件が成り立たない場合
入力した年齢を判定する
2つの枝に分岐する
成人・未成年を判定する
偶数・奇数を判定する
条件によって計算を変える
次の3の倍数を求める
3つの枝に分岐する
年齢で3つに分岐する
倍数を分類する
入れ子の条件で割引を決める
天気と時間で行動を決める
論理式で料金を決める
5のつく日を判定する
0を避けて逆数を求める
年齢の割引条件を判定する
年齢別のチケット代を決める
カウンタを順に表示する
同じ値を繰り返し加える
1から5までの合計を求める
繰り返して2を掛ける
繰り返しで累乗を求める
繰り返しで階乗を求める
配列の平均点を求める
3の倍数を表示する
3の倍数を数える
2または3の倍数を数える
偶数だけを足す
入力した数の最大値を探す
二重ループで九九を表示する
二次元配列に九九を格納する
条件を満たす組を数える
iを条件に繰り返す
偶数の合計を求める
合計が20以上になるまで足す
漸化式の値を足す
フィボナッチ数列を追う
正解するまで入力を繰り返す
コラッツの数列を追う
合格・不合格の配列を作る
配列の最大値を探す
配列を左に循環させる
配列を逆順に並べる
複数の倍数条件で数える
引き算で最大公約数を求める
剰余で最大公約数を求める
12桁の整数を各桁に分解する
チェックデジットを求める
得点の度数分布を作る
最小枚数で支払う
2進数の各桁を重み付けする
2進数を左から計算する
2進数を右から計算する
10進数を2進数にする
1桁の16進数を変換する
16進数の各桁を変換する
10進数を16進数にする
バブルソート
選択ソート
挿入ソート
ソート済みの配列をマージする
ピボットで配列を分割する
線形探索で最後の一致を探す
線形探索を一致で打ち切る
二分探索
1から5の乱数を生成する
関数で斜辺の長さを求める
定義した面積の関数を呼ぶ
再帰で階乗を求める
再帰でフィボナッチ数を求める
積立投資をシミュレートする
コイン投げの度数分布を作る
同じ誕生日が現れるまで
検査結果の割合をシミュレートする
モンテカルロ法で円周率を求める
ランダムに動く点をプロットする
仕入れと在庫をシミュレートする
ATMの待ち時間をシミュレートする'''.splitlines()

# Each blank is filled with the selected correct answer, including repeated イ.
BLANKS = {
266: {'': 'date % 10 == 5'}, 267: {'': 'x != 0'}, 268: {'': 'age <= 18 or age >= 65'}, 269: {'': 'age < 60'},
292: {'ア': '0 から 要素数(Tokuten) - 1 まで 1 ずつ増やしながら', 'イ': 'Tokuten[i] >= 60'},
293: {'ア': '1 から 要素数(Data) - 1', 'イ': 'Data[i] > max_value'},
294: {'ア': '要素数(Data) - 1', 'イ': 'Data[i - 1] = Data[i]'},
295: {'ア': '要素数(Data) ÷ 2 - 1', 'イ': '要素数(Data) - i - 1'},
296: {'ア': '(i % 2 == 0) or (i % 3 == 0)', 'イ': 'not((i % 5 == 0) or (i % 7 == 0))'},
297: {'ア': 'x != y の間繰り返す：', 'イ': 'x > y'}, 298: {'ア': 'r != 0', 'イ': 'y'},
299: {'ア': 'ISBNcode[11 - i] = number % 10', 'イ': 'number = number ÷ 10'},
300: {'ア': '(2 + (-1) ** i)', 'イ': '(10 - (total_sum % 10)) % 10'},
301: {'ア': '9', 'イ': 'Tokuten[i] ÷ 10'},
302: {'ア': 'maisu = kingaku ÷ kinsyu[i]', 'イ': 'kingaku = kingaku % kinsyu[i]'},
303: {'ア': 'decimal + Binary[i] * 2 **(要素数(Binary) - i - 1)'},
304: {'ア': 'decimal * 2 + Binary[i]'}, 305: {'ア': 'decimal + Binary[i] * 2 ** k'},
306: {'ア': 'decimal % 2', 'イ': 'decimal ÷ 2'}, 307: {'ア': 'Henkan[j] != hex'},
308: {'ア': 'j * (16 ** (要素数(Hex) - i - 1))'}, 309: {'ア': 'Henkan(decimal % 16)', 'イ': 'decimal ÷ 16'},
310: {'ア': '要素数(Array) - 2', 'イ': '要素数(Array) - i - 2'},
311: {'ア': '0 から 要素数(Array) - 2', 'イ': 'i + 1 から 要素数(Array) - 1'},
312: {'ア': 'j >= 0 and Array[j] > current'},
313: {'ア': 'i < 要素数(A) and j < 要素数(B)', 'イ': 'A[i] <= B[j]'},
314: {'ア': 'Array[i] < pivot', 'イ': 'Array[i] == pivot'},
315: {'ア': 'Array[i] == target', 'イ': 'found != -1'},
316: {'ア': 'i < n and Array[i] != target', 'イ': 'i < n'},
317: {'ア': 'low = mid + 1', 'イ': 'high = mid - 1'},
323: {'ア': '1 + 乱数() * 5', 'イ': 'sougaku + sougaku * rimawari / 100'},
324: {'ア': 'dosu[count] = dosu[count] + 1'}, 325: {'ア': 'found == 0', 'イ': 'found = 1'},
326: {'ア': 'count1 = count1 + 1, count2 = count2 + 1', 'イ': 'count1 = count1 + 1'},
327: {'ア': '4 * kosu / kaisu'},
328: {'ア': 'X_zahyo[i] + 0.1', 'イ': 'Y_zahyo[i] + y_henka'},
329: {'ア': 'zaiko = zaiko - hanbai', 'イ': 'zaiko = 0'},
330: {'ア': '待ち客数 > 0 and 利用時間 == 0'},
}
HEX = list(range(10)) + list('ABCDEF')
def number(key, value, minimum=-9999, maximum=9999, **extra):
    return {'type':'number', 'key':key, 'label':f'{key} の初期値', 'defaultValue':value, 'min':minimum, 'max':maximum, **extra}
def array(key, value, minimum=-999, maximum=999, min_length=1, max_length=20, **extra):
    return dict(type='array', key=key, label=f'配列 {key}', defaultValue=value, min=minimum, max=maximum, minLength=min_length, maxLength=max_length, **extra)
def choice(key, value, choices):
    return dict(type='choice', key=key, label=key, defaultValue=value, choices=choices)
INPUTS = {
254: [number('age',17,0,120)],256:[number('age',17,0,120)],261:[number('age',17,0,120)],262:[number('number',9)],
263:[number('age',19,0,120),choice('is_student','Yes',['Yes','No'])],
264:[choice('weather','晴れ',['晴れ','曇り','雨']),choice('time','午後',['午前','午後'])],
265:[number('age',19,0,120),choice('is_student','Yes',['Yes','No'])],
266:[number('date',5,1,31)],267:[number('x',2,-999,999)],268:[number('age',18,0,120)],269:[number('age',20,0,120)],
274:[number('tei',3,-10,10),number('beki',4,0,10)],275:[number('factorial',5,0,10)],
281:[number('number',5,0,999)],290:[number('kaitou',1,0,999)],291:[number('n',6,1,1000)],
294:[array('Data',[3,5,9,2],min_length=1)],295:[array('Data',[3,5,9,2],min_length=1)],
297:[number('x',48,1,500),number('y',18,1,500)],298:[number('x',48,1,9999),number('y',18,1,9999)],
299:[number('number',978400000001,100000000000,999999999999)],
300:[array('ISBNcode',[9,7,8,4,0,0,0,0,0,0,0,1],0,9,12,12)],
301:[array('Tokuten',[79,55,69,80,32,100,0,90],0,100)],302:[number('kingaku',18673,0,999999)],
303:[array('Binary',[1,1,0,1],0,1,1,16)],304:[array('Binary',[1,1,0,1],0,1,1,16)],305:[array('Binary',[1,1,0,1],0,1,1,16)],
306:[number('decimal',13,1,65535)],307:[choice('hex','A',HEX)],308:[array('Hex',[3,'A','B'],min_length=1,max_length=6,choices=HEX)],
309:[number('decimal',939,1,65535)],
310:[array('Array',[5,3,8,1,4],min_length=1,max_length=12)],311:[array('Array',[5,3,8,1,4],min_length=1,max_length=12)],312:[array('Array',[5,3,8,1,4],min_length=1,max_length=12)],
314:[array('Array',[5,3,8,5,1,9,5],min_length=1,max_length=20)],
315:[array('Array',[3,7,12,18,25,18]),number('target',18,-999,999)],
316:[array('Array',[3,7,12,18,25]),number('target',18,-999,999)],
317:[array('Array',[3,7,12,18,25,31,42],sorted=True),number('target',18,-999,999)],
320:[number('a',3,0,1000,integer=False),number('b',4,0,1000,integer=False)],
}
SEQUENCES = {281:{'number':[5,8,3,9,2]},290:{'kaitou':[1,2,3,4,5]}}
PREMISES = {
248:dict(Matrix=[[1,2,3],[4,5,6]]),249:dict(Matrix=[[1,2],[3,4]]),
250:dict(Kaiin=[['田中',25,'男性'],['山田',30,'女性'],['鈴木',23,'女性'],['佐藤',44,'男性']]),
251:dict(Seats=[[0,1,0],[1,1,0],[0,1,0],[0,0,1],[1,0,0]])}
# Minimum lengths cover every fixed subscript in the corresponding question.
ARRAY_RULES = {
241:dict(Data=(3,20)),242:dict(Data=(1,20)),243:dict(Data=(2,20)),244:dict(Tokuten=(3,20)),245:dict(Kamoku=(3,20),Tokuten=(3,20)),
246:dict(Data=(3,20)),247:dict(Data=(3,20)),276:dict(Tokuten=(1,20)),292:dict(Tokuten=(1,20)),293:dict(Data=(1,20)),
299:dict(ISBNcode=(12,12)),301:dict(Dosu=(10,10)),302:dict(kinsyu=(1,20)),313:dict(A=(0,20),B=(0,20)),
}
LIMITS = {
232:dict(eigo=(0,100),sugaku=(0,100),kokugo=(0,100)),246:dict(a=(0,19),b=(0,19)),251:dict(gyou=(1,8),retu=(1,3)),
288:dict(ai=(0,9999)),289:dict(a=(0,9999),b=(1,9999)),
244:dict(Tokuten=(0,100)),245:dict(Tokuten=(0,100)),276:dict(Tokuten=(0,100)),292:dict(Tokuten=(0,100)),
299:dict(ISBNcode=(0,9)),301:dict(Dosu=(0,10000)),302:dict(kinsyu=(1,100000)),
323:dict(tumitate=(0,10000000),kikan=(1,100),sougaku=(0,100000000)),
324:dict(toss=(1,40),set=(1,100)),326:dict(ninzu=(1,10000)),327:dict(kaisu=(1,1500)),
328:dict(kaisu=(1,1000)),329:dict(siire=(0,100),kikan=(1,100),zaiko=(0,1000)),330:dict(営業終了時刻=(60,1440)),290:dict(target=(0,999)),
}
HIDDEN = {292:{'Gouhi'},299:{'ISBNcode'},301:{'Dosu'},306:{'Binary'},307:{'Henkan'},308:{'Henkan'},309:{'Henkan','Hex'},313:{'Merged'},324:{'dosu'},325:{'Birthdays','found','count'},326:{'count1','count2'},327:{'kosu'},328:{'X_zahyo','Y_zahyo'},330:{'現在時刻','利用時間','待ち客数','総待ち時間','顧客数'}}
for n, keys in {305:{'k','decimal'},307:{'j'},303:{'decimal'},304:{'decimal'},308:{'decimal'},313:{'i','j'},315:{'found'},316:{'i'},317:{'low','found'},329:{'sinagire'}}.items():
    HIDDEN.setdefault(n,set()).update(keys)
BLANK_PATTERN = re.compile(r'（\s*([アイ]?)\s*）')
LINE_PATTERN = re.compile(r'^\s*（(\d+)）\s*(.*)$')

def literal_fields(source, number_id):
    fields=[]; bound=set(); output=[]
    for line in source:
        if line.lstrip().startswith(('｜','⎿')):
            output.append(line); continue
        # Split assignments only at commas outside quotes/brackets.
        pieces=re.split(r',(?=(?:[^\[\]]|\[[^\[\]]*\])*$)(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)',line)
        for piece in pieces:
            match=re.match(r'\s*([\w]+)\s*=\s*(.*?)\s*$',piece)
            if not match: continue
            key,raw=match.groups()
            if key in bound or key in HIDDEN.get(number_id,set()): continue
            try: value=ast.literal_eval(raw)
            except (ValueError,SyntaxError): continue
            if not isinstance(value,(int,float,str,list)): continue
            if isinstance(value,list) and not value: continue
            if isinstance(value,list):
                if any(not isinstance(item,(int,float,str)) for item in value): continue
                minimum,maximum=ARRAY_RULES.get(number_id,{}).get(key,(1,20))
                low,high=LIMITS.get(number_id,{}).get(key,(-999,999))
                extra={'elementType':'text'} if all(isinstance(item,str) for item in value) else {}
                field=array(key,value,low,high,minimum,maximum,**extra)
            elif isinstance(value,str): field=dict(type='text',key=key,label=f'{key} の文字列',defaultValue=value,maxLength=40,allowEmpty=True)
            else:
                low,high=LIMITS.get(number_id,{}).get(key,(-9999,9999))
                field=number(key,value,low,high)
                if key in {'count','kosu','found','i','j','set','toss','ninzu','kaisu'} and value>=0: field['min']=max(0,field['min'])
            fields.append(field); bound.add(key)
            line=line.replace(piece,piece[:piece.rfind(raw)]+'{'+key+'}',1)
        output.append(line)
    return output,fields

def build():
    data=json.loads((ROOT/'data/video-questions.json').read_text(encoding='utf-8'))
    curriculum=json.loads((ROOT/'data/video-curriculum.json').read_text(encoding='utf-8'))
    genre_by_number={n:g for f in curriculum['fields'] for g in f['genres'] for n in g['numbers']}
    questions=next(s['questions'] for s in data['sections'] if s['id']=='programming')
    assert len(TITLES)==len(questions)==100
    entries=[]
    for question in questions:
        n=question['number']; lines=[]; labels=[]
        for text in question['question'].splitlines():
            match=LINE_PATTERN.match(text)
            if match:
                labels.append('（'+match[1]+'）'); lines.append(match[2].split('#',1)[0].rstrip())
        blanks=BLANKS.get(n,{})
        for label,replacement in blanks.items():
            pattern=re.compile(r'（\s*'+label+r'\s*）')
            assert any(pattern.search(line) for line in lines), f'Q{n}: missing blank {label}'
            lines=[pattern.sub(lambda _: replacement,line) for line in lines]
        assert not any(BLANK_PATTERN.search(line) for line in lines),f'Q{n}: unfilled blank'
        notes=[]; variants=[]
        if n==232:
            original=list(lines); lines[3]='heikin = (eigo + sugaku + kokugo) / 3'
            notes.append('誤りを直す問題です。括弧を補った正しい計算を実行します。元の式との比較もできます。')
            variants.append(dict(key='original',label='問題の式',source=original,note='問題文の式をそのまま実行します。割り算が先に計算される様子を確かめます。'))
        if n==240:
            variants.append(dict(key='b',label='プログラムB',source=lines[3:])); lines=lines[:3]; labels=labels[:3]
        if n==318: lines=['表示する(整数(5 * 乱数()) + 1)']; labels=['（1）']; notes.append('正解の選択肢を表示する処理で実行します。乱数は0以上1未満です。')
        if n==319:
            lines=['x = {x}','y = {y}','表示する(べき乗(べき乗(x, 2) + べき乗(y, 2), 0.5))']; labels=['（1）','（2）','（3）']
            notes.append('問題文の x・y に値を設定し、正解の関数を実行します。')
        if n==320: notes.append('関数の定義と呼び出すプログラムを続けて表示します。行番号は問題文のものです。')
        if n in (321,322):
            name='factorial' if n==321 else 'fibo'; lines.append(f'表示する({name}({{n}}))'); labels.append('（6）')
            notes.append('問題文で指定された関数の呼び出しを、最後の行に置いて実行します。')
        if n==324: lines[0]='dosu = {dosu}'
        if n==328: lines[1]='X_zahyo = [{x0}], Y_zahyo = [{y0}]'
        source,fields=literal_fields(lines,n)
        for field in INPUTS.get(n,[]): fields.append(field)
        initial=[]
        for key,rows in PREMISES.get(n,{}).items():
            matrix=dict(type='matrix',key=key,label=f'問題文の配列 {key}',defaultValue=rows,start=1 if n==251 else 0,minRows=len(rows),maxRows=8,columnCount=len(rows[0]),min=0 if n==251 else -999,max=1 if n==251 else 999)
            if n==251: matrix['minRows']=1  # gyou と行数の対応は適用時に検証する。
            if n==250:
                matrix['columns']=[dict(type='text',maxLength=20),dict(type='number',min=0,max=120),dict(type='choice',choices=['男性','女性'])]
                matrix['columnLabels']=['名前','年齢','性別']; matrix['minRows']=3
            fields.append(matrix); initial.append(key)
            notes.append(f'{key} は問題文の表の値をあらかじめ用意しています。添字は{matrix["start"]}からです。')
        if n==319: fields.extend([number('x',3,.01,1000,integer=False),number('y',4,.01,1000,integer=False)])
        if n in (321,322): fields.append(number('n',5,0 if n==321 else 1,10))
        if n==328: fields.extend([number('x0',0,-100,100,integer=False),number('y0',0,-100,100)])
        # Loop limits whose changes preserve the question's array constraints.
        if n in (270,271,272,273,277,278,279,280,282,283,284,296):
            maxima=30 if n==284 else 12 if n in (282,283) else 500
            occurrence=0
            updated=[]
            for line in source:
                match=re.search(r'から (\d+) まで',line)
                if match:
                    occurrence+=1; key='end' if n==284 else f'end{occurrence}'
                    if not any(f['key']==key for f in fields): fields.append(number(key,int(match[1]),1,maxima,label=f'{line.strip("｜⎿ ").split("を")[0].strip()} の終了値'))
                    line=line[:match.start(1)]+'{'+key+'}'+line[match.end(1):]
                updated.append(line)
            source=updated
        derived={}
        if n==276:
            source[4]='average = sum / {people}'; source[5]='表示する("{people}人の平均点は", average, "点です")'; derived['people']=dict(lengthOf='Tokuten')
        if n==292: source[1]='Gouhi = {Gouhi}'; derived['Gouhi']=dict(fill=' ',lengthOf='Tokuten')
        if n==324: derived['dosu']=dict(fill=0,lengthOf='toss',extra=1)
        if n==323: source[7]='表示する("{kikan}年後の資産総額は", sougaku, "円")'
        if n==329: source[10]='表示する("{kikan}日目終了時点の在庫数：", zaiko)'
        if n==309: notes.append('Henkan(添字) は問題の選択肢の表記に合わせた配列参照です。')
        genre=genre_by_number[n]
        entry=dict(id=f'video-q-{n}',questionId=f'q-{n}',number=n,title=TITLES[n-231],category=genre['label'],archivePage=genre['id'],description=TITLES[n-231]+'。',focus=' '.join(notes) or ('正解の選択肢を補ったプログラムです。' if blanks else '問題文のプログラムを1行ずつ実行します。'),source=source,lineLabels=labels,parameters=fields,inputs=INPUTS.get(n,[]),initialKeys=initial,derived=derived,inputSequences=SEQUENCES.get(n,{}),filledAnswers=blanks,originalHash=hashlib.sha256(question['question'].encode()).hexdigest(),answer=question['answer'])
        entry['coursePages']=[course['id'] for course in curriculum['courses'] if n in course['numbers']]
        if n==325: entry['displayArrayLimits']={'Birthdays':dict(length=366,fill='12月31日')}
        if n==246: entry['indexParameters']={'a':dict(array='Data'),'b':dict(array='Data')}
        if n==251: entry['indexParameters']={'gyou':dict(array='Seats',axis=0),'retu':dict(array='Seats',axis=1)}
        if n==240: entry['variantLabel']='プログラムA'
        if n==232: entry['variantLabel']='正しい式'
        if variants:
            entry['variants']=[]
            for variant in variants:
                variant_source,variant_fields=literal_fields(variant['source'],n)
                entry['variants'].append(dict(id=f'video-q-{n}-{variant["key"]}',label=variant['label'],source=variant_source,parameters=variant_fields,note=variant.get('note','')))
        if n==320: entry['lineSections']={'1':'関数の定義','4':'プログラム'}
        if n==283: entry['arrayShapes']={'Kuku':{'rows':'end1','columns':'end2','start':1}}
        if n in (326,330): entry['maxSteps']=100000 if n==326 else 20000
        if n==324: entry['maxSteps']=20000
        if n==282: entry['outputColumns']=3
        if n in (281,290): entry['scriptedInputPlan']=True
        if n==313:
            for field in fields:
                if field['key'] in ('A','B'): field['sorted']=True
        entries.append(entry)
    output=ROOT/'program-trace/video-program-data.js'
    output.write_text('// Generated by scripts/build_video_programs.py from reviewed per-question settings.\nexport const VIDEO_PROGRAM_DATA = '+json.dumps(entries,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
    print(f'Built {len(entries)} questions, {sum(len(q.get("variants",[])) for q in entries)} comparison variants, {len(BLANKS)} filled-answer questions.')

if __name__=='__main__': build()
