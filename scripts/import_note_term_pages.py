"""Import the published note term articles into static Study Atlas pages.

This is a migration helper for the current note magazine.  The generated pages
remain ordinary HTML files; the runtime term registry and the term index are
generated separately from each page's metadata by generate_term_guides.py.
"""

from __future__ import annotations

import re
from copy import deepcopy
from html import escape
from pathlib import Path
from urllib.request import Request, urlopen

from lxml import html


ROOT = Path(__file__).resolve().parents[1]
TERMS_ROOT = ROOT / "terms"
SITE_ORIGIN = "https://mei-chan-nel.com"
NOTE_ORIGIN = "https://note.com/mei_math/n/"
ADSENSE_LOADER = (
    "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?"
    "client=ca-pub-6257644709224446"
)


ARTICLES = [
    {
        "slug": "sort-algorithm",
        "term": "ソートアルゴリズム",
        "tag": "ソートアルゴリズム",
        "category": "PROGRAMMING",
        "key": "n28661e0aed57",
        "summary": "ソートアルゴリズムは、複数のデータを決められた基準で並べ替える具体的な手順です。バブルソートや選択ソートなどの特徴を学びます。",
        "description": "ソートアルゴリズム（整列アルゴリズム）の意味や、バブルソート、選択ソート、複数条件での並べ替えを高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "availability",
        "term": "可用性",
        "tag": "可用性",
        "category": "SECURITY",
        "key": "n8f2748fcbc91",
        "summary": "可用性は、必要なときに情報やサービスを利用できる性質です。冗長化やバックアップによって可用性を高める方法を学びます。",
        "description": "情報セキュリティの三要素の一つである可用性について、障害の原因、冗長化、バックアップとの関係を高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "social-media",
        "term": "ソーシャルメディア",
        "tag": "ソーシャルメディア",
        "category": "SOCIETY",
        "key": "nf4337d29f66b",
        "summary": "ソーシャルメディアは、利用者が情報を発信・共有し、相互に交流できるメディアです。情報が広がる仕組みと特性を学びます。",
        "description": "ソーシャルメディアの意味と、利用者による発信・共有、推薦による情報接触の偏りなどの特性を高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "hexadecimal",
        "term": "16進数",
        "tag": "16進数",
        "category": "DIGITAL",
        "key": "n46d38970c944",
        "summary": "16進数は、0～9とA～Fの16種類の記号を使って数を表す方法です。10進数や2進数との変換方法を学びます。",
        "description": "16進数の仕組みと、10進数・2進数との相互変換を、位取りと計算例を使って高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "wi-fi",
        "term": "Wi-Fi",
        "tag": "Wi-Fi",
        "category": "NETWORK",
        "key": "nb5bfd8dd7ee9",
        "summary": "Wi-Fiは、IEEE 802.11系の無線LAN機器に関する認証ブランドです。無線LAN、Ethernet、Bluetoothとの違いを学びます。",
        "description": "Wi-Fiの意味と、IEEE 802.11系無線LAN機器の認証ブランドとしての位置付けを高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "media-literacy",
        "term": "メディアリテラシ",
        "tag": "メディアリテラシ",
        "category": "SOCIETY",
        "key": "n4e333a60c3ab",
        "summary": "メディアリテラシは、情報を分析・評価し、責任をもって発信する力です。情報の根拠や発信者の意図を考える視点を学びます。",
        "description": "メディアリテラシの意味と、情報の分析・評価、根拠の確認、責任ある発信について高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "sns",
        "term": "SNS",
        "tag": "SNS",
        "category": "SOCIETY",
        "key": "n0c35f23f7721",
        "summary": "SNSは、利用者が情報を発信・共有し、コメントや反応を通じて交流できるサービスです。投稿が広がる特性も学びます。",
        "description": "ソーシャル・ネットワーキング・サービス（SNS）の一般的な性質と、利用者同士の発信・共有・交流について高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "iot",
        "term": "IoT",
        "tag": "IoT",
        "category": "NETWORK",
        "key": "n5ba582db08e0",
        "summary": "IoTは、センサや制御装置などのモノがインターネットにつながり、情報をやり取りする仕組みです。センサ、アクチュエータ、RFIDを学びます。",
        "description": "IoTの意味と、センサで情報を集め、ネットワークで送り、アクチュエータで現実世界に働きかける仕組みを高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "credibility",
        "term": "信憑性",
        "tag": "信憑性",
        "category": "SOCIETY",
        "key": "n1c101b0b98e5",
        "summary": "信憑性は、情報がどの程度信頼できるかという性質です。情報の根拠や発信者を確認し、内容を評価する視点を学びます。",
        "description": "情報の信憑性を評価するときの考え方と、根拠・発信者・情報の受け取り方について高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "foolproof-failsafe",
        "term": "フールプルーフ・フェイルセーフ",
        "tag": "フールプルーフ・フェイルセーフ",
        "category": "SECURITY",
        "key": "n98d99b90b906",
        "summary": "フールプルーフは人が誤操作しても安全にする設計、フェイルセーフは故障時に安全側へ動作させる設計です。二つの違いを学びます。",
        "description": "フールプルーフとフェイルセーフの意味、具体例、二つの考え方の違いを高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "ipv4",
        "term": "IPv4",
        "tag": "IPv4",
        "category": "NETWORK",
        "key": "nb15bae59b060",
        "summary": "IPv4アドレスは32ビットで構成され、通常は8ビットずつ四つに分けて10進数で表記します。IPv6との違いも学びます。",
        "description": "IPv4アドレスの32ビット構成、表記方法、グローバル・プライベートIPアドレス、IPv6との違いを高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "server",
        "term": "サーバ",
        "tag": "サーバ",
        "category": "NETWORK",
        "key": "n3b65c2ee03ef",
        "summary": "サーバは、ネットワークを通じて他のコンピュータへサービスやデータを提供するコンピュータです。可用性を高める二重化も学びます。",
        "description": "サーバの役割と、情報セキュリティの可用性を高めるサーバの二重化について高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "phishing",
        "term": "フィッシング",
        "tag": "フィッシング",
        "category": "SECURITY",
        "key": "n5a9b4f246d7d",
        "summary": "フィッシングは、本物らしいメッセージやWebページで利用者をだまし、情報や金銭を盗む手口です。不審な表示への対処を学びます。",
        "description": "フィッシングの典型的な手口と、偽の警告や不審なメッセージに接したときの安全な対処を高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "digital-divide",
        "term": "デジタルデバイド",
        "tag": "デジタルデバイド",
        "category": "SOCIETY",
        "key": "nafed2ba9b86e",
        "summary": "デジタルデバイドは、情報通信技術を利用できる人と利用できない人の間に生じる格差です。格差を小さくするための環境整備や学習機会を学びます。",
        "description": "デジタルデバイドの意味と、情報機器・情報サービスを利用する機会の格差を小さくする方法を高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "common-key-encryption",
        "term": "共通鍵暗号方式",
        "tag": "共通鍵暗号方式",
        "category": "SECURITY",
        "key": "n380d134af65c",
        "summary": "共通鍵暗号方式は、暗号化と復号に同じ鍵を使う方式です。送信者と受信者が秘密の鍵を共有する仕組みと注意点を学びます。",
        "description": "共通鍵暗号方式の仕組みと、暗号化・復号に同じ鍵を使う特徴を高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "digital-certificate",
        "term": "電子証明書",
        "tag": "電子証明書",
        "category": "SECURITY",
        "key": "n02b03be17a16",
        "summary": "電子証明書は、公開鍵と所有者の対応などを証明する電子的な証明書です。認証局やデジタル署名との関係を学びます。",
        "description": "電子証明書の役割と、認証局が所有者情報と公開鍵の対応を確認する仕組みを高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "ai",
        "term": "人工知能（AI）",
        "tag": "AI",
        "category": "DIGITAL",
        "key": "na31dfd2f4a36",
        "summary": "人工知能（AI）は、人間の知的な活動の一部をコンピュータで実現する技術です。機械学習や生成AIを含む利用上の注意を学びます。",
        "description": "人工知能（AI）の基本的な考え方、機械学習、生成AI、利用時の注意点を高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "integrity",
        "term": "完全性",
        "tag": "完全性",
        "category": "SECURITY",
        "key": "n083c8ed31b51",
        "summary": "完全性は、情報が正確で、改ざんされていない状態を保つ性質です。情報セキュリティの三要素における完全性の意味を学びます。",
        "description": "情報セキュリティの三要素の一つである完全性について、改ざんや不正な書換えの例を使って高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "accessibility",
        "term": "アクセシビリティ",
        "tag": "アクセシビリティ",
        "category": "DESIGN",
        "key": "nf4d33f58a3aa",
        "summary": "アクセシビリティは、高齢者や障害のある人を含む多様な利用者が情報やサービスを利用できる度合いです。ユーザビリティとの違いも学びます。",
        "description": "アクセシビリティの意味と、ユーザビリティやユニバーサルデザインとの関係を高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "os",
        "term": "OS",
        "tag": "OS",
        "category": "DIGITAL",
        "key": "n051507ff8647",
        "summary": "OSは、コンピュータのハードウェアを管理し、アプリケーションに利用するための基本ソフトウェアです。主な役割や更新の意味を学びます。",
        "description": "OSの役割、資源管理、基本ソフトウェアと応用ソフトウェアの関係、更新の意味を高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "big-data",
        "term": "ビッグデータ",
        "tag": "ビッグデータ",
        "category": "DATA",
        "key": "nb9c1e9bb2165",
        "summary": "ビッグデータは、さまざまな形式の大量のデータを蓄積・分析して、傾向や価値を見いだす対象です。機械学習との関係も学びます。",
        "description": "ビッグデータの特徴と、表形式に限らないデータを統計的手法や機械学習で分析する考え方を高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "media",
        "term": "メディア",
        "tag": "メディア",
        "category": "SOCIETY",
        "key": "nf402765e1bf6",
        "summary": "メディアは、情報を表現・伝達・記録するための手段です。表現メディア、伝達メディア、記録メディアの関係を学びます。",
        "description": "メディアの意味と、表現・伝達・記録の三つの分類、マスメディアやソーシャルメディアとの関係を高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "lan",
        "term": "LAN",
        "tag": "LAN",
        "category": "NETWORK",
        "key": "n259155d96b3a",
        "summary": "LANは、学校や家庭など比較的限られた範囲を結ぶネットワークです。LANを構成する機器、IPアドレス、WANとの違いを学びます。",
        "description": "LANの意味と、ネットワーク機器、IPアドレス、WANとの違いを高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "public-key-encryption",
        "term": "公開鍵暗号方式",
        "tag": "公開鍵暗号方式",
        "category": "SECURITY",
        "key": "n7aecd66766c5",
        "summary": "公開鍵暗号方式は、公開鍵と秘密鍵の組を使って暗号化やデジタル署名を行う方式です。共通鍵暗号方式との違いを学びます。",
        "description": "公開鍵暗号方式の仕組みと、受信者の公開鍵・秘密鍵、デジタル署名との関係を高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "filtering",
        "term": "フィルタリング",
        "tag": "フィルタリング",
        "category": "SECURITY",
        "key": "nf515bc50be89",
        "summary": "フィルタリングは、条件に応じて通信やWebサイトへのアクセスを許可・遮断する仕組みです。ブラックリスト方式とホワイトリスト方式を学びます。",
        "description": "フィルタリングの意味と、ブラックリスト方式・ホワイトリスト方式、ファイアウォールとの関係を高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "usability",
        "term": "ユーザビリティ",
        "tag": "ユーザビリティ",
        "category": "DESIGN",
        "key": "nb823b9ffea0f",
        "summary": "ユーザビリティは、利用者が目的を達成するために、製品やソフトウェアをどれだけ使いやすいかという性質です。改善方法を学びます。",
        "description": "ユーザビリティの意味と、オンラインヘルプなどを使ってソフトウェアを理解・操作しやすくする方法を高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "tcp",
        "term": "TCP",
        "tag": "TCP",
        "category": "NETWORK",
        "key": "n35ee6ffc9a46",
        "summary": "TCPは、ネットワーク上でデータを確実に届けるためのトランスポート層のプロトコルです。TCP/IPの階層とUDPとの違いを学びます。",
        "description": "TCPの役割と、TCP/IPの階層モデル、HTTP・IPとの関係、UDPとの違いを高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "memory",
        "term": "主記憶装置・補助記憶装置",
        "tag": "記憶装置",
        "category": "DIGITAL",
        "key": "nc8971878d644",
        "summary": "主記憶装置は実行中のプログラムやデータを一時的に置き、補助記憶装置はデータを長期的に保存します。両者の役割と違いを学びます。",
        "description": "主記憶装置と補助記憶装置の役割、データの保存方法、キャッシュメモリとの関係を高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "unauthorized-access-prevention-law",
        "term": "不正アクセス禁止法",
        "tag": "不正アクセス禁止法",
        "category": "SECURITY",
        "key": "n5fa8282f5374",
        "summary": "不正アクセス禁止法は、他人のIDやパスワードを使ったログインなど、コンピュータへの不正なアクセスを禁止する法律です。",
        "description": "不正アクセス禁止法が禁止する行為と、他人の認証情報を使ったログインの問題を高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "machine-learning",
        "term": "機械学習",
        "tag": "機械学習",
        "category": "DIGITAL",
        "key": "nce86da87147c",
        "summary": "機械学習は、データからパターンや規則を見つけ、予測や判断に利用する技術です。人工知能との関係を学びます。",
        "description": "機械学習の意味と、データからパターンや規則を学習して予測・判断に利用する仕組みを高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "protocol",
        "term": "プロトコル",
        "tag": "プロトコル",
        "category": "NETWORK",
        "key": "n8f27660b2414",
        "summary": "プロトコルは、コンピュータ同士が通信するときに従う約束事の集まりです。TCP/IPの階層と各層の役割を学びます。",
        "description": "通信プロトコルの意味と、TCP/IPの四つの階層が協力して通信する仕組みを高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "firewall",
        "term": "ファイアウォール",
        "tag": "ファイアウォール",
        "category": "SECURITY",
        "key": "n98cb438fcc41",
        "summary": "ファイアウォールは、ネットワーク間の通信を監視し、設定した条件に基づいて通過・遮断する仕組みです。設置場所や限界を学びます。",
        "description": "ファイアウォールの役割と設置場所、ルータやプロキシサーバとの違い、単独では十分でない理由を高校「情報Ⅰ」向けに解説します。",
    },
    {
        "slug": "ransomware",
        "term": "ランサムウェア",
        "tag": "ランサムウェア",
        "category": "SECURITY",
        "key": "n100999231c2f",
        "summary": "ランサムウェアは、ファイルを暗号化するなどして利用できなくし、復旧と引き換えに金銭を要求するマルウェアです。基本的な備えを学びます。",
        "description": "ランサムウェアの被害の仕組みと、重要なデータのバックアップなど基本的な対策を高校「情報Ⅰ」向けに解説します。",
    },
]


