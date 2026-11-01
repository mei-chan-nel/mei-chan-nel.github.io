"""Learner-facing No.002 revisions. Original submitted files stay unchanged."""
from lxml import etree, html
import re

CIRCLES = '⓪①②③④⑤⑥⑦⑧⑨'


def text(e):
    return ' '.join(e.text_content().split())


def replace_text(e, value):
    for child in list(e):
        e.remove(child)
    e.text = value


def choices(parent, reasons):
    etree.SubElement(parent, 'h3').text = '各選択肢の根拠'
    group = etree.SubElement(parent, 'ol', {'class': 'choices explanation-choices'})
    for i, reason in enumerate(reasons):
        li = etree.SubElement(group, 'li')
        etree.SubElement(li, 'span', {'class': 'num'}).text = CIRCLES[i]
        etree.SubElement(etree.SubElement(li, 'div'), 'p').text = reason


def revise_q2a(d):
    # Separate derivation from option-by-option judgments, as in No.001 Q2A.
    body = d.find('body')
    for child in list(body):
        body.remove(child)
    sections = [
        ('問1　要求を出す主体と金額の出所', [
            '方式Aでは，客が店のコードを読み，金額を入力して支払いを操作する。したがって，要求の送信元は客のスマートフォン，金額の取得元は客の入力であり，アは⓪となる。',
            '方式Bでは，店が客のコードを読み取り，POSレジが登録商品から計算した金額で要求する。送信元・金額の取得元がどちらもPOSレジなので，イは④となる。コードを読む側と，要求を送る側を資料に沿って確認する。',
        ], [
            '客のスマートフォンから，客が入力した金額を送る組合せであり，方式Aとして正しい。方式Bでは送信元も金額の取得元もPOSレジなので，不適である。',
            '方式Aの送信元と方式Bの金額の取得元を混ぜている。方式Aでは客が金額を入力し，方式BではPOSレジが送信するため，どちらにも当てはまらず，不適である。',
            '店のコードには店番号が含まれるが，購入金額は含まれないため，不適である。',
            '方式Aの金額の取得元と方式Bの送信元を混ぜている。方式Aは客のスマートフォンから送り，方式BはPOSレジの計算額を使うため，不適である。',
            'POSレジから，POSレジの計算額を送る組合せであり，方式Bとして正しい。方式Aでは客が金額を入力して送信するため，不適である。',
            '客のコードに購入金額は含まれていない。方式Bはコードから金額を得るのではなく，POSレジの計算額を使うため，不適である。',
        ]),
        ('問2a　導入の負担と減らせる誤り', [
            '方式Aは，紙のコードを用意すればよく，店側の読取機能や，POSレジからDNC Payへ金額を送る連携を必要としない。このため，導入時の負担を抑えたい店に適している。',
            '一方，方式BはPOSレジの計算額を使うので，客の金額入力と，店員による入力額の照合を省ける。支払結果の確認はどちらの方式でも必要である。導入時の負担と，会計ごとの作業を区別する。',
        ], [
            'レジごとにコードを変えても，POSレジの計算額と客の入力額を自動で対応付ける連携は生まれないため，誤りである。',
            '客のコードには金額が含まれない。POSレジの計算額を要求に使う連携が必要なので，それを不要とする点が誤りである。',
            '方式Aでは店側の読取機能やPOS連携を省け，方式Bでは客の金額入力と店員の照合作業を減らせるため，正しい。',
            '商品の種類や個数を誤登録すると，その内容から誤った額が計算される。金額の手入力を省いても商品登録の誤りは防げないため，誤りである。',
        ]),
        ('問2b　支払要求の経路と結果確認', [
            '方式Aでは客のスマートフォンから要求を送るので，店側の通信が途切れていても，客側が通信できれば要求を送れる。方式Bは店のPOSレジから送るので，示された条件では送れない。',
            'ただし，方式Aで要求を送れることは，店が支払結果を確認できることを意味しない。店がサーバの結果を受け取っていなければ，支払いの成立・不成立を決め付けず，通信の復旧後などに確認する。',
        ], [
            '方式Bの要求は客の端末ではなく，店のPOSレジから送られる。店の通信断でも送れるとする点が誤りである。',
            '方式Aの要求は店のPOSレジを経由せず，客のスマートフォンから送られる。店の通信断だけを理由に送れないとする点が誤りである。',
            '方式Aだけが客側の通信で要求を送れる。送信元の違いに沿った判断であり，正しい。',
            'バーコードを読み取っても，POSレジが客の通信回線を利用できるようにはならないため，誤りである。',
        ]),
        ('問3a　金額入力の省略と店側の連携', [
            '方式Cでは，POSレジの計算額を使って請求を作り，その会計のコードから客が店名と金額を取得する。方式Aにあった客の金額入力と，店員による入力額の照合を省ける。',
            'その代わり，POSレジとDNC Payの連携，および会計ごとのコードを客に提示する機能が必要になる。',
        ], [
            '同じ請求番号では一度しか支払いが成立しない。別会計で使い回すと次の会計を支払えなくなるため，不適である。同額でも会計ごとに別の請求番号が必要である。',
            '客の金額入力と入力額の照合を省ける一方，POS連携と会計ごとのコード提示が必要になる。方式Cの情報の流れに合っており，正しい。',
            'サーバに送られる店番号と金額だけでは，商品の種類や個数の誤登録を見つけて修正できないため，誤りである。',
            '店側の読取機能は不要でも，請求を作るPOS連携とコード表示は必要である。それらも不要とする点が誤りである。',
        ]),
        ('問3b　読取機能と表示機能', [
            '方式Bでは店が客のコードを読むため，店側に決済用の読取機能が必要である。方式Cでは客が店のコードを読むので，店側の決済用スキャナは不要になる。',
            'ただし，会計ごとに作るコードを客に見せる画面は必要である。利用できる既存画面があればよく，新しい専用機器の購入を必須とするものではない。',
        ], [
            '方式Bは店が読み，方式Cは客が読む。コードの提示側と読取側を逆にしているため，誤りである。',
            '店側の決済用スキャナは不要になるが，客に会計ごとのコードを見せる画面は必要になるため，正しい。',
            '方式Cでは店が客のコードを読む処理がない。店側にも決済用スキャナが必要だとする点が誤りである。',
            '店側の読取機能が不要でも，客にコードを提示する機能は必要である。画面まで不要とする点が誤りである。',
        ]),
        ('問3c　照会した状態に応じた再操作', [
            '通信エラーは，結果を確認できなかったことを表す。サーバで支払いが不成立だったとは限らないので，まずPOSレジから元の請求番号の状態を照会する。',
            '「受付可能」では，照会時点で未成立でも，元の要求が後から処理される可能性がある。同じ請求番号を使えば，両方の要求が届いても支払いは一度だけ成立する。そのため，キは元のコードで再操作する⓪となる。',
            '「未支払いで終了」では，元の請求番号による支払いは今後も成立しない。そのコードでは支払えないので，新しい請求番号のコードを表示して支払う。したがって，クは①となる。再操作でも結果が不明なら，その再操作に使った請求番号で照会する。',
        ], [
            '「受付可能」では同じ請求番号のコードを使うことで二重の成立を防げるため，キとして適切である。「未支払いで終了」した番号では支払えないため，クとしては不適である。',
            '「未支払いで終了」では新しい請求が必要なので，クとして適切である。「受付可能」のまま新しい請求を作ると，元と新しい請求の両方が成立するおそれがあるため，キとしては不適である。',
            '客の操作が終わったことや，照会時点で未成立だったことから，支払済みとは判断できないため，不適である。',
            '新しいコードを表示しただけでは，その請求の支払いは成立しない。元の要求も成立しなければ未払いのままなので，不適である。',
        ]),
    ]
    main = etree.SubElement(body, 'main', {'class': 'solution'})
    for n, (title, paragraphs, reasons) in enumerate(sections, 1):
        section = etree.SubElement(main, 'section', {'class': 'explanation-unit', 'data-reading-units': f'q2a-{n:02}'})
        etree.SubElement(section, 'h2').text = title
        for paragraph in paragraphs:
            etree.SubElement(section, 'p').text = paragraph
        choices(section, reasons)