def fetch_body(key: str):
    request = Request(
        f"{NOTE_ORIGIN}{key}",
        headers={"User-Agent": "Mozilla/5.0 StudyAtlasMigration/1.0"},
    )
    raw = urlopen(request, timeout=30).read()
    document = html.fromstring(raw.decode("utf-8"))
    bodies = document.xpath("//div[@data-name='body']")
    if len(bodies) != 1:
        raise ValueError(f"note article {key}: expected one body, found {len(bodies)}")
    return bodies[0]


def clean_element(element, *, is_figure: bool = False):
    clone = deepcopy(element)
    for node in clone.xpath(".//script|.//style"):
        parent = node.getparent()
        if parent is not None:
            parent.remove(node)
    for node in clone.iter():
        if node.tag is html.etree.Comment:
            continue
        if node.tag == "figure" and is_figure:
            node.set("class", "term-note-figure")
        allowed = {}
        if node.tag == "img":
            for name in ("src", "alt", "width", "height", "loading"):
                if node.get(name) is not None:
                    allowed[name] = node.get(name)
        elif node.tag == "a":
            for name in ("href", "target", "rel"):
                if node.get(name) is not None:
                    allowed[name] = node.get(name)
        elif node.tag == "figure" and is_figure:
            allowed["class"] = "term-note-figure"
        node.attrib.clear()
        node.attrib.update(allowed)
    for node in clone.xpath(".//figcaption"):
        if not " ".join(node.text_content().split()):
            parent = node.getparent()
            if parent is not None:
                parent.remove(node)
    return clone