Q4_REASONS = [
    {0:'中央値はどちらも12点である。区分4の方が高いとする点が誤りである。', 1:'四分位範囲は区分3が5.5点，区分4が7点であり，等しいとする点が誤りである。', 2:'中央値は等しく，四分位範囲は区分4の方が大きい。両方の比較が逆なので，誤りである。'},
    {0:'割合は区分1・2が49/303で約16.2％，区分3・4が24/92で約26.1％である。人数の多い群の方が割合も高いとする点が誤りである。', 1:'人数は区分1・2の49人の方が多く，割合は区分3・4の約26.1％の方が高い。両方の大小が逆なので，誤りである。', 3:'人数は区分1・2が49人，区分3・4が24人である。区分3・4の方が多いとする点が誤りである。'},
    {0:'評価点差の平均は区分1・2が−0.45点，区分3・4が−0.64点であり，前者の方が大きい。差の平均も区分3・4の方が大きいとする点が誤りである。', 2:'最終評価点の平均は11.36＞10.13で区分3・4の方が高く，評価点差の平均は−0.45＞−0.64で区分1・2の方が大きい。両方の大小が逆なので，誤りである。', 3:'最終評価点の平均は区分3・4の11.36点の方が高い。区分1・2の方が高いとする点が誤りである。'},
    {1:'同じ位置に複数の生徒の点が重なるため，見えている点の数は人数と一致しない。点を数えれば割合が求まるとする点が誤りである。', 2:'評価点差はPが10−6＝4点，Sが19−16＝3点であり，Pの方が大きい。Pの方が小さいとする点が誤りである。', 3:'評価点差はPの方が大きい。また，点の重なりがあるため，見えている点を数えても人数の割合は求まらない。両方の判断が誤りである。'},
    {0:'平均の絶対値は0〜9点で1.16＞0.84，15〜20点で0.00＜0.17である。この二つの範囲の大小が逆なので，誤りである。', 2:'10〜14点では0.74＞0.19で，区分3・4の方が大きい。この範囲で小さいとする点が誤りである。', 3:'0〜9点と10〜14点では，区分3・4の方が平均の絶対値が大きい。全ての範囲で小さいとする点が誤りである。'},
    {0:'区分3・4自身の人数の割合で平均し直している。395人全体の共通の割合を使う条件を満たさないため，不適である。', 1:'三つの範囲をそれぞれ1/3の割合で平均している。全体の人数142・188・65の割合と異なるため，不適である。', 3:'区分1・2の人数123・138・42の割合を使っている。395人全体の共通の割合ではないため，不適である。'},
    {1:'15〜20点の割合は，元の区分3・4では25.0％で，全体の約16.5％より高い。「全体より低い」とする理由が誤りである。', 2:'隔たりは0.19点から0.35点へ広がる。また，元の0〜9点の割合は20.7％で，全体の約35.9％より低い。変化の向きも人数割合の比較も逆なので，誤りである。', 3:'15〜20点の割合に関する説明は合うが，隔たりは0.19点から0.35点へ大きくなる。小さくなったとする点が誤りである。'},
    {1:'予測値との差はQが13−9.45＝3.55点，Sが19−16.11＝2.89点であり，Qの方が大きい。Sの方が大きいとする点が誤りである。', 2:'評価点差はQもSも3点で等しい。Sの方が大きいとする点が誤りである。', 3:'評価点差は等しく，予測値との差はQの方が大きい。二つの判断がともに誤りである。'},
    {0:'方法Bで3点を超えた9人のうち1人は，方法Aでは3点以下だった。9人全員が方法Aでも3点を超えていたとする点が誤りである。', 2:'回帰直線を作る計算に120人を加えると，その120人は未使用の評価対象ではなくなる。まだ使っていない生徒で比較する条件を満たさなくなるため，不適である。', 3:'表6には学習時間群別の内訳がない。全体で人数が減っても，各群で割合が下がったかは判断できないため，誤りである。'},
]