def serialize_explanation(children) -> str:
    parts: list[str] = []
    for element in children:
        text = " ".join(element.text_content().split())
        if element.tag in {"h3", "h4"} and not text:
            continue
        if element.tag == "p" and not text and not element.xpath(".//img"):
            continue
        clone = clean_element(element, is_figure=element.tag == "figure")
        rendered = html.tostring(clone, encoding="unicode", method="html")
        rendered = re.sub(r"\$\$\{([^}]+)\}\$\$", r"\1", rendered)
        rendered = rendered.replace("N2N^2", "N²")
        rendered = re.sub(
            r"\$\$<br\s*/?>\s*\(N−1\)\+\(N−2\)\+⋯\+1\(N-1\)\+\(N-2\)\+\\cdots\+1<br\s*/?>\s*\$\$",
            "(N−1) + (N−2) + … + 1",
            rendered,
        )
        rendered = re.sub(
            r"\$\$<br\s*/?>\s*\\frac\{N\(N-1\)\}\{2\}<br\s*/?>\s*\$\$",
            "N(N−1) / 2",
            rendered,
        )
        if element.tag == "p" and element.text_content().strip().startswith("$$"):
            rendered = rendered.replace('<p>', '<p class="term-formula">', 1)
        parts.append(rendered)
    return "\n          ".join(parts)


def direct_text(element) -> str:
    return " ".join(element.text_content().split())


def split_br_lines(element) -> list[str]:
    lines: list[str] = []
    fragments = [element.text or ""]
    for child in element:
        if child.tag == "br":
            lines.append("".join(fragments).strip())
            fragments = []
        else:
            fragments.append("".join(child.itertext()))
        if child.tail:
            fragments.append(child.tail)
    lines.append("".join(fragments).strip())
    return [line for line in lines if line]


def extract_question(body):
    children = body.xpath("./*")
    confirm_index = next(
        (i for i, element in enumerate(children) if element.tag == "h2" and "確認問題" in direct_text(element)),
        None,
    )
    answer_index = next(
        (i for i, element in enumerate(children) if element.tag == "h2" and "解答" in direct_text(element)),
        None,
    )
    app_index = next(
        (i for i, element in enumerate(children) if element.tag == "h2" and "アプリ" in direct_text(element)),
        len(children),
    )
    if confirm_index is None or answer_index is None or answer_index <= confirm_index:
        raise ValueError("note body does not contain the expected confirmation and answer sections")

    question_elements = children[confirm_index + 1 : answer_index]
    answer_elements = children[answer_index + 1 : app_index]
    paragraphs = [element for element in question_elements if element.tag == "p"]
    if len(paragraphs) < 3:
        raise ValueError("note confirmation section is missing stem, choices, or source")
    stem = direct_text(paragraphs[0])
    choices = split_br_lines(paragraphs[1])
    choices = [re.sub(r"^\d[．.]\s*", "", choice) for choice in choices]
    source = re.sub(r"^出典：?", "", direct_text(paragraphs[2])).strip()

    answer_paragraphs = [element for element in answer_elements if element.tag == "p"]
    if len(answer_paragraphs) < 2:
        raise ValueError("note answer section is missing answer or explanation")
    answer_label = direct_text(answer_paragraphs[0])
    answer_match = re.match(r"正解：?\s*(\d)[．.]\s*(.*)", answer_label)
    if not answer_match:
        raise ValueError(f"could not parse answer: {answer_label}")
    answer_index_value = int(answer_match.group(1))
    answer_text = f"{answer_match.group(1)}．{answer_match.group(2)}"
    explanation = html.tostring(clean_element(answer_paragraphs[1]), encoding="unicode", method="html")
    related = ""
    for element in answer_paragraphs[2:]:
        if direct_text(element).startswith("関連キーワード："):
            related = direct_text(element)
            break
    return {
        "stem": stem,
        "choices": choices,
        "source": source,
        "answer_index": answer_index_value,
        "answer_text": answer_text,
        "explanation": explanation,
        "related": related,
    }