def revise_solution(d, sid, fields, letters, answers, units):
    if sid == 'q2a':
        revise_q2a(d)
    if sid == 'q4':
        groups = d.xpath('//ol[@class="choices"]')
        assert len(groups) == len(Q4_REASONS)
        for group, edits in zip(groups, Q4_REASONS):
            for i, value in edits.items():
                replace_text(group.xpath('./li')[i].xpath('./div/p')[1], value)
            for i, li in enumerate(group.xpath('./li')):
                if i not in edits:
                    p = li.xpath('./div/p')[1]
                    p.text = text(p) + 'したがって，適切である。'
        for p in d.xpath('//p[starts-with(normalize-space(),"適当なのは1と4")]'):
            p.text = (p.text or '').replace('適当なのは1と4。', '適当なのは①と④である。')
    if sid == 'q1':
        reasons = [
            ('判定と理由', 1, {0:'同じ画像が転載されても，独立した撮影の証拠は増えない。掲載件数だけで行事の写真だと判断する点が誤りである。', 2:'保存・編集・コピーでファイルの更新日時は変わり，撮影日時とは一致しないことがある。更新日時を撮影日時とみなす点が誤りである。', 3:'フォロワー数は画像の撮影日時や場所の正しさを保証しないため，判断の根拠として不適である。'}),
            ('使われる種類', 2, {0:'パスワードと暗証番号はどちらも知識であり，異なる種類を組み合わせていないため，不適である。', 1:'パスワードと秘密の質問への回答はどちらも知識であり，異なる種類を組み合わせていないため，不適である。', 3:'指紋と顔はどちらも身体的特徴であり，異なる種類を組み合わせていないため，不適である。'}),
            ('問題になる入力と理由', 2, {0:'A＝1，B＝0，C＝1で給水する。ボタンを押すと水不足の停止条件を迂回して給水するため，誤りである。', 1:'A＝0，B＝1，C＝0でも給水しない。水が足りていて土が乾いているのに，ボタンまで押さないと給水しないため，誤りである。', 3:'A＝1，B＝1，C＝1で給水する一方，A＝0，B＝1，C＝0では給水しない。水不足での停止と，土が乾いている場合の給水の両条件に反するため，誤りである。'}),
            ('判定と根拠', 2, {0:'同じ写真IDのF01が1号と2号に現れる。写真IDだけでは掲載記録を一意に識別できないため，不適である。', 1:'1号の1ページにはF01とF02が載る。「号，ページ」の組合せでも掲載記録が重複するため，不適である。', 3:'「号，写真ID」だけで識別でき，ページは不要である。最少の列数という条件を満たさないため，不適である。'}),
        ]
        for header, correct, edits in reasons:
            table = next(t for t in d.xpath('//table') if header in [text(h) for h in t.xpath('.//th')])
            for i, row in enumerate(table.xpath('.//tr[td]')):
                cell = row.xpath('./td')[-1]
                if i in edits:
                    replace_text(cell, edits[i])
                elif '正しい' not in text(cell):
                    replace_text(cell, text(cell) + 'したがって，適切である。')
                mark_option(row.xpath('./td')[0], i, i == correct)
    if sid == 'q2b':
        p = next(e for e in d.xpath('//p') if text(e).startswith('選択肢0は'))
        holder = etree.Element('div')
        p.addprevious(holder)
        choices(holder, [
            '前のマスがふさがれている車も進めている。更新直前に前のマスが空いている車だけが進む規則に反するため，誤りである。',
            'マス8の前はマス1である。マス1が空いているのにマス8の車を進めていないため，誤りである。',
            '全車が同じ更新直前の配置で判断すると，車はマス1・2・4・7に移り，車Aはマス2に残るため，正しい。',
            '車を指定と逆向きに動かしている。各車はマス番号が増える方向へ進み，マス8の次はマス1となるため，誤りである。',
        ])
        p.drop_tree()
        table = next(t for t in d.xpath('//table') if 'タの選択肢' in [text(h) for h in t.xpath('.//th')])
        reasons = [
            '全車が動けてもPは01010101と10101010の間で変わり続ける。配置が変わることを条件にすると終了しないため，不適である。',
            '図3では2回更新後もW＝1で，とどまる車が残る。Wが減らないことを理由に終えると早過ぎる。また，Wが1から0になった場合にも余分に更新するため，不適である。',
            'W＞0は，次の更新でとどまる車が残ることを表す。W＝0となった最初の状態で終えられるため，正しい。',
            '更新しても車と空きマスの数は各4個のままである。個数を比べる条件では終了しないため，不適である。',
        ]
        for i, row in enumerate(table.xpath('.//tr[td]')):
            replace_text(row.xpath('./td')[-1], reasons[i])
            mark_option(row.xpath('./td')[0], i, i == 2)
    if sid == 'q3':
        for table in d.xpath('//table'):
            headers = [text(h) for h in table.xpath('.//th')]
            if not headers or headers[0] not in ('番号', '位置'):
                continue
            for i, row in enumerate(table.xpath('.//tr[td]')):
                reason = row.xpath('./td')[-1]
                value = text(reason)
                correct = value.startswith('正しい。') if headers[0] == '番号' else i == 1
                # No.001 puts the short verdict beside the option number,
                # leaving the final column for the actual reason.
                mark_option(row.xpath('./td')[0], i, correct)
                if value.startswith(('正しい。', '誤り。')):
                    replace_text(reason, value.split('。', 1)[1])
            if headers[0] == '位置':
                replace_text(table.xpath('.//th')[-1], '理由')
        # Make the failure of each insertion location explicit.
        table = next(t for t in d.xpath('//table') if t.xpath('.//th') and text(t.xpath('.//th')[0]) == '位置')
        for i, row in enumerate(table.xpath('.//tr[td]')):
            if i != 1:
                cell = row.xpath('./td')[-1]
                cell.text = text(cell) + 'したがって，この挿入位置は不適である。'
    # Choice references use circled numbers; numeric answers and calculations do not.
    for table in d.xpath('//table'):
        headers = table.xpath('.//th')
        if not headers or not any(word in text(headers[0]) for word in ('選択肢', '回路')):
            continue
        for row in table.xpath('.//tr[td]'):
            first = row.xpath('./td')[0]
            if text(first) in list('0123456789'):
                replace_text(first, CIRCLES[int(text(first))])
    for e in d.iter():
        if not isinstance(e.tag, str) or e.tag in ('style', 'script'):
            continue
        for attr in ('text', 'tail'):
            value = getattr(e, attr)
            if value:
                value = re.sub(r'(選択肢|回路)([0-9])', lambda m: m[1] + CIRCLES[int(m[2])], value)
                setattr(e, attr, value)
    add_answers(d, sid, fields, letters, answers, units)
    return d


def mark_option(cell, index, correct):
    replace_text(cell, CIRCLES[index])
    br = etree.SubElement(cell, 'br')
    br.tail = '正' if correct else '誤'


def add_answers(d, sid, fields, letters, answers, units):
    # Remove source-only terse answer lines before adding the shared format.
    for p in list(d.xpath('//p')):
        value = text(p)
        if (sid == 'q1' and re.match(r'^[a-c]?\s*[ア-ン]：', value) and len(value) < 45) or value.startswith('正答：'):
            # A few source answer lines also serve as reading anchors.
            if p.get('data-reading-units'):
                p.text = None
                for child in list(p): p.remove(child)
            else:
                p.drop_tree()
    info = {f'{sid}-{n:02}': (cs, points) for n, (cs, points, _) in enumerate(units, 1)}
    for anchor in d.xpath('//*[@data-reading-units]'):
        descriptions = []
        for unit in anchor.get('data-reading-units').split():
            cs, points = info[unit]
            values = [answers[letters.index(c)] for c in cs]
            numeric = all(fields[c]['type'] == 'text' for c in cs)
            answer = ''.join(values) if numeric else '・'.join(CIRCLES[int(v)] for v in values)
            condition = '順不同・完答で' if sid == 'q4' and cs == 'ケコ' else '完答で' if len(cs) > 1 and not numeric else ''
            descriptions.append('・'.join(cs) + '：' + answer + f'（{condition}{points}点）')
        p = etree.Element('p', {'class': 'solution-answer'})
        etree.SubElement(p, 'strong').text = '正答　' + ' ／ '.join(descriptions)
        if anchor.tag == 'section':
            title = anchor.find('h2')
            if title is None: anchor.insert(0, p)
            else: title.addnext(p)
        elif anchor.tag == 'p':
            p.set('data-reading-units', anchor.attrib.pop('data-reading-units'))
            anchor.addprevious(p)
            if not text(anchor): anchor.drop_tree()
        else:
            anchor.addnext(p)