def render_choices(choices: list[str]) -> str:
    return "\n            ".join(
        f'<li><span>{index}</span><p>{escape(choice)}</p></li>'
        for index, choice in enumerate(choices)
    )


def render_page(article: dict, body, question: dict) -> str:
    term = escape(article["term"])
    tag = escape(article["tag"])
    slug = article["slug"]
    canonical = f"{SITE_ORIGIN}/terms/{slug}/"
    note_url = f"{NOTE_ORIGIN}{article['key']}"
    related = (
        f'\n              <p class="term-related-keywords">{escape(question["related"])}</p>'
        if question["related"]
        else ""
    )
    body_html = serialize_explanation(body.xpath("./*")[: next(i for i, element in enumerate(body.xpath("./*")) if element.tag == "h2" and "確認問題" in direct_text(element))])
    explanation = question["explanation"]
    return f'''<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{term}とは｜情報Ⅰ 用語解説｜Study Atlas</title>
    <meta name="description" content="{escape(article["description"])}" />
    <meta name="study-atlas-term-tag" content="{tag}" />
    <meta name="study-atlas-term-summary" content="{escape(article["summary"])}" />
    <meta name="theme-color" content="#102f35" />
    <meta property="og:type" content="article" />
    <meta property="og:locale" content="ja_JP" />
    <meta property="og:site_name" content="情報Ⅰ Study Atlas" />
    <meta property="og:title" content="{term}とは｜情報Ⅰ 用語解説｜Study Atlas" />
    <meta property="og:description" content="{escape(article["description"])}" />
    <meta property="og:url" content="{canonical}" />
    <meta property="og:image" content="{SITE_ORIGIN}/assets/og/study-atlas-home-og.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="canonical" href="{canonical}" />
    <link rel="icon" href="../../assets/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="../../assets/site.css?v=2026083001" />
    <link rel="stylesheet" href="../../assets/term-page.css?v=2026090602" />
    <script async src="{ADSENSE_LOADER}" crossorigin="anonymous"></script>
    <script src="../../assets/manual-ads.js?v=2026080901" defer></script>
    <script src="../../assets/term-challenge.js?v=2026090602" defer></script>
  </head>
  <body>
    <a class="skip-link" href="#main-content">本文へ移動</a>
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="../../" aria-label="情報Ⅰ Study Atlas トップ">
          <span class="brand-mark" aria-hidden="true">I</span>
          <span><strong>情報Ⅰ Study Atlas</strong><small>知識を、ひろげ、つなげる</small></span>
        </a>
        <nav class="global-nav" aria-label="メインナビゲーション">
          <a href="../../">トップページ</a>
          <a href="../../info1-quiz-app/app/">学習アプリ</a>
          <a href="../../info1-quiz-app/questions/">問題を探す</a>
          <a href="../" aria-current="page">用語一覧</a>
          <a href="../../archive/">解説動画</a>
          <a href="../../LectureNote/">講義ノート</a>
          <a href="../../study-guide.html">使い方</a>
          <a href="../../about.html">このサイトについて</a>
        </nav>
      </div>
    </header>

    <main id="main-content" class="subpage term-page">
      <nav class="breadcrumb" aria-label="パンくずリスト">
        <a href="../../">学習トップ</a><span aria-hidden="true">/</span><a href="../../terms/">用語一覧</a><span aria-hidden="true">/</span><span aria-current="page">{term}</span>
      </nav>

      <section class="page-hero compact-hero term-hero" aria-labelledby="term-heading">
        <p class="eyebrow">TERM GUIDE · {escape(article["category"])}</p>
        <h1 id="term-heading">{term}</h1>
      </section>

      <div class="prose-content term-copy" id="term-explanation">
        <section>
          {body_html}
        </section>
      </div>

      <section class="term-practice-section" aria-labelledby="term-example-heading">
        <div class="term-section-heading">
          <p class="eyebrow">EXAMPLE</p>
          <h2 id="term-example-heading">例題</h2>
        </div>

        <article class="question-card term-example-card">
          <div class="question-meta"><span>{tag} · EXAMPLE</span><span>{escape(question["source"])}</span></div>
          <h3>{escape(question["stem"])}</h3>
          <ol class="choice-list">
            {render_choices(question["choices"])}
          </ol>
          <details class="answer-panel">
            <summary><span>解答・解説を確認</span><span class="detail-icon" aria-hidden="true"></span></summary>
            <div class="answer-content">
              <p class="correct-answer"><span>正解</span><strong>{escape(question["answer_text"])}</strong></p>
              <div class="explanation">
                <h3>解説</h3>
                {explanation}
              </div>
              <dl class="term-question-source"><dt>出典</dt><dd>{escape(question["source"])}</dd></dl>{related}
            </div>
          </details>
        </article>
      </section>

      <section class="term-challenge-section" data-term-challenge aria-labelledby="term-challenge-heading">
        <div>
          <p class="eyebrow">PRACTICE</p>
          <h2 id="term-challenge-heading">{term}の問題に挑戦</h2>
          <p class="term-challenge-message" data-term-challenge-message aria-live="polite"></p>
        </div>
        <button
          class="button button-primary term-challenge-button"
          type="button"
          data-term-challenge-button
          data-tag="{tag}"
          data-limit="5"
          data-exclude-stem="{escape(question["stem"])}"
        >アプリで解く</button>
      </section>

      <p class="term-back-link"><a href="../../info1-quiz-app/questions/#tag={escape(article['tag'])}">{term}の問題を見る</a></p>
      <div class="manual-ad-slot manual-ad-slot--article" data-manual-ad="article" hidden></div>

      <script type="application/ld+json">{{"@context":"https://schema.org","@type":"Article","headline":"{term}とは","description":"{escape(article["description"])}","url":"{canonical}","inLanguage":"ja","isPartOf":{{"@type":"WebSite","name":"情報Ⅰ Study Atlas","url":"{SITE_ORIGIN}/"}},"sameAs":"{note_url}"}}</script>
      <script type="application/ld+json">{{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{{"@type":"ListItem","position":1,"name":"学習トップ","item":"{SITE_ORIGIN}/"}},{{"@type":"ListItem","position":2,"name":"用語一覧","item":"{SITE_ORIGIN}/terms/"}},{{"@type":"ListItem","position":3,"name":"{term}","item":"{canonical}"}}]}}</script>
    </main>

    <footer class="site-footer">
      <div class="footer-grid">
        <a class="brand footer-brand" href="../../" aria-label="情報Ⅰ Study Atlas トップ"><span><strong>情報Ⅰ Study Atlas</strong><small>知識を、ひろげ、つなげる</small></span></a>
        <nav aria-label="フッターナビゲーション">
          <a href="../../">トップページ</a>
          <a href="../../info1-quiz-app/app/">学習アプリ</a>
          <a href="../../info1-quiz-app/questions/">問題を探す</a>
          <a href="../">用語一覧</a>
          <a href="../../archive/">解説動画</a>
          <a href="../../LectureNote/">講義ノート</a>
          <a href="../../study-guide.html">使い方</a>
          <a href="../../books/">書籍案内</a>
          <a href="../../about.html">このサイトについて</a>
          <a href="../../privacy.html">プライバシーポリシー</a>
          <a href="../../sitemap.html">サイトマップ</a>
        </nav>
      </div>
      <p class="copyright"><small>&copy; 2026 めいちゃんねる</small></p>
    </footer>
    <script src="../../assets/site-header.js?v=2026080801"></script>
  </body>
</html>
'''


def main() -> int:
    TERMS_ROOT.mkdir(parents=True, exist_ok=True)
    for article in ARTICLES:
        body = fetch_body(article["key"])
        question = extract_question(body)
        path = TERMS_ROOT / article["slug"] / "index.html"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(render_page(article, body, question), encoding="utf-8")
        print(f"Generated {path.relative_to(ROOT)} from {article['key']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
