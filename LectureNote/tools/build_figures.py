from pathlib import Path
from math import exp, pi, sin, cos

from PIL import Image, ImageChops, ImageDraw, ImageFont


REPO = Path(__file__).resolve().parents[2]
OUT = REPO / "assets" / "lecture-v2"
S = 2
W, H = 1600, 900
FONT = r"C:\Windows\Fonts\meiryo.ttc"
FONT_BOLD = r"C:\Windows\Fonts\meiryob.ttc"

INK = "#173042"
MUTED = "#5b6f7b"
NAVY = "#11394b"
PAPER = "#f7f9fb"
WHITE = "#ffffff"
LINE = "#d7e0e3"
BLUE = "#3f7ea3"
BLUE_SOFT = "#eaf3f8"
GREEN = "#367b62"
GREEN_SOFT = "#eaf5ef"
ORANGE = "#c77a28"
ORANGE_SOFT = "#fff4e6"
VIOLET = "#6d5b8c"
VIOLET_SOFT = "#f2edf8"
RED = "#b9544d"


def sc(value):
    if isinstance(value, (tuple, list)):
        return tuple(int(round(v * S)) for v in value)
    return int(round(value * S))


class Figure:
    def __init__(self, title, kicker, accent=BLUE, size=(W, H)):
        self.width, self.height = size
        self.image = Image.new("RGB", sc(size), PAPER)
        self.d = ImageDraw.Draw(self.image)
        self.accent = accent
        self.rect((0, 0, self.width, 14), fill=accent)
        self.text((70, 42), kicker.upper(), 15, accent, bold=True)
        self.text((70, 76), title, 39, INK, bold=True)
        self.line((70, 140, self.width - 70, 140), LINE, 2)

    def font(self, size, bold=False):
        # 図はページ内で縮小表示されるため、注記も判読できる最小サイズを守る。
        # 測定と描画の両方がこの関数を通るので、折返し幅との不整合も起こさない。
        # 1600px画像を本文幅へ縮小しても、注記が本文より小さく見えない下限。
        # wrap()の計測にも同じフォントが使われるため、拡大によるはみ出しを抑えられる。
        return ImageFont.truetype(FONT_BOLD if bold else FONT, sc(max(size, 18)))

    def text(self, xy, value, size=20, fill=INK, bold=False, anchor=None):
        self.d.text(sc(xy), str(value), font=self.font(size, bold), fill=fill, anchor=anchor)

    def wrap(self, xy, value, width, size=18, fill=MUTED, bold=False, gap=7, max_lines=None):
        font = self.font(size, bold)
        lines, current = [], ""
        for char in str(value):
            candidate = current + char
            if self.d.textbbox((0, 0), candidate, font=font)[2] > sc(width) and current:
                lines.append(current)
                current = char
            else:
                current = candidate
        if current:
            lines.append(current)
        if max_lines:
            lines = lines[:max_lines]
        x, y = xy
        for line in lines:
            self.text((x, y), line, size, fill, bold)
            y += size + gap
        return y

    def rect(self, box, fill=None, outline=None, width=1):
        self.d.rectangle(sc(box), fill=fill, outline=outline, width=sc(width))

    def round(self, box, radius=18, fill=WHITE, outline=LINE, width=2):
        self.d.rounded_rectangle(sc(box), radius=sc(radius), fill=fill, outline=outline, width=sc(width))

    def ellipse(self, box, fill=None, outline=None, width=2):
        self.d.ellipse(sc(box), fill=fill, outline=outline, width=sc(width))

    def line(self, coords, fill=INK, width=3, joint="curve"):
        self.d.line(sc(coords), fill=fill, width=sc(width), joint=joint)

    def polygon(self, points, fill=None, outline=None):
        self.d.polygon([sc(point) for point in points], fill=fill, outline=outline)

    def arrow(self, start, end, color=None, width=4, head=13):
        color = color or self.accent
        x1, y1 = start
        x2, y2 = end
        self.line((x1, y1, x2, y2), color, width)
        angle = __import__("math").atan2(y2 - y1, x2 - x1)
        left = (x2 - head * cos(angle - pi / 6), y2 - head * sin(angle - pi / 6))
        right = (x2 - head * cos(angle + pi / 6), y2 - head * sin(angle + pi / 6))
        self.polygon([(x2, y2), left, right], fill=color)

    def poly_arrow(self, points, color=None, width=4, head=13):
        """Draw a routed arrow whose bends stay in dedicated whitespace lanes."""
        color = color or self.accent
        coords = tuple(value for point in points for value in point)
        self.line(coords, color, width)
        x1, y1 = points[-2]
        x2, y2 = points[-1]
        angle = __import__("math").atan2(y2 - y1, x2 - x1)
        left = (x2 - head * cos(angle - pi / 6), y2 - head * sin(angle - pi / 6))
        right = (x2 - head * cos(angle + pi / 6), y2 - head * sin(angle + pi / 6))
        self.polygon([(x2, y2), left, right], fill=color)

    def card(self, box, title, body="", accent=None, fill=WHITE, title_size=23, body_size=17):
        accent = accent or self.accent
        x1, y1, x2, y2 = box
        self.round(box, 18, fill, accent, 2)
        self.rect((x1, y1, x1 + 8, y2), accent)
        self.text((x1 + 24, y1 + 23), title, title_size, accent, bold=True)
        if body:
            self.wrap((x1 + 24, y1 + 68), body, x2 - x1 - 48, body_size, MUTED, gap=7)

    def save(self, folder, name):
        path = OUT / folder / name
        path.parent.mkdir(parents=True, exist_ok=True)
        final = self.image.resize((self.width, self.height), Image.Resampling.LANCZOS)
        final.save(path, optimize=True)
        return path


def horizontal_cards(fig, items, top=240, bottom=570, left=70, right=1530, gap=42):
    count = len(items)
    width = (right - left - gap * (count - 1)) / count
    for index, item in enumerate(items):
        x1 = left + index * (width + gap)
        x2 = x1 + width
        title, body, _accent, _fill = item
        fig.card((x1, top, x2, bottom), title, body, fig.accent, WHITE)
        if index < count - 1:
            fig.arrow((x2, (top + bottom) / 2), (x2 + gap, (top + bottom) / 2), NAVY, 3, 11)


def small_tag(fig, box, title, value, accent=BLUE, fill=WHITE):
    x1, y1, x2, y2 = box
    fig.round(box, 13, fill, accent, 2)
    fig.text((x1 + 16, y1 + 14), title, 15, MUTED, bold=True)
    fig.text(((x1 + x2) / 2, y2 - 28), value, 24, accent, bold=True, anchor="mm")


# Society -------------------------------------------------------------------

def society_literacy():
    f = Figure("情報を集め、確かめ、知恵へつなぐ", "INFORMATION LITERACY", BLUE)
    items = [
        ("01 収集", "目的に合う情報を複数の情報源から集める", BLUE, BLUE_SOFT),
        ("02 評価", "出典・発信者・更新日・根拠・偏りを確かめる", GREEN, GREEN_SOFT),
        ("03 整理・分析", "分類・比較し、事実と意見を分けて関係を読む", ORANGE, ORANGE_SOFT),
        ("04 活用", "出典と権利を守り、目的と相手に合わせて伝える", VIOLET, VIOLET_SOFT),
    ]
    horizontal_cards(f, items, top=190, bottom=455, gap=46)
    labels = [("データ", "測定値・記号", BLUE), ("情報", "整理・解釈", BLUE), ("知識", "分析・関連付け", BLUE), ("知恵", "判断・洞察", BLUE)]
    x, y, w, gap = 170, 610, 245, 72
    for i, (label, sub, color) in enumerate(labels):
        xx = x + i * (w + gap)
        f.round((xx, y, xx + w, y + 118), 20, WHITE, color, 3)
        f.text((xx + w / 2, y + 42), label, 27, color, True, "mm")
        f.text((xx + w / 2, y + 85), sub, 16, MUTED, False, "mm")
        if i < 3:
            f.arrow((xx + w + 12, y + 59), (xx + w + gap - 12, y + 59), NAVY, 3, 11)
    f.text((800, 790), "だれが・いつ・何を根拠に発信したか。別の資料でも確かめられるか。", 20, NAVY, True, "mm")
    f.save("society", "literacy-cycle.png")


def society_properties():
    f = Figure("情報の3つの性質と、メディアの3つの目的", "INFORMATION PROPERTIES", BLUE)
    props = [
        ("残存性", "使っても手元に残る。公開後もコピーや記録が残り得る。", BLUE, BLUE_SOFT),
        ("複製性", "同じ内容を短時間・低コストで複製できる。", GREEN, GREEN_SOFT),
        ("伝播性", "距離を越えて瞬時に広がる。範囲の制御が難しい。", ORANGE, ORANGE_SOFT),
    ]
    # 三つの性質は処理順ではないため、矢印で結ばず独立した並列項目として示す。
    for index, (title, body, _color, _fill) in enumerate(props):
        x1 = 70 + index * 500
        f.card((x1, 185, x1 + 455, 440), title, body, BLUE, WHITE)
    f.text((70, 505), "目的に合うメディアを選ぶ", 25, NAVY, True)
    media = [("表現", "文字・画像・音声・動画", BLUE), ("伝達", "新聞・放送・電話・SNS", BLUE), ("記録", "紙・USB・クラウド", BLUE)]
    for i, (label, examples, color) in enumerate(media):
        x1 = 70 + i * 500
        f.round((x1, 560, x1 + 455, 748), 18, WHITE, color, 2)
        f.ellipse((x1 + 24, 590, x1 + 94, 660), color)
        f.text((x1 + 59, 625), str(i + 1), 22, WHITE, True, "mm")
        f.text((x1 + 118, 595), label, 24, color, True)
        f.wrap((x1 + 118, 638), examples, 300, 17, MUTED)
    f.text((800, 810), "物理的な伝送メディア：空気・光・電波", 19, NAVY, True, "mm")
    f.save("society", "information-properties.png")


def society_personal_data():
    f = Figure("個人情報を、識別可能性と加工方法で見分ける", "PERSONAL DATA", BLUE)
    f.card((70, 200, 520, 760), "個人情報", "単独または組合せで、生存する個人を識別できる情報", BLUE, BLUE_SOFT, 29, 19)
    examples = ["氏名・生年月日", "顔写真・音声・動画", "位置・行動・購買履歴", "属性・人格・私生活"]
    for i, label in enumerate(examples):
        y = 410 + i * 68
        f.round((110, y, 480, y + 48), 11, WHITE, LINE, 1)
        f.text((295, y + 24), label, 16, NAVY, False, "mm")
    rows = [
        ("要配慮個人情報", "人種・信条・病歴・犯罪歴など。特に慎重な取扱い。", RED, "#fff0ef"),
        ("匿名加工情報", "個人を識別できず、元の個人情報へ復元できないよう加工。", GREEN, GREEN_SOFT),
        ("仮名加工情報", "他の情報と照合しない限り、個人を識別できないよう加工。", ORANGE, ORANGE_SOFT),
    ]
    for i, row in enumerate(rows):
        y1 = 205 + i * 190
        f.arrow((535, y1 + 82), (620, y1 + 82), NAVY, 3, 12)
        f.card((635, y1, 1530, y1 + 155), row[0], row[1], row[2], row[3], 25, 18)
    f.round((635, 786, 1530, 838), 12, "#f4f6f7", LINE, 1)
    f.text((1082, 812), "判断軸：識別できるか／復元できるか／第三者提供できるか", 18, NAVY, True, "mm")
    f.save("society", "personal-data-map.png")


def society_privacy():
    f = Figure("氏名・肖像・私生活に関わる権利を区別する", "PRIVACY & DISCLOSURE", BLUE)
    f.round((420, 190, 1180, 300), 22, NAVY, NAVY, 1)
    f.text((800, 235), "保護する利益と利用場面が異なる", 27, WHITE, True, "mm")
    f.text((800, 275), "一つの上位権利から枝分かれする法的な階層ではない", 15, "#dce9ee", False, "mm")
    cards = [
        ((70, 360, 500, 610), "プライバシー権", "私生活上の事実や自己に関する情報を、みだりに公開・利用されない利益。", BLUE, WHITE),
        ((570, 360, 1000, 610), "肖像権", "承諾なく、みだりに容貌などを撮影・公表されない人格的利益。", VIOLET, WHITE),
        ((1070, 360, 1530, 610), "パブリシティ権", "氏名や肖像がもつ顧客吸引力を、排他的に利用する経済的利益。", ORANGE, WHITE),
    ]
    for box, title, body, accent, fill in cards:
        f.card(box, title, body, accent, fill, 25, 18)
    f.round((70, 680, 1530, 815), 18, WHITE, BLUE, 2)
    f.text((105, 710), "情報公開", 23, BLUE, True)
    f.wrap((105, 752), "行政の透明性を高める一方、個人情報・法人情報・国家安全・公共の安全などは不開示となる場合がある。", 1360, 18, MUTED)
    f.save("society", "privacy-rights.png")


def society_ip():
    f = Figure("知的財産権を、権利の主体と保護対象で整理する", "INTELLECTUAL PROPERTY", BLUE)
    f.round((620, 165, 980, 230), 16, NAVY, NAVY, 1)
    f.text((800, 197), "知的財産権", 26, WHITE, True, "mm")

    branch_centres = [300, 800, 1300]
    branch_labels = ["産業財産権", "著作権（広い意味）", "その他の知的財産"]
    f.line((800, 230, 800, 270, 300, 270, 300, 305), BLUE, 3)
    f.line((800, 270, 800, 305), BLUE, 3)
    f.line((800, 270, 1300, 270, 1300, 305), BLUE, 3)
    for x, label in zip(branch_centres, branch_labels):
        f.round((x - 200, 305, x + 200, 368), 14, BLUE_SOFT, BLUE, 2)
        f.text((x, 336), label, 19, NAVY, True, "mm")

    # 左の幹から各権利へ接続し、親子関係を読み違えない形にする。
    industrial = [("特許権", "発明"), ("実用新案権", "考案"), ("意匠権", "デザイン"), ("商標権", "商品・サービスの標識")]
    industrial_ys = [430, 510, 590, 670]
    f.line((300, 368, 300, 400, 75, 400, 75, 706), BLUE, 2)
    for (label, sub), y1 in zip(industrial, industrial_ys):
        f.line((75, y1 + 31, 100, y1 + 31), BLUE, 2)
        f.round((100, y1, 520, y1 + 62), 10, WHITE, LINE, 2)
        f.text((125, y1 + 22), label, 16, NAVY, True)
        f.text((495, y1 + 42), sub, 13, MUTED, False, "rm")
    f.round((115, 770, 505, 812), 10, WHITE, BLUE, 1)
    f.text((310, 791), "出願・審査・登録によって権利化", 14, BLUE, True, "mm")

    # 著作者と伝達者を、共通の左側の幹から右向きに接続する。
    f.line((800, 368, 800, 398, 560, 398, 560, 650), BLUE, 2)
    copyright_groups = [
        (438, "著作者の権利", [("著作権", "財産権"), ("著作者人格権", "人格権")]),
        (618, "伝達者の権利", [("著作隣接権", "財産権"), ("実演家人格権", "実演家のみ")]),
    ]
    for y, parent, children in copyright_groups:
        f.line((560, y + 31, 595, y + 31), BLUE, 2)
        f.round((595, y, 805, y + 62), 11, WHITE, BLUE, 2)
        f.text((700, y + 31), parent, 16, NAVY, True, "mm")
        branch_x = 835
        f.line((805, y + 31, branch_x, y + 31, branch_x, y + 107), BLUE, 2)
        for index, (child, note) in enumerate(children):
            child_y = y - 12 + index * 88
            f.line((branch_x, child_y + 28, 860, child_y + 28), BLUE, 2)
            f.round((860, child_y, 1065, child_y + 56), 10, WHITE, LINE, 1)
            f.text((962, child_y + 21), child, 14, NAVY, True, "mm")
            f.text((962, child_y + 42), note, 11, MUTED, False, "mm")

    other_rights = ["回路配置利用権", "育成者権", "営業秘密", "地理的表示など"]
    other_ys = [430, 510, 590, 670]
    f.line((1300, 368, 1300, 400, 1115, 400, 1115, 701), BLUE, 2)
    for label, y in zip(other_rights, other_ys):
        f.line((1115, y + 29, 1140, y + 29), BLUE, 2)
        f.round((1140, y, 1510, y + 58), 10, WHITE, LINE, 1)
        f.text((1325, y + 29), label, 15, NAVY, True, "mm")
    f.text((800, 850), "線が分岐する位置と箱の段をそろえ、著作者と伝達者を別の主体として読む。", 15, MUTED, True, "mm")
    f.save("society", "intellectual-property.png")


def society_copyright():
    f = Figure("著作者と伝達者に、どの権利が認められるか", "COPYRIGHT RIGHTS", BLUE)
    f.round((70, 180, 1015, 615), 18, WHITE, BLUE, 2)
    f.text((105, 215), "著作権（財産権）", 25, BLUE, True)
    f.text((105, 255), "著作物をどの方法で利用させるかを決め、対価を得るための権利", 16, MUTED)
    economic = [
        "複製権", "上演権・演奏権", "上映権", "公衆送信権・公の伝達権",
        "口述権", "展示権", "頒布権", "譲渡権・貸与権",
        "翻訳権・翻案権等", "二次的著作物の利用に関する権利",
    ]
    for index, label in enumerate(economic):
        col, row = index % 2, index // 2
        x = 105 + col * 450
        y = 300 + row * 56
        f.round((x, y, x + 415, y + 42), 9, BLUE_SOFT, BLUE, 1)
        f.text((x + 207, y + 21), label, 14, NAVY, True, "mm")

    f.round((1060, 180, 1530, 615), 18, WHITE, VIOLET, 2)
    f.text((1095, 215), "著作者人格権", 25, VIOLET, True)
    f.text((1095, 255), "著作者の人格を守る、一身専属の権利", 15, MUTED)
    moral = [
        ("公表権", "未公表の著作物を、いつ・どのように公表するか"),
        ("氏名表示権", "実名・変名を示すか、氏名を示さないか"),
        ("同一性保持権", "意に反して内容や題号を改変されないこと"),
    ]
    for index, (label, body) in enumerate(moral):
        y = 300 + index * 100
        f.round((1095, y, 1495, y + 90), 11, VIOLET_SOFT, VIOLET, 1)
        f.text((1115, y + 14), label, 16, VIOLET, True)
        f.wrap((1115, y + 40), body, 355, 12, NAVY, gap=4, max_lines=2)

    f.round((70, 660, 1530, 840), 17, WHITE, BLUE, 2)
    f.text((105, 695), "著作物を公衆へ伝える人・事業者の権利", 20, NAVY, True)
    actors = ["実演家", "レコード製作者", "放送事業者", "有線放送事業者"]
    for index, actor in enumerate(actors):
        x = 105 + index * 350
        f.round((x, 735, x + 315, 785), 10, BLUE_SOFT, BLUE, 1)
        f.text((x + 157, 760), actor, 15, NAVY, True, "mm")
    f.text((800, 810), "財産的な権利＝著作隣接権　／　人格権が認められるのは実演家", 14, MUTED, True, "mm")
    f.save("society", "copyright-map.png")


# Digital -------------------------------------------------------------------

def digital_analog():
    f = Figure("アナログの連続曲線を、時刻と値で区切る", "ANALOG → DIGITAL", ORANGE)
    panels = [(70, 190, 760, 730), (840, 190, 1530, 730)]
    for box in panels:
        f.round(box, 20, WHITE, LINE, 2)
    f.text((110, 225), "アナログ：連続量", 24, ORANGE, True)
    f.text((880, 225), "デジタル：離散値", 24, BLUE, True)
    # Smooth analog waveform from a mathematical function.
    x0, y0, x1, y1 = 120, 660, 710, 315
    f.line((x0, y0, x1, y0), MUTED, 2)
    f.line((x0, y0, x0, y1), MUTED, 2)
    points = []
    for i in range(501):
        t = i / 500
        x = x0 + t * (x1 - x0)
        value = 0.72 * sin(t * 2.6 * pi - 0.5) + 0.18 * sin(t * 6.2 * pi)
        y = 490 - value * 165
        points.extend([x, y])
    f.line(tuple(points), ORANGE, 5)
    f.text((675, 688), "時間", 16, MUTED, True)
    f.text((118, 290), "電圧", 16, MUTED, True)
    # Samples and quantized staircase.
    sx0, sy0, sx1 = 895, 660, 1480
    f.line((sx0, sy0, sx1, sy0), MUTED, 2)
    f.line((sx0, sy0, sx0, 315), MUTED, 2)
    levels = [610, 550, 490, 430, 370]
    for yy in levels:
        f.line((sx0, yy, sx1, yy), "#dbe4e8", 1)
    sample_values = []
    for i in range(13):
        t = i / 12
        value = 0.72 * sin(t * 2.6 * pi - 0.5) + 0.18 * sin(t * 6.2 * pi)
        raw_y = 490 - value * 165
        qy = min(levels, key=lambda level: abs(level - raw_y))
        x = sx0 + 35 + i * 43
        sample_values.append((x, qy))
        f.line((x, sy0, x, qy), "#9ebbd0", 2)
        f.ellipse((x - 6, qy - 6, x + 6, qy + 6), BLUE, BLUE, 1)
    for i in range(len(sample_values) - 1):
        xa, ya = sample_values[i]
        xb, yb = sample_values[i + 1]
        f.line((xa, ya, xb, ya, xb, yb), BLUE, 4)
    f.text((1450, 688), "時間", 16, MUTED, True)
    f.text((895, 290), "段階値", 16, MUTED, True)
    f.round((335, 775, 1265, 835), 14, ORANGE_SOFT, ORANGE, 2)
    f.text((800, 805), "標本化：時間を区切る　→　量子化：値を区切る　→　符号化：2進数で表す", 19, NAVY, True, "mm")
    f.save("digital", "analog-digital.png")


def digital_bases_bits():
    f = Figure("同じ数を、10進法・2進法・16進法で表す", "BASE & BIT", ORANGE)
    x0, y0 = 90, 185
    widths = [220, 310, 380, 500]
    headers = ["表記法", "使う記号", "各桁の重み", "同じ数量「11」の表し方"]
    rows = [
        ("10進法", "0〜9", "10⁰, 10¹, 10², …", "11₁₀ = 1×10¹ + 1×10⁰"),
        ("2進法", "0, 1", "2⁰, 2¹, 2², …", "1011₂ = 8 + 2 + 1"),
        ("16進法", "0〜9, A〜F", "16⁰, 16¹, 16², …", "B₁₆ = 11₁₀"),
    ]
    x = x0
    for header, width in zip(headers, widths):
        f.rect((x, y0, x + width, y0 + 62), ORANGE_SOFT, ORANGE, 1)
        f.text((x + width / 2, y0 + 31), header, 16, NAVY, True, "mm")
        x += width
    for row_index, row in enumerate(rows):
        top = y0 + 62 + row_index * 90
        x = x0
        for col_index, (value, width) in enumerate(zip(row, widths)):
            f.rect((x, top, x + width, top + 90), WHITE, LINE, 1)
            size = 22 if col_index == 0 else 18
            f.text((x + width / 2, top + 45), value, size, ORANGE if col_index == 0 else NAVY, col_index == 0, "mm")
            x += width
    f.text((90, 565), "ビット数と表せる状態数", 23, NAVY, True)
    states = [("1 bit", "2通り"), ("2 bit", "4通り"), ("4 bit", "16通り"), ("8 bit = 1 byte", "256通り")]
    for index, (label, value) in enumerate(states):
        x = 90 + index * 365
        f.round((x, 620, x + 330, 745), 15, WHITE, ORANGE, 2)
        f.text((x + 165, 660), label, 20 if index < 3 else 17, ORANGE, True, "mm")
        f.text((x + 165, 708), value, 22, NAVY, True, "mm")
    f.round((250, 790, 1350, 845), 12, ORANGE_SOFT, ORANGE, 1)
    f.text((800, 817), "nビットで表せる組合せは 2ⁿ通り", 21, NAVY, True, "mm")
    f.save("digital", "bases-bits.png")


def digital_conversion():
    f = Figure("10進数11と2進数1011を往復する", "BASE CONVERSION", ORANGE)
    f.round((70, 180, 770, 790), 20, WHITE, ORANGE, 2)
    f.text((110, 220), "11₁₀ → 1011₂", 27, ORANGE, True)
    divisions = [("11 ÷ 2", "5", "余り 1"), ("5 ÷ 2", "2", "余り 1"), ("2 ÷ 2", "1", "余り 0"), ("1 ÷ 2", "0", "余り 1")]
    for i, (calc, q, rem) in enumerate(divisions):
        y = 305 + i * 102
        f.round((130, y, 690, y + 70), 12, ORANGE_SOFT, "#edc48d", 1)
        f.text((175, y + 35), calc, 20, NAVY, True, "lm")
        f.text((420, y + 35), f"商 {q}", 18, MUTED, False, "lm")
        f.text((570, y + 35), rem, 18, ORANGE, True, "lm")
    f.arrow((710, 655), (710, 305), ORANGE, 4, 14)
    f.text((620, 695), "余りを下から読む", 17, ORANGE, True)
    f.round((830, 180, 1530, 790), 20, WHITE, BLUE, 2)
    f.text((870, 220), "1011₂ → 11₁₀", 27, BLUE, True)
    weights = [("2³", "8", "1×8"), ("2²", "4", "0×4"), ("2¹", "2", "1×2"), ("2⁰", "1", "1×1")]
    for i, (power, weight, term) in enumerate(weights):
        x = 875 + i * 155
        f.round((x, 330, x + 130, 535), 13, BLUE_SOFT, BLUE, 2)
        f.text((x + 65, 375), power, 21, BLUE, True, "mm")
        f.text((x + 65, 430), f"重み {weight}", 16, MUTED, False, "mm")
        f.text((x + 65, 485), term, 19, NAVY, True, "mm")
    f.round((930, 625, 1430, 715), 16, BLUE_SOFT, BLUE, 2)
    f.text((1180, 670), "8 + 0 + 2 + 1 = 11", 25, NAVY, True, "mm")
    f.save("digital", "binary-conversion.png")


def digital_signed_float_text():
    f = Figure("同じビット列を、表現形式に沿って読む", "SIGNED · FLOAT · TEXT", ORANGE)
    # Two's complement.
    f.card((70, 180, 760, 430), "4ビットの2の補数：−5", "", ORANGE, ORANGE_SOFT, 25, 18)
    stages = [("0101₂", "+5"), ("1010₂", "全ビット反転"), ("1011₂", "+1 → −5")]
    for i, (bits, label) in enumerate(stages):
        x = 120 + i * 205
        f.round((x, 285, x + 165, 370), 12, WHITE, ORANGE, 2)
        f.text((x + 82, 318), bits, 23, NAVY, True, "mm")
        f.text((x + 82, 350), label, 13, MUTED, False, "mm")
        if i < 2:
            f.arrow((x + 176, 327), (x + 197, 327), ORANGE, 3, 9)
    # Float.
    f.card((840, 180, 1530, 430), "IEEE 754 binary32", "例 −46.625：符号1ビット・指数8ビット・仮数23ビット", BLUE, BLUE_SOFT, 25, 15)
    parts = [("符号", "1", 110), ("指数", "10000100", 215), ("仮数", "011101010000…", 295)]
    x = 885
    for label, value, width in parts:
        f.round((x, 310, x + width, 385), 10, WHITE, BLUE, 2)
        f.text((x + 12, 326), label, 13, MUTED, True)
        f.text((x + width / 2, 365), value, 15, NAVY, True, "mm")
        x += width + 12
    # Text codes.
    f.round((70, 500, 1530, 790), 20, WHITE, GREEN, 2)
    f.text((110, 540), "文字コード：文字とビット列の対応表", 25, GREEN, True)
    f.text((130, 650), "ASCII", 22, GREEN, True, "mm")
    f.round((250, 600, 600, 700), 15, GREEN_SOFT, GREEN, 2)
    f.text((425, 650), "0100 1011₂", 27, NAVY, True, "mm")
    f.arrow((620, 650), (760, 650), GREEN, 4, 13)
    f.text((830, 650), "K", 40, GREEN, True, "mm")
    codes = [("JIS", "文字集合・規格"), ("Shift_JIS", "符号化方式"), ("UTF-8", "Webで広く利用")]
    for i, (label, sub) in enumerate(codes):
        x = 930 + i * 185
        f.round((x, 585, x + 165, 715), 14, WHITE, LINE, 1)
        f.text((x + 82, 625), label, 17, NAVY, True, "mm")
        f.text((x + 82, 675), sub, 12, MUTED, False, "mm")
    f.save("digital", "signed-float-text.png")


def digital_logic_adder():
    f = Figure("論理演算を組み合わせて、2進数を加算する", "LOGIC & ADDER", ORANGE)

    def formula(x, y, parts, main_size):
        """Draw carry labels as positioned subscripts without relying on rare glyphs."""
        cursor = x
        for value, is_subscript in parts:
            size = 15 if is_subscript else main_size
            font = f.font(size, True)
            f.text((cursor, y + (10 if is_subscript else 0)), value, size, NAVY, True)
            cursor += f.d.textlength(value, font=font) / S

    gates = [("AND", "両方1なら1", [0, 0, 0, 1], ORANGE), ("OR", "どちらか1なら1", [0, 1, 1, 1], ORANGE), ("XOR", "異なれば1", [0, 1, 1, 0], ORANGE)]
    for i, (label, rule, outputs, color) in enumerate(gates):
        x = 70 + i * 360
        f.round((x, 180, x + 330, 500), 18, WHITE, color, 2)
        f.text((x + 25, 215), label, 24, color, True)
        f.text((x + 25, 255), rule, 15, MUTED)
        headers = ["A", "B", "X"]
        for j, h in enumerate(headers):
            f.text((x + 85 + j * 80, 310), h, 16, NAVY, True, "mm")
        rows = [(0, 0), (0, 1), (1, 0), (1, 1)]
        for r, (a, b) in enumerate(rows):
            y = 355 + r * 33
            vals = [a, b, outputs[r]]
            for j, value in enumerate(vals):
                f.text((x + 85 + j * 80, y), value, 16, NAVY, True, "mm")
    f.round((1150, 180, 1530, 500), 18, WHITE, ORANGE, 2)
    f.text((1190, 215), "NOT", 24, ORANGE, True)
    f.text((1190, 260), "入力を反転", 15, MUTED)
    f.text((1240, 350), "0 → 1", 23, NAVY, True)
    f.text((1240, 420), "1 → 0", 23, NAVY, True)
    f.round((70, 570, 760, 805), 18, WHITE, ORANGE, 2)
    f.text((110, 610), "半加算器", 25, ORANGE, True)
    f.text((110, 670), "和 S = A ⊕ B", 24, NAVY, True)
    f.text((110, 725), "桁上がり C = A · B", 24, NAVY, True)
    f.round((840, 570, 1530, 805), 18, WHITE, ORANGE, 2)
    f.text((880, 610), "全加算器", 25, ORANGE, True)
    formula(880, 670, [("S = A ⊕ B ⊕ C", False), ("in", True)], 23)
    formula(880, 725, [("C", False), ("out", True), (" = A·B + C", False), ("in", True), ("·(A ⊕ B)", False)], 20)
    f.save("digital", "logic-adder.png")


def digital_sound():
    f = Figure("音のデジタル化：標本化 → 量子化 → 符号化", "SOUND DIGITIZATION", ORANGE)
    panels = [(70, 190, 520, 720), (575, 190, 1025, 720), (1080, 190, 1530, 720)]
    labels = [("1 標本化", ORANGE), ("2 量子化", ORANGE), ("3 符号化", ORANGE)]
    for box, (label, color) in zip(panels, labels):
        f.round(box, 18, WHITE, color, 2)
        f.text((box[0] + 28, 225), label, 24, color, True)
    # Panel 1: smooth waveform and equal-time samples.
    points = []
    for i in range(401):
        t = i / 400
        points.extend([105 + t * 380, 455 - 120 * sin(t * 2.4 * pi - 0.7)])
    f.line(tuple(points), ORANGE, 4)
    for i in range(9):
        t = i / 8
        x = 115 + t * 360
        y = 455 - 120 * sin(t * 2.4 * pi - 0.7)
        f.line((x, 610, x, y), "#9ebbd0", 2)
        f.ellipse((x - 6, y - 6, x + 6, y + 6), BLUE, BLUE, 1)
    f.text((295, 665), "一定時間ごとに測る", 16, MUTED, True, "mm")
    # Panel 2: levels and nearest dots.
    levels = [340, 410, 480, 550, 620]
    for yy in levels:
        f.line((615, yy, 985, yy), "#cbded4", 2)
    qvals = [550, 480, 410, 340, 410, 550, 620, 550]
    for i, yy in enumerate(qvals):
        x = 640 + i * 46
        f.ellipse((x - 7, yy - 7, x + 7, yy + 7), BLUE, BLUE, 1)
    f.text((800, 665), "最も近い段階へ割り当てる", 16, MUTED, True, "mm")
    # Panel 3: codes.
    codes = [("段階 0", "000"), ("段階 1", "001"), ("段階 2", "010"), ("段階 3", "011"), ("段階 4", "100")]
    for i, (stage, code) in enumerate(codes):
        y = 320 + i * 70
        f.text((1135, y), stage, 16, MUTED)
        f.round((1300, y - 15, 1465, y + 38), 10, ORANGE_SOFT, ORANGE, 1)
        f.text((1382, y + 11), code, 19, NAVY, True, "mm")
    f.text((1305, 665), "段階番号を2進数で表す", 16, MUTED, True, "mm")
    f.round((250, 770, 1350, 832), 13, ORANGE_SOFT, ORANGE, 1)
    f.text((800, 801), "データ量 = 標本化周波数 × 量子化ビット数 × 時間 × チャンネル数", 18, NAVY, True, "mm")
    f.save("digital", "sound-digitization.png")


def digital_image():
    f = Figure("画像データの表し方は、ラスタとベクタに分かれる", "IMAGE REPRESENTATION", ORANGE)
    f.round((590, 165, 1010, 235), 18, NAVY, NAVY, 1)
    f.text((800, 200), "画像データの表し方", 24, WHITE, True, "mm")
    f.line((800, 235, 800, 275, 400, 275, 400, 315), ORANGE, 3)
    f.line((800, 275, 1200, 275, 1200, 315), ORANGE, 3)

    panels = [(70, 315, 760, 750), (840, 315, 1530, 750)]
    for box in panels:
        f.round(box, 18, WHITE, LINE, 2)
    f.text((110, 350), "ラスタ形式（ビットマップ形式）", 23, NAVY, True)
    f.text((880, 350), "ベクタ形式", 23, NAVY, True)

    grid_x, grid_y, cell = 120, 425, 31
    pattern = ["00111100", "01111110", "11011011", "11111111", "01100110", "00100100"]
    for row_index, row in enumerate(pattern):
        for col_index, bit in enumerate(row):
            fill = BLUE if bit == "1" else "#edf2f4"
            f.rect((grid_x + col_index * cell, grid_y + row_index * cell,
                    grid_x + (col_index + 1) * cell - 2, grid_y + (row_index + 1) * cell - 2), fill, LINE, 1)
    f.text((430, 430), "保存するもの", 15, MUTED, True)
    f.text((430, 468), "画素ごとの色", 19, NAVY, True)
    f.text((430, 525), "拡大", 15, MUTED, True)
    f.text((430, 563), "画素の四角が見える", 17, NAVY, True)
    f.text((430, 620), "主な形式", 15, MUTED, True)
    f.text((430, 658), "JPEG / PNG / GIF / BMP", 16, NAVY, True)
    f.text((430, 705), "写真・スキャン・ペイント", 15, MUTED)

    # ベクタは制御点と数式で定まる滑らかな曲線として示す。
    points = []
    p0, p1, p2, p3 = (900, 640), (1040, 500), (1280, 680), (1440, 455)
    for index in range(101):
        t = index / 100
        x = (1 - t) ** 3 * p0[0] + 3 * (1 - t) ** 2 * t * p1[0] + 3 * (1 - t) * t ** 2 * p2[0] + t ** 3 * p3[0]
        y = (1 - t) ** 3 * p0[1] + 3 * (1 - t) ** 2 * t * p1[1] + 3 * (1 - t) * t ** 2 * p2[1] + t ** 3 * p3[1]
        points.extend([x, y])
    f.line(tuple(points), BLUE, 6)
    f.line((*p0, *p1), "#b7c3c9", 2)
    f.line((*p2, *p3), "#b7c3c9", 2)
    for point in [p0, p1, p2, p3]:
        f.ellipse((point[0] - 8, point[1] - 8, point[0] + 8, point[1] + 8), WHITE, BLUE, 2)
    f.text((890, 395), "保存するもの：点・線・曲線・塗りの座標や式", 16, NAVY, True)
    f.text((890, 685), "拡大しても輪郭が滑らか", 16, NAVY, True)
    f.text((890, 720), "SVG / AI / EPS　｜　ロゴ・図面・アイコン", 15, MUTED)

    f.round((240, 785, 1360, 842), 12, ORANGE_SOFT, ORANGE, 1)
    f.text((800, 813), "ラスタ画像のデジタル化：標本化 → 量子化 → 符号化", 17, NAVY, True, "mm")
    f.save("digital", "image-digitization.png")


def digital_color_models():
    f = Figure("RGBとCMYKは、混ぜたときの明るさが逆になる", "ADDITIVE & SUBTRACTIVE COLOR", ORANGE)

    def exact_region(masks, included):
        selected = [masks[index] for index in included]
        region = selected[0]
        for mask in selected[1:]:
            region = ImageChops.multiply(region, mask)
        excluded = [masks[index] for index in range(3) if index not in included]
        if excluded:
            outside = excluded[0]
            for mask in excluded[1:]:
                outside = ImageChops.lighter(outside, mask)
            region = ImageChops.subtract(region, outside)
        return region

    def paint_mix(centres, radius, palette):
        masks = []
        for cx, cy in centres:
            mask = Image.new("L", f.image.size, 0)
            draw = ImageDraw.Draw(mask)
            draw.ellipse(sc((cx - radius, cy - radius, cx + radius, cy + radius)), fill=255)
            masks.append(mask)
        combinations = [(0,), (1,), (2,), (0, 1), (1, 2), (0, 2), (0, 1, 2)]
        for included, color in zip(combinations, palette):
            f.image.paste(color, (0, 0, f.image.width, f.image.height), exact_region(masks, included))

    f.round((70, 180, 775, 790), 18, "#16242c", "#16242c", 1)
    f.text((110, 220), "RGB：光の加法混色", 24, WHITE, True)
    f.text((110, 260), "光を加えるほど明るくなる", 16, "#c9d3d8")
    rgb_centres = [(285, 455), (505, 455), (395, 600)]
    paint_mix(rgb_centres, 160, ["#ff2b2b", "#20e05a", "#2968ff", "#fff12b", "#22e6ef", "#ff30ec", "#ffffff"])
    for x, y, label in [(190, 410, "R"), (600, 410, "G"), (395, 720, "B")]:
        f.text((x, y), label, 25, WHITE, True, "mm")
    f.text((395, 365), "R+G=Y", 15, NAVY, True, "mm")
    f.text((300, 565), "R+B=M", 15, WHITE, True, "mm")
    f.text((490, 565), "G+B=C", 15, NAVY, True, "mm")
    f.text((395, 505), "白", 18, NAVY, True, "mm")

    f.round((825, 180, 1530, 790), 18, WHITE, LINE, 2)
    f.text((865, 220), "CMYK：インクの減法混色", 24, NAVY, True)
    f.text((865, 260), "光を吸収するほど暗くなる", 16, MUTED)
    cmy_centres = [(1040, 455), (1260, 455), (1150, 600)]
    paint_mix(cmy_centres, 160, ["#00e5ee", "#ff28d4", "#ffe824", "#3158d9", "#ec3232", "#31a85b", "#20262a"])
    for x, y, label, color in [(945, 410, "C", NAVY), (1355, 410, "M", NAVY), (1150, 720, "Y", NAVY)]:
        f.text((x, y), label, 25, color, True, "mm")
    f.text((1150, 365), "C+M=B", 15, WHITE, True, "mm")
    f.text((1055, 565), "C+Y=G", 15, NAVY, True, "mm")
    f.text((1245, 565), "M+Y=R", 15, WHITE, True, "mm")
    f.text((1150, 505), "黒に近づく", 14, WHITE, True, "mm")
    f.round((1330, 695, 1490, 750), 10, "#20262a", "#20262a", 1)
    f.text((1410, 722), "K：黒インク", 14, WHITE, True, "mm")
    f.text((1175, 765), "実際の印刷では黒の再現とインク量のためKを加える", 13, MUTED, False, "mm")
    f.save("digital", "color-models.png")


def digital_computer():
    f = Figure("五大装置とソフトウェア層の関係", "COMPUTER SYSTEM", ORANGE)
    f.card((70, 220, 330, 500), "入力装置", "キーボード・マウス・センサ", BLUE, BLUE_SOFT)
    f.card((1270, 220, 1530, 500), "出力装置", "ディスプレイ・プリンタ", VIOLET, VIOLET_SOFT)
    f.round((510, 190, 1090, 520), 22, WHITE, ORANGE, 3)
    f.text((800, 230), "CPU", 30, ORANGE, True, "mm")
    f.round((550, 285, 775, 420), 15, ORANGE_SOFT, ORANGE, 2)
    f.text((662, 352), "制御装置", 22, NAVY, True, "mm")
    f.round((825, 285, 1050, 420), 15, ORANGE_SOFT, ORANGE, 2)
    f.text((937, 352), "演算装置", 22, NAVY, True, "mm")
    f.arrow((345, 360), (490, 360), BLUE, 4, 13)
    f.arrow((1110, 360), (1250, 360), VIOLET, 4, 13)
    f.round((510, 590, 1090, 735), 18, GREEN_SOFT, GREEN, 2)
    f.text((800, 627), "主記憶装置", 24, GREEN, True, "mm")
    f.text((800, 680), "実行中の命令とデータを保存", 17, MUTED, False, "mm")
    f.arrow((760, 570), (760, 530), GREEN, 4, 12)
    f.arrow((840, 530), (840, 570), GREEN, 4, 12)
    f.round((70, 590, 410, 735), 18, WHITE, LINE, 2)
    f.text((240, 627), "補助記憶装置", 21, NAVY, True, "mm")
    f.text((240, 680), "SSD・HDD", 17, MUTED, False, "mm")
    f.arrow((430, 662), (490, 662), GREEN, 3, 10)
    f.round((1190, 590, 1530, 735), 18, WHITE, LINE, 2)
    f.text((1360, 627), "通信装置", 21, NAVY, True, "mm")
    f.text((1360, 680), "NIC・無線LAN", 17, MUTED, False, "mm")
    f.arrow((1170, 662), (1110, 662), BLUE, 3, 10)
    f.round((300, 790, 1300, 842), 12, "#f1f4f6", LINE, 1)
    f.text((800, 816), "利用者 → アプリ → OS → デバイスドライバ → ハードウェア", 18, NAVY, True, "mm")
    f.save("digital", "computer-system.png")


def digital_performance():
    f = Figure("演算誤差は、発生条件と具体例を対にして覚える", "NUMERICAL ERROR", ORANGE)
    x_positions = [70, 300, 790, 1530]
    headers = ["種類", "何が起こるか", "具体例"]
    for start, end, label in zip(x_positions[:-1], x_positions[1:], headers):
        f.rect((start, 180, end, 235), NAVY, NAVY, 1)
        f.text(((start + end) / 2, 207), label, 17, WHITE, True, "mm")
    rows = [
        ("桁あふれ", "表現できる範囲を超える", "16ビット符号なし：60,000 + 10,000 = 70,000 → 4,464"),
        ("丸め誤差", "有限桁へ丸める", "π = 3.141592… → 3.1416"),
        ("打切り誤差", "無限に続く計算を途中で止める", "1 + 1/2 + 1/4 + 1/8 = 1.875（無限和は2）"),
        ("桁落ち", "近い値の差で有効桁が減る", "√1001 − √1000：0.0158 と 0.0158074…"),
        ("情報落ち", "大きさの違う値の計算で小さい値が消える", "0.8765 + 0.00004321 → 0.8765（有効数字4桁）"),
    ]
    row_height = 105
    for row_index, row in enumerate(rows):
        y1 = 235 + row_index * row_height
        y2 = y1 + row_height
        fill = WHITE if row_index % 2 == 0 else "#f2f5f6"
        for start, end in zip(x_positions[:-1], x_positions[1:]):
            f.rect((start, y1, end, y2), fill, LINE, 1)
        f.text((185, (y1 + y2) / 2), row[0], 17, ORANGE, True, "mm")
        f.wrap((325, y1 + 28), row[1], 440, 15, MUTED, gap=5)
        f.wrap((815, y1 + 28), row[2], 680, 16, NAVY, True, gap=5)
    f.round((245, 790, 1355, 848), 12, ORANGE_SOFT, ORANGE, 1)
    f.text((800, 819), "2進浮動小数点の例：Pythonで 0.1 + 0.2 → 0.30000000000000004", 16, NAVY, True, "mm")
    f.save("digital", "performance-errors.png")


# Network -------------------------------------------------------------------

def network_types():
    f = Figure("LANの内部と、外部ネットワークへの接続を分けて読む", "NETWORK SCOPE", BLUE)
    f.round((70, 175, 1240, 565), 18, WHITE, BLUE, 2)
    f.text((105, 210), "学校LAN：校内で管理する一つのネットワーク", 21, NAVY, True)

    switch = (655, 330, 855, 400)
    f.round(switch, 12, BLUE_SOFT, BLUE, 2)
    f.text((755, 365), "スイッチ", 18, NAVY, True, "mm")
    devices = [
        ((120, 300, 300, 360), "PC"),
        ((120, 430, 300, 490), "プリンタ"),
        ((390, 245, 585, 305), "無線端末"),
        ((655, 245, 855, 305), "アクセスポイント"),
        ((930, 300, 1110, 360), "校内サーバ"),
        ((930, 430, 1110, 490), "ルータ"),
    ]
    for box, label in devices:
        f.round(box, 10, WHITE, LINE, 1)
        f.text(((box[0] + box[2]) / 2, (box[1] + box[3]) / 2), label, 15, NAVY, True, "mm")

    # スイッチを中心に有線機器が放射状につながるスター型を、そのまま配線で示す。
    # 無線端末だけはアクセスポイントを経由し、LANの出口だけがルータになる。
    wired_routes = [
        (300, 330, 655, 348),
        (300, 460, 655, 388),
        (755, 305, 755, 330),
        (855, 350, 930, 330),
        (855, 382, 930, 460),
    ]
    for route in wired_routes:
        f.line(route, BLUE, 3)
    f.line((585, 275, 655, 275), BLUE, 3)
    f.text((620, 250), "Wi-Fi", 13, MUTED, True, "mm")
    f.text((755, 540), "LAN内のフレームは、スイッチが宛先MACアドレスを見て転送", 14, MUTED, True, "mm")

    # LANの境界にあるルータからISPへ出る。
    f.round((1285, 365, 1515, 520), 18, BLUE_SOFT, BLUE, 2)
    f.text((1400, 405), "ISP", 25, BLUE, True, "mm")
    f.text((1400, 450), "インターネットへの", 14, MUTED, True, "mm")
    f.text((1400, 478), "接続サービス", 14, MUTED, True, "mm")
    f.arrow((1110, 460), (1285, 442), BLUE, 4, 12)
    f.text((1190, 420), "LAN外へ", 13, BLUE, True, "mm")

    f.round((70, 620, 760, 825), 18, WHITE, LINE, 2)
    f.text((105, 655), "WAN：離れたLAN同士を結ぶ", 19, NAVY, True)
    for box, label in [((115, 720, 280, 775), "本社LAN"), ((350, 705, 480, 790), "WAN"), ((550, 720, 715, 775), "支社LAN")]:
        f.round(box, 10, BLUE_SOFT if label == "WAN" else WHITE, BLUE, 2)
        f.text(((box[0] + box[2]) / 2, (box[1] + box[3]) / 2), label, 16, NAVY, True, "mm")
    f.line((280, 747, 350, 747), BLUE, 3)
    f.line((480, 747, 550, 747), BLUE, 3)

    f.round((840, 620, 1530, 825), 18, WHITE, LINE, 2)
    f.text((875, 655), "インターネット：多数のネットワークを相互接続", 19, NAVY, True)
    net_nodes = [(930, 745, "家庭"), (1110, 705, "学校"), (1290, 760, "企業"), (1450, 700, "大学")]
    for a, b in [(0, 1), (0, 2), (1, 2), (1, 3), (2, 3)]:
        f.line((net_nodes[a][0], net_nodes[a][1], net_nodes[b][0], net_nodes[b][1]), "#aab8c0", 2)
    for x, y, label in net_nodes:
        f.ellipse((x - 47, y - 30, x + 47, y + 30), WHITE, BLUE, 2)
        f.text((x, y), label, 13, NAVY, True, "mm")
    f.text((1185, 805), "全体を一元管理する主体はいない", 13, MUTED, True, "mm")
    f.save("network", "network-types.png")


def network_processing():
    f = Figure("処理システムを、集中処理と分散処理に分類する", "PROCESSING MODELS", BLUE)
    f.round((620, 165, 980, 220), 14, NAVY, NAVY, 1)
    f.text((800, 192), "処理システム", 22, WHITE, True, "mm")
    f.line((800, 220, 800, 255, 300, 255, 300, 285), BLUE, 3)
    f.line((800, 255, 1100, 255, 1100, 285), BLUE, 3)
    f.round((120, 285, 480, 345), 12, BLUE_SOFT, BLUE, 2)
    f.text((300, 315), "集中処理", 21, NAVY, True, "mm")
    f.round((920, 285, 1280, 345), 12, BLUE_SOFT, BLUE, 2)
    f.text((1100, 315), "分散処理", 21, NAVY, True, "mm")
    f.line((1100, 345, 1100, 380, 820, 380, 820, 410), BLUE, 2)
    f.line((1100, 380, 1340, 380, 1340, 410), BLUE, 2)
    f.round((640, 410, 1000, 465), 11, WHITE, BLUE, 2)
    f.text((820, 437), "クライアントサーバシステム", 16, NAVY, True, "mm")
    f.round((1180, 410, 1500, 465), 11, WHITE, BLUE, 2)
    f.text((1340, 437), "P2P", 18, NAVY, True, "mm")

    panels = [(70, 500, 520, 820), (575, 500, 1065, 820), (1120, 500, 1530, 820)]
    for box in panels:
        f.round(box, 16, WHITE, LINE, 2)

    f.text((105, 535), "中央に処理とデータを集める", 16, NAVY, True)
    f.round((175, 585, 415, 650), 11, ORANGE_SOFT, ORANGE, 2)
    f.text((295, 617), "中央コンピュータ", 16, NAVY, True, "mm")
    for x in [145, 295, 445]:
        f.round((x - 48, 735, x + 48, 780), 9, WHITE, LINE, 1)
        f.text((x, 757), "端末", 12, NAVY, True, "mm")
        f.poly_arrow([(x, 725), (x, 690), (295, 690), (295, 662)], BLUE, 2, 7)
    f.text((295, 800), "中央障害の影響が大きい", 12, MUTED, True, "mm")

    f.text((610, 535), "要求する側と提供する側に役割分担", 15, NAVY, True)
    f.round((720, 590, 920, 650), 11, BLUE_SOFT, BLUE, 2)
    f.text((820, 620), "サーバ", 17, NAVY, True, "mm")
    for x in [650, 820, 990]:
        f.round((x - 58, 735, x + 58, 780), 9, WHITE, LINE, 1)
        f.text((x, 757), "クライアント", 11, NAVY, True, "mm")
        f.poly_arrow([(x, 725), (x, 690), (820, 690), (820, 662)], BLUE, 2, 7)
    f.text((820, 800), "Web・メール・データベースなど", 12, MUTED, True, "mm")

    f.text((1155, 535), "各ピアが利用側にも提供側にもなる", 14, NAVY, True)
    peers = [(1215, 635), (1430, 635), (1322, 745)]
    for start, end in [(peers[0], peers[1]), (peers[0], peers[2]), (peers[1], peers[2])]:
        f.line((*start, *end), BLUE, 3)
    for index, (x, y) in enumerate(peers):
        f.ellipse((x - 50, y - 34, x + 50, y + 34), WHITE, BLUE, 2)
        f.text((x, y), f"ピア{index + 1}", 13, NAVY, True, "mm")
    f.text((1322, 800), "対等な端末間で直接やり取り", 12, MUTED, True, "mm")
    f.save("network", "processing-models.png")


def network_layers():
    f = Figure("TCP/IPの4階層は、担当する範囲が異なる", "TCP/IP LAYERS", BLUE)
    layers = [
        ("4", "アプリケーション層", "HTTP・HTTPS・SMTP・POP3・IMAP・DNS", BLUE, WHITE),
        ("3", "トランスポート層", "TCP：到達確認・再送　／　UDP：コネクションレス", BLUE, WHITE),
        ("2", "インターネット層", "IPアドレスを基に宛先ネットワークまで運ぶ", BLUE, WHITE),
        ("1", "ネットワークインターフェース層", "Ethernet・Wi-Fi。隣接機器との伝送", BLUE, WHITE),
    ]
    for i, (number, label, examples, color, fill) in enumerate(layers):
        y = 180 + i * 157
        f.round((100, y, 1500, y + 125), 17, fill, color, 2)
        f.round((130, y + 25, 215, y + 100), 13, WHITE, color, 2)
        f.text((172, y + 62), number, 24, color, True, "mm")
        f.text((260, y + 35), label, 25, color, True)
        f.text((260, y + 82), examples, 17, MUTED)
        if i < 3:
            f.arrow((800, y + 135), (800, y + 148), NAVY, 3, 8)
    f.round((180, 820, 1420, 865), 11, NAVY, NAVY, 1)
    f.text((800, 842), "上位層は下位層の機能を利用し、同じ層どうしが規約に沿って通信する", 17, WHITE, True, "mm")
    f.save("network", "tcpip-layers.png")


def encapsulation_frame(step):
    f = Figure("TCP/IPのカプセル化と受信側での取り外し", f"ENCAPSULATION · STEP {step + 1}/6", BLUE)
    labels = ["HTTP DATA", "TCP", "IP", "ETH", "IP", "HTTP DATA"]
    descriptions = [
        "アプリケーションがデータを作る",
        "TCPヘッダを付けてセグメントにする",
        "IPヘッダを付けてパケットにする",
        "リンク用情報を付けてフレームとして送る",
        "受信側で下位層からヘッダを外す",
        "アプリケーションへ元のデータを渡す",
    ]
    stages = [(190, "送信アプリ"), (425, "TCP"), (660, "IP"), (895, "Ethernet"), (1130, "受信側"), (1365, "受信アプリ")]
    for i, (x, title) in enumerate(stages):
        color = BLUE if i == step else "#aab8c0"
        fill = BLUE_SOFT if i == step else WHITE
        f.round((x - 90, 250, x + 90, 345), 14, fill, color, 3 if i == step else 1)
        f.text((x, 297), title, 17, color if i == step else MUTED, True, "mm")
        if i < len(stages) - 1:
            f.arrow((x + 105, 297), (stages[i + 1][0] - 105, 297), BLUE if i < step else "#c3ccd1", 3, 10)
    f.round((130, 430, 1470, 650), 20, WHITE, BLUE, 2)
    segments = []
    if step == 0:
        segments = [("HTTP DATA", BLUE, 760)]
    elif step == 1:
        segments = [("TCP", VIOLET, 300), ("HTTP DATA", BLUE, 760)]
    elif step == 2:
        segments = [("IP", GREEN, 260), ("TCP", VIOLET, 280), ("HTTP DATA", BLUE, 700)]
    elif step == 3:
        segments = [("ETH", ORANGE, 210), ("IP", GREEN, 220), ("TCP", VIOLET, 240), ("HTTP DATA", BLUE, 590)]
    elif step == 4:
        segments = [("IP", GREEN, 260), ("TCP", VIOLET, 280), ("HTTP DATA", BLUE, 700)]
    else:
        segments = [("HTTP DATA", BLUE, 760)]
    total = sum(width for _, _, width in segments) + 8 * (len(segments) - 1)
    x = 800 - total / 2
    for label, color, width in segments:
        f.round((x, 500, x + width, 585), 11, color, color, 1)
        f.text((x + width / 2, 542), label, 18, WHITE, True, "mm")
        x += width + 8
    f.round((250, 735, 1350, 815), 14, BLUE_SOFT, BLUE, 1)
    f.text((800, 775), descriptions[step], 21, NAVY, True, "mm")
    return f.image.resize((W, H), Image.Resampling.LANCZOS)


def network_encapsulation_gif():
    frames = [encapsulation_frame(i) for i in range(6)]
    path = OUT / "network" / "tcpip-encapsulation.gif"
    path.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=[1100] * 6, loop=0, disposal=2)


def network_addressing():
    f = Figure("IPアドレスとMACアドレスは、届く範囲が異なる", "IP · MAC · NAT", BLUE)
    f.round((70, 180, 1040, 815), 18, WHITE, BLUE, 2)
    f.text((105, 220), "宛先IPは終点まで、宛先MACは1区間ごと", 22, NAVY, True)
    nodes = [
        (175, "送信端末", "192.168.1.20"),
        (555, "ルータ", "LANの出口"),
        (935, "受信サーバ", "203.0.113.80"),
    ]
    for index, (x, label, sub) in enumerate(nodes):
        f.round((x - 105, 290, x + 105, 390), 13, BLUE_SOFT if index != 1 else WHITE, BLUE, 2)
        f.text((x, 320), label, 16, NAVY, True, "mm")
        f.text((x, 360), sub, 13, MUTED, False, "mm")
    f.arrow((280, 340), (450, 340), BLUE, 4, 12)
    f.arrow((660, 340), (830, 340), BLUE, 4, 12)

    f.text((105, 455), "IPパケット", 17, BLUE, True)
    f.round((250, 425, 915, 495), 11, BLUE_SOFT, BLUE, 2)
    f.text((582, 460), "送信元 192.168.1.20　→　宛先 203.0.113.80", 17, NAVY, True, "mm")
    f.text((582, 520), "ルータを通っても、宛先IPは203.0.113.80のまま", 14, MUTED, True, "mm")

    f.text((105, 585), "リンクごとのフレーム", 17, BLUE, True)
    frames = [
        ((105, 630, 500, 715), "区間1", "宛先MAC＝ルータのMAC"),
        ((610, 630, 1005, 715), "区間2", "宛先MAC＝次の機器のMAC"),
    ]
    for box, label, detail in frames:
        f.round(box, 11, WHITE, LINE, 2)
        f.text((box[0] + 22, box[1] + 20), label, 14, BLUE, True)
        f.text(((box[0] + box[2]) / 2, box[1] + 57), detail, 14, NAVY, True, "mm")
    f.arrow((500, 672), (610, 672), BLUE, 3, 10)
    f.text((555, 745), "MACアドレスを付け替える", 13, MUTED, True, "mm")

    f.round((1090, 180, 1530, 815), 18, WHITE, ORANGE, 2)
    f.text((1125, 220), "NAT", 24, ORANGE, True)
    f.wrap((1125, 265), "ルータが、LAN内のプライベートIPアドレスと外部通信用のグローバルIPアドレスを対応づける。", 360, 15, MUTED, gap=7)
    f.round((1150, 430, 1470, 505), 12, ORANGE_SOFT, ORANGE, 2)
    f.text((1310, 455), "LAN内", 14, MUTED, True, "mm")
    f.text((1310, 485), "192.168.1.20", 19, NAVY, True, "mm")
    f.arrow((1310, 505), (1310, 635), ORANGE, 4, 12)
    f.round((1150, 635, 1470, 710), 12, ORANGE_SOFT, ORANGE, 2)
    f.text((1310, 660), "インターネット側", 14, MUTED, True, "mm")
    f.text((1310, 690), "203.0.113.10", 19, NAVY, True, "mm")
    f.text((1310, 765), "IPv4アドレス不足を緩和", 14, ORANGE, True, "mm")
    f.save("network", "addressing.png")


def routing_frame(frame_index):
    f = Figure("網状の経路を、パケットがルータごとに中継される", f"PACKET RELAY · STEP {frame_index + 1}/13", BLUE)
    nodes = {
        "送信端末": (120, 690),
        "R1": (315, 620),
        "R2": (520, 390),
        "R3": (560, 660),
        "R4": (780, 270),
        "R5": (820, 520),
        "R6": (1070, 260),
        "R7": (1080, 610),
        "R8": (1300, 390),
        "受信サーバ": (1480, 265),
    }
    edges = [
        ("送信端末", "R1"), ("R1", "R2"), ("R1", "R3"),
        ("R2", "R4"), ("R2", "R5"), ("R3", "R5"), ("R3", "R7"),
        ("R4", "R5"), ("R4", "R6"), ("R5", "R6"), ("R5", "R7"),
        ("R6", "R8"), ("R7", "R8"), ("R8", "受信サーバ"),
    ]
    route = ["送信端末", "R1", "R2", "R5", "R7", "R8", "受信サーバ"]
    route_edges = list(zip(route, route[1:]))
    completed = frame_index // 2
    on_link = frame_index % 2 == 1

    for start, end in edges:
        color = BLUE if (start, end) in route_edges[:completed] else "#bcc8ce"
        width = 5 if (start, end) in route_edges[:completed] else 3
        f.line((*nodes[start], *nodes[end]), color, width)

    active_name = route[min(completed, len(route) - 1)]
    for name, (x, y) in nodes.items():
        if name in {"送信端末", "受信サーバ"}:
            box = (x - 82, y - 38, x + 82, y + 38)
            active = name == active_name and not on_link
            f.round(box, 12, ORANGE_SOFT if active else WHITE, ORANGE if active else BLUE, 3 if active else 2)
            f.text((x, y), name, 13, NAVY, True, "mm")
        else:
            active = name == active_name and not on_link
            f.ellipse((x - 42, y - 42, x + 42, y + 42), ORANGE_SOFT if active else WHITE, ORANGE if active else BLUE, 4 if active else 2)
            f.line((x - 20, y, x + 20, y), ORANGE if active else BLUE, 2)
            f.line((x, y - 20, x, y + 20), ORANGE if active else BLUE, 2)
            f.text((x, y + 58), name, 13, NAVY, True, "mm")

    if on_link and completed < len(route_edges):
        start, end = route_edges[completed]
        x = (nodes[start][0] + nodes[end][0]) / 2
        y = (nodes[start][1] + nodes[end][1]) / 2
        f.round((x - 54, y - 24, x + 54, y + 24), 9, ORANGE, ORANGE, 1)
        f.text((x, y), "PACKET", 12, WHITE, True, "mm")
        description = f"{start} が経路表を参照し、次の中継先 {end} へパケットを渡す"
    elif completed == 0:
        description = "送信端末が、宛先IPアドレスを入れたパケットをルータR1へ渡す"
    elif completed >= len(route) - 1:
        description = "複数のルータによる中継を経て、パケットが受信サーバへ到着する"
    else:
        description = f"{active_name} がパケットを受信。次に送るルータだけを経路表から選ぶ"

    f.round((180, 780, 1420, 842), 13, ORANGE_SOFT, ORANGE, 1)
    f.text((800, 811), description, 17, NAVY, True, "mm")
    f.text((800, 750), "灰色の線は利用可能な別経路。通信前に1本の回線を占有するわけではない。", 14, MUTED, True, "mm")
    return f.image.resize((W, H), Image.Resampling.LANCZOS)


def network_routing_gif():
    frames = [routing_frame(index) for index in range(13)]
    path = OUT / "network" / "packet-routing.gif"
    path.parent.mkdir(parents=True, exist_ok=True)
    durations = [950 if index % 2 == 0 else 650 for index in range(13)]
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=durations, loop=0, disposal=2)


def dns_frame(step):
    f = Figure("DNS：名前をIPアドレスへ変換する", f"DNS RESOLUTION · STEP {step + 1}/8", BLUE)
    nodes = {
        "client": (170, 670, "端末", "www.example.jp"),
        "cache": (510, 670, "キャッシュDNS", "問い合わせを代行"),
        "root": (510, 280, "ルートDNS", ".jpの場所を案内"),
        "tld": (900, 280, "jp DNS", "example.jpを案内"),
        "auth": (1290, 280, "権威DNS", "正式な対応を保持"),
        "web": (1290, 670, "Webサーバ", "203.0.113.80"),
    }
    active_nodes = [
        ("client", "cache"), ("cache", "root"), ("root", "cache"), ("cache", "tld"),
        ("tld", "cache"), ("cache", "auth"), ("auth", "cache"), ("cache", "client")
    ][step]
    for key, (x, y, label, sub) in nodes.items():
        active = key in active_nodes
        f.round((x - 125, y - 65, x + 125, y + 65), 16, BLUE_SOFT if active else WHITE, BLUE if active else "#aab8c0", 3 if active else 1)
        f.text((x, y - 18), label, 18, NAVY if active else MUTED, True, "mm")
        f.text((x, y + 25), sub, 13, MUTED, False, "mm")
    # Static links end at card boundaries so they never run underneath labels.
    static_edges = [
        ((295, 670), (385, 670)),
        ((510, 605), (510, 345)),
        ((635, 280), (775, 280)),
        ((1025, 280), (1165, 280)),
        ((1290, 345), (1290, 605)),
    ]
    for start, end in static_edges:
        f.line((*start, *end), "#c5ced3", 3)

    # Referral traffic uses separate horizontal lanes in the empty middle area.
    active_paths = [
        [(295, 670), (385, 670)],
        [(510, 605), (510, 345)],
        [(510, 345), (510, 605)],
        [(510, 605), (510, 545), (900, 545), (900, 345)],
        [(900, 345), (900, 545), (510, 545), (510, 605)],
        [(510, 605), (510, 500), (1290, 500), (1290, 345)],
        [(1290, 345), (1290, 500), (510, 500), (510, 605)],
        [(385, 670), (295, 670)],
    ]
    f.poly_arrow(active_paths[step], ORANGE, 5, 15)
    descriptions = [
        "端末が設定済みのキャッシュDNSへ問い合わせる",
        "キャッシュになければルートDNSへ問い合わせる",
        "ルートDNSが.jpを管理するDNSを案内する",
        "キャッシュDNSが.jp DNSへ問い合わせる",
        "jp DNSがexample.jpの権威DNSを案内する",
        "キャッシュDNSが権威DNSへ問い合わせる",
        "権威DNSが203.0.113.80を返す",
        "キャッシュDNSが結果を端末へ返し、TTLの間保存する",
    ]
    f.round((180, 780, 1420, 840), 13, ORANGE_SOFT, ORANGE, 1)
    f.text((800, 810), descriptions[step], 18, NAVY, True, "mm")
    return f.image.resize((W, H), Image.Resampling.LANCZOS)


def network_dns_gif():
    frames = [dns_frame(i) for i in range(8)]
    path = OUT / "network" / "dns-resolution.gif"
    path.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=[1050] * 8, loop=0, disposal=2)


def network_information_system():
    f = Figure("情報システムは、人・手続き・技術をつなぐ", "INFORMATION SYSTEM", BLUE)
    items = [
        ("入力", "利用者・センサ・外部データ", BLUE, BLUE_SOFT),
        ("処理", "検証・計算・判断・業務ルール", GREEN, GREEN_SOFT),
        ("保存", "DB・履歴・バックアップ", ORANGE, ORANGE_SOFT),
        ("出力", "画面・帳票・通知・他システム", VIOLET, VIOLET_SOFT),
    ]
    horizontal_cards(f, items, top=230, bottom=520, gap=52)
    f.arrow((1350, 560), (1350, 685), NAVY, 3, 11)
    f.arrow((1350, 685), (250, 685), NAVY, 3, 11)
    f.arrow((250, 685), (250, 560), NAVY, 3, 11)
    f.round((540, 635, 1060, 750), 16, WHITE, BLUE, 2)
    f.text((800, 675), "評価・フィードバック", 22, BLUE, True, "mm")
    f.text((800, 715), "出力を基に入力・処理・手順を改善", 15, MUTED, False, "mm")
    f.text((800, 830), "構成要素：人・業務手順・データ・ソフトウェア・ハードウェア・ネットワーク", 17, NAVY, True, "mm")
    f.save("network", "information-system.png")


def network_database():
    f = Figure("同じ事実を一度だけ保存し、キーで表を結ぶ", "RELATIONAL DATABASE", BLUE)

    def draw_table(box, title, headers, rows, widths, header_fills=None, repeated=None):
        x1, y1, x2, y2 = box
        f.text((x1, y1 - 38), title, 20, NAVY, True)
        row_height = (y2 - y1) / (len(rows) + 1)
        x = x1
        for index, (header, width) in enumerate(zip(headers, widths)):
            fill = (header_fills or {}).get(index, "#eef2f4")
            f.rect((x, y1, x + width, y1 + row_height), fill, LINE, 1)
            f.text((x + width / 2, y1 + row_height / 2), header, 13, NAVY, True, "mm")
            x += width
        for row_index, row in enumerate(rows):
            x = x1
            top = y1 + row_height * (row_index + 1)
            for col_index, (value, width) in enumerate(zip(row, widths)):
                fill = ORANGE_SOFT if repeated and (row_index, col_index) in repeated else WHITE
                f.rect((x, top, x + width, top + row_height), fill, LINE, 1)
                f.text((x + width / 2, top + row_height / 2), value, 13, NAVY, False, "mm")
                x += width

    f.round((70, 190, 720, 760), 18, WHITE, LINE, 2)
    f.text((105, 225), "正規化前：部活の事実が学生ごとに重複", 19, ORANGE, True)
    before_rows = [("10001", "青木", "野球部", "田中"), ("10002", "佐藤", "野球部", "田中"), ("10003", "伊藤", "将棋部", "高橋")]
    repeated = {(0, 2), (0, 3), (1, 2), (1, 3)}
    draw_table((105, 320, 685, 540), "学生・部活表", ["学籍番号", "氏名", "部活名", "顧問"], before_rows,
               [145, 115, 155, 165], repeated=repeated)
    f.wrap((105, 600), "野球部の顧問が変わると、複数行を直す必要があり、更新漏れで矛盾が起こる。", 560, 16, MUTED, gap=6)
    f.arrow((740, 470), (810, 470), ORANGE, 4, 12)
    f.text((775, 430), "表を分ける", 14, ORANGE, True, "mm")

    f.round((830, 190, 1530, 760), 18, WHITE, LINE, 2)
    f.text((865, 225), "正規化後：学生表から部活表を参照", 19, BLUE, True)
    draw_table((865, 300, 1495, 440), "学生表", ["学籍番号 (PK)", "氏名", "部活ID (FK)"],
               [("10001", "青木", "A"), ("10002", "佐藤", "A"), ("10003", "伊藤", "B")],
               [230, 170, 230], header_fills={0: BLUE_SOFT, 2: BLUE_SOFT})
    draw_table((865, 555, 1495, 670), "部活表", ["部活ID (PK)", "部活名", "顧問"],
               [("A", "野球部", "田中"), ("B", "将棋部", "高橋")],
               [210, 220, 200], header_fills={0: BLUE_SOFT})
    f.poly_arrow([(1380, 440), (1380, 500), (970, 500), (970, 548)], BLUE, 3, 10)
    f.text((1175, 480), "外部キーが主キーを参照", 14, BLUE, True, "mm")
    f.text((1180, 715), "PK：行を一意に識別　／　FK：別表の行を指す", 14, MUTED, True, "mm")
    f.text((800, 835), "必要なときは共通するキーで結合し、1つの表として表示する", 17, NAVY, True, "mm")
    f.save("network", "database.png")


def network_security():
    f = Figure("情報セキュリティの3要素と、多層防御", "CIA & DEFENCE", BLUE)
    cia = [("C", "機密性", "許可された人だけ", BLUE, WHITE), ("I", "完全性", "正しく改ざんがない", BLUE, WHITE), ("A", "可用性", "必要なとき使える", BLUE, WHITE)]
    for i, (letter, label, body, color, fill) in enumerate(cia):
        x = 70 + i * 420
        f.round((x, 185, x + 380, 415), 18, fill, color, 2)
        f.ellipse((x + 30, 225, x + 120, 315), WHITE, color, 3)
        f.text((x + 75, 270), letter, 30, color, True, "mm")
        f.text((x + 145, 225), label, 24, color, True)
        f.wrap((x + 145, 275), body, 190, 16, MUTED)
    f.round((70, 485, 1530, 815), 18, WHITE, LINE, 2)
    f.text((110, 525), "脅威", 20, ORANGE, True)
    f.text((865, 525), "対策", 20, GREEN, True)
    rows = [("総当たり・漏えい", "長い固有パスワード・多要素認証"), ("フィッシング", "送信元・URL・証明書を確認"), ("マルウェア", "更新・権限最小化・バックアップ"), ("不正アクセス", "認証・アクセス制御・監視")]
    for i, (threat, defence) in enumerate(rows):
        y = 590 + i * 52
        f.round((110, y, 650, y + 40), 9, ORANGE_SOFT, ORANGE, 1)
        f.text((380, y + 20), threat, 15, NAVY, True, "mm")
        f.arrow((675, y + 20), (815, y + 20), ORANGE, 3, 10)
        f.round((840, y, 1490, y + 40), 9, GREEN_SOFT, GREEN, 1)
        f.text((1165, y + 20), defence, 15, NAVY, True, "mm")
    f.save("network", "security-cia.png")


def network_crypto():
    f = Figure("誰が鍵を用意し、どの鍵で暗号化・復号するか", "SYMMETRIC & PUBLIC KEY", BLUE)
    f.text((1280, 110), "青＝公開してよい鍵　橙＝秘密に保つ鍵", 13, MUTED, True, "mm")

    f.round((70, 180, 1530, 450), 18, WHITE, BLUE, 2)
    f.text((105, 215), "共通鍵暗号", 24, BLUE, True)
    f.text((105, 255), "通信を始める前に、送信者と受信者が同じ秘密鍵Kを安全な方法で共有する", 15, MUTED)
    f.round((115, 310, 345, 390), 12, WHITE, LINE, 2)
    f.text((230, 350), "送信者", 18, NAVY, True, "mm")
    f.round((425, 300, 650, 400), 12, ORANGE_SOFT, ORANGE, 2)
    f.text((537, 330), "秘密鍵 K", 17, ORANGE, True, "mm")
    f.text((537, 372), "平文を暗号化", 14, NAVY, True, "mm")
    f.round((730, 310, 960, 390), 12, NAVY, NAVY, 1)
    f.text((845, 350), "暗号文", 18, WHITE, True, "mm")
    f.round((1040, 300, 1265, 400), 12, ORANGE_SOFT, ORANGE, 2)
    f.text((1152, 330), "同じ秘密鍵 K", 17, ORANGE, True, "mm")
    f.text((1152, 372), "暗号文を復号", 14, NAVY, True, "mm")
    f.round((1345, 310, 1490, 390), 12, WHITE, LINE, 2)
    f.text((1417, 350), "受信者", 17, NAVY, True, "mm")
    for start, end in [((345, 350), (425, 350)), ((650, 350), (730, 350)), ((960, 350), (1040, 350)), ((1265, 350), (1345, 350))]:
        f.arrow(start, end, BLUE, 3, 10)

    f.round((70, 500, 1530, 835), 18, WHITE, BLUE, 2)
    f.text((105, 535), "公開鍵暗号", 24, BLUE, True)
    f.text((105, 575), "①受信者が鍵ペアを作る　②公開鍵だけを送信者へ渡す　③秘密鍵は受信者だけが保管する", 15, MUTED)
    f.round((1130, 525, 1490, 595), 11, WHITE, BLUE, 2)
    f.text((1310, 560), "受信者が鍵ペアを生成", 16, NAVY, True, "mm")
    f.round((830, 610, 1040, 670), 10, BLUE_SOFT, BLUE, 2)
    f.text((935, 640), "受信者の公開鍵", 13, BLUE, True, "mm")
    f.round((1190, 610, 1450, 670), 10, ORANGE_SOFT, ORANGE, 2)
    f.text((1320, 640), "受信者の秘密鍵（非公開）", 13, ORANGE, True, "mm")
    f.line((1310, 595, 1310, 603, 935, 603, 935, 610), BLUE, 2)
    f.line((1310, 603, 1320, 603, 1320, 610), ORANGE, 2)

    # 本文の流れは左から右。公開鍵と秘密鍵は、それぞれ使う処理へ上から接続する。
    flow_boxes = [
        ((105, 710, 290, 780), "送信者の平文", WHITE, LINE),
        ((380, 695, 635, 795), "受信者の公開鍵で\n暗号化", BLUE_SOFT, BLUE),
        ((725, 710, 875, 780), "暗号文", NAVY, NAVY),
        ((965, 695, 1205, 795), "受信者の秘密鍵で\n復号", ORANGE_SOFT, ORANGE),
        ((1295, 710, 1490, 780), "受信者の平文", WHITE, LINE),
    ]
    for box, label, fill, outline in flow_boxes:
        f.round(box, 11, fill, outline, 2)
        for line_index, line in enumerate(label.split("\n")):
            color = WHITE if fill == NAVY else NAVY
            f.text(((box[0] + box[2]) / 2, (box[1] + box[3]) / 2 + (line_index - (len(label.split("\n")) - 1) / 2) * 24), line, 13, color, True, "mm")
    for start, end in [((290, 745), (380, 745)), ((635, 745), (725, 745)), ((875, 745), (965, 745)), ((1205, 745), (1295, 745))]:
        f.arrow(start, end, BLUE, 3, 9)
    f.poly_arrow([(830, 640), (650, 640), (650, 680), (507, 680), (507, 695)], BLUE, 3, 9)
    f.text((730, 615), "送信者へ配布", 12, BLUE, True, "mm")
    f.poly_arrow([(1320, 670), (1320, 680), (1085, 680), (1085, 695)], ORANGE, 3, 9)
    f.text((1320, 815), "秘密鍵は通信路へ出さない", 13, ORANGE, True, "mm")
    f.save("network", "cryptography.png")


def network_hybrid():
    f = Figure("ハイブリッド暗号は、鍵の共有と本文の暗号化を分担する", "HYBRID ENCRYPTION", BLUE)
    f.text((1260, 110), "青＝公開鍵　橙＝秘密鍵・セッション鍵", 13, MUTED, True, "mm")
    f.round((70, 180, 730, 345), 16, WHITE, BLUE, 2)
    f.text((105, 215), "送信者の準備", 20, NAVY, True)
    f.round((105, 260, 430, 315), 10, ORANGE_SOFT, ORANGE, 2)
    f.text((267, 287), "① 一時的なセッション鍵 K を生成", 15, NAVY, True, "mm")
    f.text((455, 287), "通信ごとに新しくする", 13, MUTED, True, "lm")

    f.round((870, 180, 1530, 345), 16, WHITE, BLUE, 2)
    f.text((905, 215), "受信者の準備", 20, NAVY, True)
    f.round((905, 260, 1170, 315), 10, BLUE_SOFT, BLUE, 2)
    f.text((1037, 287), "② 公開鍵", 15, BLUE, True, "mm")
    f.round((1210, 260, 1490, 315), 10, ORANGE_SOFT, ORANGE, 2)
    f.text((1350, 287), "秘密鍵（非公開）", 15, ORANGE, True, "mm")
    f.poly_arrow([(905, 287), (810, 287), (810, 385), (560, 385)], BLUE, 4, 12)
    f.text((690, 360), "公開鍵だけを送信者へ", 13, BLUE, True, "mm")

    f.round((70, 420, 1530, 610), 16, WHITE, LINE, 2)
    f.text((105, 455), "セッション鍵を安全に届ける", 19, NAVY, True)
    steps = [
        ((120, 505, 390, 565), "セッション鍵 K"),
        ((465, 490, 765, 580), "③ 受信者の公開鍵で\nKを暗号化"),
        ((840, 505, 1055, 565), "暗号化されたK"),
        ((1130, 490, 1450, 580), "④ 受信者の秘密鍵で\nKを復号"),
    ]
    for index, (box, label) in enumerate(steps):
        accent = ORANGE if index in {0, 3} else BLUE
        f.round(box, 11, ORANGE_SOFT if index == 0 else WHITE, accent, 2)
        lines = label.split("\n")
        for line_index, line in enumerate(lines):
            f.text(((box[0] + box[2]) / 2, (box[1] + box[3]) / 2 + (line_index - (len(lines) - 1) / 2) * 24), line, 14, NAVY, True, "mm")
        if index < len(steps) - 1:
            f.arrow((box[2], (box[1] + box[3]) / 2), (steps[index + 1][0][0], (steps[index + 1][0][1] + steps[index + 1][0][3]) / 2), BLUE, 3, 10)

    f.round((70, 655, 1530, 825), 16, WHITE, BLUE, 2)
    f.text((105, 690), "⑤ 以後の本文は、両者が共有できた同じセッション鍵Kで暗号化・復号", 18, NAVY, True)
    f.round((120, 735, 360, 790), 10, WHITE, LINE, 1)
    f.text((240, 762), "平文", 16, NAVY, True, "mm")
    f.round((470, 725, 750, 800), 10, ORANGE_SOFT, ORANGE, 2)
    f.text((610, 750), "セッション鍵 K", 15, ORANGE, True, "mm")
    f.text((610, 780), "高速な共通鍵暗号", 13, MUTED, True, "mm")
    f.round((860, 735, 1080, 790), 10, NAVY, NAVY, 1)
    f.text((970, 762), "暗号文", 16, WHITE, True, "mm")
    f.round((1190, 725, 1470, 800), 10, ORANGE_SOFT, ORANGE, 2)
    f.text((1330, 750), "同じセッション鍵 K", 15, ORANGE, True, "mm")
    f.text((1330, 780), "受信者が復号", 13, MUTED, True, "mm")
    f.arrow((360, 762), (470, 762), BLUE, 3, 10)
    f.arrow((750, 762), (860, 762), BLUE, 3, 10)
    f.arrow((1080, 762), (1190, 762), BLUE, 3, 10)
    f.save("network", "hybrid-encryption.png")


def network_signature():
    f = Figure("デジタル署名は、署名者と改ざんの有無を検証する", "DIGITAL SIGNATURE", BLUE)
    f.text((1260, 110), "青＝公開鍵　橙＝秘密鍵", 13, MUTED, True, "mm")
    f.round((70, 175, 1530, 280), 15, WHITE, LINE, 2)
    f.text((105, 205), "事前準備", 18, NAVY, True)
    f.text((105, 245), "署名者が鍵ペアを生成し、秘密鍵は自分だけで保管。公開鍵は証明書などで検証者へ届ける。", 16, MUTED)
    f.round((1135, 195, 1300, 255), 10, ORANGE_SOFT, ORANGE, 2)
    f.text((1217, 225), "署名者の秘密鍵", 13, ORANGE, True, "mm")
    f.round((1330, 195, 1495, 255), 10, BLUE_SOFT, BLUE, 2)
    f.text((1412, 225), "署名者の公開鍵", 13, BLUE, True, "mm")

    f.round((70, 320, 760, 810), 17, WHITE, BLUE, 2)
    f.text((105, 355), "署名者（送信者）", 21, NAVY, True)
    f.round((105, 420, 300, 485), 10, WHITE, LINE, 2)
    f.text((202, 452), "送る本文", 16, NAVY, True, "mm")
    f.arrow((300, 452), (405, 452), BLUE, 3, 10)
    f.round((405, 405, 695, 500), 11, WHITE, BLUE, 2)
    f.text((550, 432), "① ハッシュ関数", 15, BLUE, True, "mm")
    f.text((550, 472), "本文の要約値を計算", 14, NAVY, True, "mm")
    f.arrow((550, 500), (550, 575), BLUE, 3, 10)
    f.round((405, 575, 695, 670), 11, ORANGE_SOFT, ORANGE, 2)
    f.text((550, 602), "② 署名者の秘密鍵", 15, ORANGE, True, "mm")
    f.text((550, 642), "要約値から署名を作る", 14, NAVY, True, "mm")
    f.round((115, 710, 690, 770), 11, BLUE_SOFT, BLUE, 2)
    f.text((402, 740), "③ 本文 ＋ デジタル署名を送信", 16, NAVY, True, "mm")

    f.round((840, 320, 1530, 810), 17, WHITE, BLUE, 2)
    f.text((875, 355), "検証者（受信者）", 21, NAVY, True)
    f.round((885, 410, 1075, 475), 10, WHITE, LINE, 2)
    f.text((980, 442), "受信した本文", 15, NAVY, True, "mm")
    f.arrow((1075, 442), (1180, 442), BLUE, 3, 10)
    f.round((1180, 395, 1475, 490), 11, WHITE, BLUE, 2)
    f.text((1327, 422), "④ ハッシュ関数", 15, BLUE, True, "mm")
    f.text((1327, 462), "本文から要約値 A", 14, NAVY, True, "mm")
    f.round((885, 560, 1075, 625), 10, WHITE, LINE, 2)
    f.text((980, 592), "受信した署名", 15, NAVY, True, "mm")
    f.arrow((1075, 592), (1180, 592), BLUE, 3, 10)
    f.round((1180, 540, 1475, 655), 11, BLUE_SOFT, BLUE, 2)
    f.text((1327, 568), "⑤ 署名検証アルゴリズム", 15, BLUE, True, "mm")
    f.text((1327, 603), "公開鍵・署名・要約値 Aを使う", 13, NAVY, True, "mm")
    f.text((1327, 632), "結果は有効／無効", 13, MUTED, True, "mm")
    f.arrow((1327, 490), (1327, 540), BLUE, 3, 10)
    f.arrow((1327, 655), (1327, 700), BLUE, 3, 10)
    f.round((1125, 700, 1475, 770), 11, GREEN_SOFT, GREEN, 2)
    f.text((1300, 724), "検証に成功", 16, GREEN, True, "mm")
    f.text((1300, 752), "署名後の改ざんがないと確認", 13, NAVY, True, "mm")
    f.save("network", "digital-signature.png")


def network_rsa():
    f = Figure("RSAは、公開鍵暗号方式の具体例の一つ", "RSA · LEARNING EXAMPLE", BLUE)
    f.round((70, 180, 1530, 285), 15, ORANGE_SOFT, ORANGE, 2)
    f.text((800, 217), "学習用の非常に小さな数の例。実際のRSAは巨大な素数と安全なパディングを使う。", 17, NAVY, True, "mm")
    f.text((800, 257), "RSAは暗号化にも署名にも利用できるアルゴリズムだが、デジタル署名そのものの定義ではない。", 15, MUTED, True, "mm")
    items = [
        ("1", "素数を選ぶ", "p = 5, q = 11"),
        ("2", "共通の値を計算", "N = pq = 55\nL = lcm(4, 10) = 20"),
        ("3", "指数を選ぶ", "E = 3\nED ≡ 1 (mod L) → D = 7"),
        ("4", "鍵ペア", "公開鍵 (N, E) = (55, 3)\n秘密鍵 (N, D) = (55, 7)"),
    ]
    for index, (number, title, body) in enumerate(items):
        x = 70 + index * 375
        f.round((x, 345, x + 335, 600), 16, WHITE, BLUE, 2)
        f.ellipse((x + 25, 375, x + 75, 425), BLUE, BLUE, 1)
        f.text((x + 50, 400), number, 16, WHITE, True, "mm")
        f.text((x + 95, 384), title, 18, NAVY, True)
        for line_index, line in enumerate(body.split("\n")):
            f.text((x + 167, 495 + line_index * 38), line, 15, NAVY, True, "mm")
        if index < 3:
            f.arrow((x + 335, 475), (x + 375, 475), BLUE, 3, 8)
    f.round((140, 680, 1460, 815), 17, WHITE, LINE, 2)
    f.text((185, 720), "平文 m = 12", 18, NAVY, True)
    f.arrow((355, 730), (455, 730), BLUE, 3, 10)
    f.text((480, 720), "暗号化：c = 12³ mod 55 = 23", 18, BLUE, True)
    f.arrow((845, 730), (945, 730), BLUE, 3, 10)
    f.text((970, 720), "復号：m = 23⁷ mod 55 = 12", 18, NAVY, True)
    f.text((800, 785), "公開鍵で暗号化し、対応する秘密鍵で復号できる", 15, MUTED, True, "mm")
    f.save("network", "rsa-example.png")


def network_integrity():
    f = Figure("目的の異なる三つの技術を、独立して比べる", "INTEGRITY TOOLS", BLUE)
    cards = [
        ((70, 185, 520, 675), "電子透かし", "権利・識別情報を埋め込む", "画像や音声へ、人に気づかれにくい形で権利者IDなどを埋め込む。暗号化のように内容全体を読めなくする技術ではない。"),
        ((575, 185, 1025, 675), "ブロックチェーン", "履歴の改変を見つけやすくする", "各ブロックに前のブロックのハッシュを含め、複数ノードで履歴を共有する。用途や合意方式によって性質は異なる。"),
        ((1080, 185, 1530, 675), "偶数パリティ", "偶発的なビット誤りを検出する", "1の個数が偶数になるよう1ビットを加える。2ビット同時に反転すると検出できないため、悪意ある改ざん対策ではない。"),
    ]
    for box, title, purpose, body in cards:
        f.round(box, 18, WHITE, BLUE, 2)
        f.text((box[0] + 30, box[1] + 35), title, 23, BLUE, True)
        f.text((box[0] + 30, box[1] + 85), purpose, 15, NAVY, True)
        f.wrap((box[0] + 30, box[1] + 130), body, box[2] - box[0] - 60, 15, MUTED, gap=7)

    f.round((145, 500, 445, 570), 11, BLUE_SOFT, BLUE, 2)
    f.text((295, 535), "画像 ＋ 権利者ID", 16, NAVY, True, "mm")
    block_x = [650, 770, 890]
    for index, x in enumerate(block_x):
        f.round((x, 500, x + 90, 570), 9, BLUE_SOFT, BLUE, 2)
        f.text((x + 45, 535), f"B{index + 1}", 15, NAVY, True, "mm")
        if index < 2:
            f.line((x + 90, 535, x + 120, 535), BLUE, 2)
    f.text((1305, 505), "0010101", 21, NAVY, True, "mm")
    f.text((1305, 550), "＋ 1 → 1が4個", 17, BLUE, True, "mm")

    f.round((180, 730, 1420, 830), 15, WHITE, LINE, 2)
    f.text((800, 765), "電子透かし・ブロックチェーン・パリティの間に、処理順序や因果関係はない", 17, NAVY, True, "mm")
    f.text((800, 805), "守る対象と想定する脅威を確認し、目的に合う技術を選ぶ", 15, MUTED, True, "mm")
    f.save("network", "integrity-tools.png")


# Statistics ----------------------------------------------------------------

def statistics_cycle():
    f = Figure("統計的探究は、問いから結論の限界までを循環する", "INVESTIGATION CYCLE", GREEN)
    items = [
        ("1 課題", "対象・比較・期間を具体化", GREEN, WHITE),
        ("2 計画", "母集団・標本・変数を決める", GREEN, WHITE),
        ("3 収集", "方法と除外基準を記録", GREEN, WHITE),
        ("4 整理", "欠測・外れ値・単位を確認", GREEN, WHITE),
        ("5 分析", "分布・関係・時間変化を読む", GREEN, WHITE),
        ("6 結論", "根拠・限界・次の問いを示す", GREEN, WHITE),
    ]
    # 細長い6箱を横一列にせず、視線が蛇行する2段構成にして文字を大きく保つ。
    positions = [(70, 190), (585, 190), (1100, 190), (1100, 500), (585, 500), (70, 500)]
    boxes = []
    for (x, y), item in zip(positions, items):
        box = (x, y, x + 430, y + 210)
        boxes.append(box)
        f.card(box, item[0], item[1], item[2], item[3], 24, 18)
    f.arrow((510, 295), (570, 295), GREEN, 4, 12)
    f.arrow((1025, 295), (1085, 295), GREEN, 4, 12)
    f.arrow((1315, 415), (1315, 485), GREEN, 4, 12)
    f.arrow((1085, 605), (1025, 605), GREEN, 4, 12)
    f.arrow((570, 605), (510, 605), GREEN, 4, 12)
    f.poly_arrow([(70, 605), (35, 605), (35, 295), (58, 295)], GREEN, 4, 12)
    f.round((505, 760, 1095, 840), 15, GREEN_SOFT, GREEN, 2)
    f.text((800, 792), "結論は終点ではなく、次の問いの出発点", 20, GREEN, True, "mm")
    f.text((800, 822), "限界を記録し、標本・変数・分析方法を改善する", 16, MUTED, False, "mm")
    f.save("statistics", "investigation-cycle.png")


def statistics_descriptive():
    f = Figure("中心が同じでも、散らばりは異なる", "CENTER & SPREAD", GREEN)
    f.round((70, 180, 840, 760), 18, WHITE, BLUE, 2)
    f.text((110, 220), "平均が同じ2つの分布", 24, BLUE, True)
    x0, y0, x1 = 130, 650, 780
    f.line((x0, y0, x1, y0), MUTED, 2)
    for sigma, color, peak in [(0.13, BLUE, 260), (0.25, ORANGE, 170)]:
        pts = []
        for i in range(501):
            t = -1 + 2 * i / 500
            x = x0 + (t + 1) / 2 * (x1 - x0)
            y = y0 - peak * exp(-0.5 * (t / sigma) ** 2)
            pts.extend([x, y])
        f.line(tuple(pts), color, 4)
    f.line((455, 320, 455, 650), "#9baab2", 2)
    f.text((455, 690), "同じ平均", 16, MUTED, True, "mm")
    f.text((600, 400), "標準偏差が小さい", 16, BLUE, True)
    f.text((600, 510), "標準偏差が大きい", 16, ORANGE, True)
    f.round((900, 180, 1530, 760), 18, WHITE, GREEN, 2)
    f.text((940, 220), "箱ひげ図：五数要約を一列に置く", 22, GREEN, True)
    f.text((940, 260), "例　最小10・Q₁=20・中央値30・Q₃=45・最大60", 14, MUTED)
    # 教科書型の五数要約。ひげ・箱・中央値を同じ数直線上に正確に置く。
    minimum, q1, median, q3, maximum = 960, 1058, 1156, 1303, 1450
    y = 480
    f.line((minimum, y, q1, y), GREEN, 4)
    f.line((q3, y, maximum, y), GREEN, 4)
    f.line((minimum, y - 55, minimum, y + 55), GREEN, 3)
    f.line((maximum, y - 55, maximum, y + 55), GREEN, 3)
    f.rect((q1, y - 95, q3, y + 95), GREEN_SOFT, GREEN, 3)
    f.line((median, y - 95, median, y + 95), GREEN, 4)
    values = [(minimum, "最小値", "10"), (q1, "Q₁", "20"), (median, "中央値", "30"), (q3, "Q₃", "45"), (maximum, "最大値", "60")]
    for x, label, value in values:
        f.text((x, 610), label, 13, MUTED, True, "mm")
        f.text((x, 640), value, 14, NAVY, True, "mm")
    f.line((q1, 690, q3, 690), GREEN, 3)
    f.line((q1, 680, q1, 700), GREEN, 3)
    f.line((q3, 680, q3, 700), GREEN, 3)
    f.text(((q1 + q3) / 2, 725), "IQR = Q₃ − Q₁ = 25", 15, GREEN, True, "mm")
    f.save("statistics", "descriptive-distribution.png")


def draw_scatter(fig, box, points, line_color=None, label=""):
    x1, y1, x2, y2 = box
    fig.line((x1, y2, x2, y2), MUTED, 2)
    fig.line((x1, y2, x1, y1), MUTED, 2)
    for px, py in points:
        x = x1 + px * (x2 - x1)
        y = y2 - py * (y2 - y1)
        fig.ellipse((x - 5, y - 5, x + 5, y + 5), BLUE, BLUE, 1)
    if line_color:
        fig.line((x1 + 10, y2 - 15, x2 - 10, y1 + 15), line_color, 3)
    if label:
        fig.text(((x1 + x2) / 2, y2 + 38), label, 16, NAVY, True, "mm")


def statistics_scatter():
    f = Figure("相関係数は、直線的な関係の向きと強さを表す", "SCATTER & CORRELATION", GREEN)
    panels = [
        ((70, 190, 400, 720), "正の相関", [(0.1, .15), (.2, .22), (.35, .4), (.5, .47), (.65, .68), (.8, .72), (.9, .9)]),
        ((450, 190, 780, 720), "負の相関", [(0.1, .88), (.2, .75), (.35, .68), (.5, .5), (.65, .35), (.8, .28), (.9, .1)]),
        ((830, 190, 1160, 720), "相関が弱い", [(0.1, .5), (.2, .18), (.35, .75), (.5, .36), (.65, .62), (.8, .25), (.9, .72)]),
        ((1210, 190, 1530, 720), "非線形", [(0.1, .75), (.2, .5), (.35, .25), (.5, .12), (.65, .25), (.8, .52), (.9, .82)]),
    ]
    for box, label, points in panels:
        f.round(box, 17, WHITE, LINE, 2)
        f.text(((box[0] + box[2]) / 2, 230), label, 21, GREEN, True, "mm")
        draw_scatter(f, (box[0] + 45, 315, box[2] - 35, 625), points)
    f.round((180, 775, 1420, 840), 14, ORANGE_SOFT, ORANGE, 1)
    f.text((800, 807), "相関関係だけでは因果関係を証明できない。第三の変数・偶然・逆因果を検討する。", 17, NAVY, True, "mm")
    f.save("statistics", "scatter-correlation.png")


def statistics_regression():
    f = Figure("回帰直線で予測し、残差の並びを調べる", "REGRESSION & RESIDUAL", GREEN)
    f.round((70, 180, 820, 770), 18, WHITE, BLUE, 2)
    f.text((110, 220), "散布図と回帰直線", 24, BLUE, True)
    pts = [(0.08, .12), (.18, .28), (.3, .22), (.42, .48), (.55, .4), (.66, .67), (.78, .7), (.9, .86)]
    draw_scatter(f, (140, 330, 750, 680), pts)
    f.line((160, 635, 730, 365), ORANGE, 4)
    f.text((445, 720), "ŷ = ax + b", 20, ORANGE, True, "mm")
    f.round((880, 180, 1530, 770), 18, WHITE, GREEN, 2)
    f.text((920, 220), "残差プロット", 24, GREEN, True)
    x1, ymid, x2 = 950, 500, 1460
    f.line((x1, ymid, x2, ymid), ORANGE, 3)
    f.line((x1, 670, x1, 320), MUTED, 2)
    residuals = [(0.08, -35), (.18, 48), (.3, -65), (.42, 30), (.55, -28), (.66, 52), (.78, 18), (.9, -45)]
    for px, dy in residuals:
        x = x1 + px * (x2 - x1)
        y = ymid - dy
        f.ellipse((x - 6, y - 6, x + 6, y + 6), GREEN, GREEN, 1)
        f.line((x, ymid, x, y), "#b9d7c9", 2)
    f.text((1205, 720), "残差 = 実測値 − 予測値", 18, GREEN, True, "mm")
    f.save("statistics", "regression-residual.png")


def statistics_normal():
    f = Figure("正規分布の68.3%・95.4%・99.7%を順に読む", "NORMAL DISTRIBUTION", GREEN)
    x0, y0, x1 = 170, 590, 1430
    center = 800
    unit = 175
    f.line((x0, y0, x1, y0), MUTED, 2)
    pts = []
    for index in range(801):
        z = -3.6 + 7.2 * index / 800
        x = x0 + (z + 3.6) / 7.2 * (x1 - x0)
        y = y0 - 345 * exp(-0.5 * z * z)
        pts.extend([x, y])
    f.line(tuple(pts), GREEN, 5)

    for k in range(-3, 4):
        x = center + k * unit
        curve_y = y0 - 345 * exp(-0.5 * k * k)
        for dash_y in range(int(curve_y), y0, 14):
            f.line((x, dash_y, x, min(dash_y + 7, y0)), "#9fb7aa" if k else GREEN, 2)
        labels = {-3: "μ−3σ", -2: "μ−2σ", -1: "μ−σ", 0: "μ", 1: "μ＋σ", 2: "μ＋2σ", 3: "μ＋3σ"}
        f.text((x, 625), labels[k], 14, MUTED if k else GREEN, True, "mm")

    # 内側から外側へ並べ、各端点を対応するσの線へ正確に合わせる。
    bands = [(1, "約68.3%", 685), (2, "約95.4%", 745), (3, "約99.7%", 805)]
    for k, label, y in bands:
        left, right = center - k * unit, center + k * unit
        f.line((left, y, center - 92, y), GREEN, 3)
        f.line((center + 92, y, right, y), GREEN, 3)
        f.line((left, y - 10, left, y + 10), GREEN, 3)
        f.line((right, y - 10, right, y + 10), GREEN, 3)
        f.text((center, y), label, 16, GREEN, True, "mm")
    f.text((800, 850), "標準得点 z = (x − μ) / σ　：平均との差を標準偏差の個数で表す", 16, NAVY, True, "mm")
    f.save("statistics", "normal-distribution.png")


def statistics_estat():
    f = Figure("公的データは、入手から解釈までの道筋を残す", "PUBLIC DATA WORKFLOW", GREEN)
    cards = [
        ("1 問いを決める", "例：地域で図書館の利用環境は違うか"),
        ("2 統計を探す", "e-Statで分野・キーワードから検索"),
        ("3 表を選ぶ", "調査名・表題・作成機関を確認"),
        ("4 条件を絞る", "項目・地域・年次を同じ基準で選択"),
        ("5 定義を読む", "単位・分母・時点・欠測・改訂を確認"),
        ("6 取得する", "CSV/XLSXを保存し出典も記録"),
        ("7 整形・計算", "列名・型・欠測を整え、指標を算出"),
        ("8 分析・解釈", "図表で比較し、限界を添えて答える"),
    ]
    positions = [(70, 190), (435, 190), (800, 190), (1165, 190), (1165, 525), (800, 525), (435, 525), (70, 525)]
    boxes = []
    for (x, y), (title, body) in zip(positions, cards):
        box = (x, y, x + 315, y + 230)
        boxes.append(box)
        f.round(box, 16, WHITE, GREEN, 2)
        f.text((x + 24, y + 28), title, 18, GREEN, True)
        f.wrap((x + 24, y + 78), body, 267, 15, MUTED, gap=7)
    for index in range(len(boxes) - 1):
        current, following = boxes[index], boxes[index + 1]
        if index < 3:
            f.arrow((current[2], 305), (following[0], 305), GREEN, 3, 9)
        elif index == 3:
            f.arrow((1322, current[3]), (1322, following[1]), GREEN, 3, 9)
        else:
            f.arrow((current[0], 640), (following[2], 640), GREEN, 3, 9)
    f.round((235, 795, 1365, 850), 12, GREEN_SOFT, GREEN, 1)
    f.text((800, 822), "結果だけでなく、表番号・抽出条件・加工式・取得日を再現できる形で残す", 16, NAVY, True, "mm")
    f.save("statistics", "public-data-workflow.png")


def statistics_time_series():
    f = Figure("時系列を、傾向・季節・循環・不規則に分ける", "TIME SERIES COMPONENTS", GREEN)
    f.round((210, 170, 1390, 255), 15, WHITE, GREEN, 2)
    f.text((800, 212), "観測系列 Y = 傾向 T ＋ 季節 S ＋ 循環 C ＋ 不規則 I", 20, NAVY, True, "mm")
    f.text((800, 285), "加法モデルの表し方。変動幅が水準に比例するデータでは Y = T×S×C×I と考える。", 13, MUTED, True, "mm")

    panels = [
        ((70, 330, 775, 545), "傾向変動（トレンド）", "長期的に増える・減る", lambda t: .22 + .58 * t),
        ((825, 330, 1530, 545), "季節変動（シーズン）", "1年・1週など決まった周期", lambda t: .5 + .3 * sin(8 * pi * t)),
        ((70, 590, 775, 805), "循環変動（サイクル）", "景気など、季節以外の長い波", lambda t: .5 + .3 * sin(2 * pi * t - .7)),
        ((825, 590, 1530, 805), "不規則変動（ノイズ）", "事故・災害など偶発的で予測しにくい", lambda t: .5 + .16 * sin(29 * pi * t) + .09 * sin(47 * pi * t)),
    ]
    for box, title, subtitle, function in panels:
        x1, y1, x2, y2 = box
        f.round(box, 15, WHITE, LINE, 2)
        f.text((x1 + 25, y1 + 26), title, 19, NAVY, True)
        f.text((x1 + 25, y1 + 61), subtitle, 13, MUTED)
        plot = (x1 + 35, y1 + 92, x2 - 30, y2 - 25)
        f.line((plot[0], plot[3], plot[2], plot[3]), "#aab8c0", 2)
        f.line((plot[0], (plot[1] + plot[3]) / 2, plot[2], (plot[1] + plot[3]) / 2), LINE, 1)
        points = []
        for step in range(121):
            t = step / 120
            value = function(t)
            points.extend([plot[0] + t * (plot[2] - plot[0]), plot[3] - value * (plot[3] - plot[1])])
        f.line(tuple(points), BLUE, 4)
    f.text((800, 850), "季節変動は暦に沿う規則的な周期、循環変動は季節より長く周期が一定とは限らない波", 14, NAVY, True, "mm")
    f.save("statistics", "time-series.png")


def statistics_seasonal_adjustment():
    f = Figure("季節調整は、毎年繰り返す変動を取り除いて比較する", "SEASONAL ADJUSTMENT", GREEN)
    months = list(range(36))
    seasonal = [0.82, 0.88, 0.95, 1.03, 1.08, 1.12, 1.18, 1.16, 1.05, 0.98, 0.90, 0.85]
    base = [100 + 0.9 * month + 4 * sin(2 * pi * month / 24) for month in months]
    irregular = [1 + 0.018 * sin(2 * pi * month / 5) for month in months]
    original = [base[month] * seasonal[month % 12] * irregular[month] for month in months]
    adjusted = [original[month] / seasonal[month % 12] for month in months]

    panels = [
        ((70, 175, 1530, 365), "1 原系列", "傾向 × 季節 × 循環 × 不規則\n毎年ほぼ同じ位置に山と谷が現れる", original, BLUE),
        ((70, 395, 1530, 585), "2 中心化移動平均", "12か月の変動をならし、月の中央へ位置を合わせる\n傾向 × 循環の動きを近似する", base, ORANGE),
        ((70, 615, 1530, 805), "3 季節調整済み系列", "原系列 ÷ 季節指数\n季節要因を除いて前月・前年と比較する", adjusted, GREEN),
    ]
    all_values = original + base + adjusted
    minimum, maximum = min(all_values) - 5, max(all_values) + 5
    for box, title, subtitle, values, color in panels:
        x1, y1, x2, y2 = box
        f.round(box, 15, WHITE, LINE, 2)
        f.text((x1 + 28, y1 + 35), title, 21, color, True)
        for line_index, line in enumerate(subtitle.split("\n")):
            f.text((x1 + 28, y1 + 82 + line_index * 34), line, 16, MUTED)
        # 説明列とグラフ列を分け、波形の高さを確保する。
        plot = (x1 + 430, y1 + 28, x2 - 35, y2 - 42)
        f.line((plot[0], plot[3], plot[2], plot[3]), "#aab8c0", 2)
        for year in [12, 24]:
            x = plot[0] + year / 35 * (plot[2] - plot[0])
            f.line((x, plot[1], x, plot[3]), LINE, 1)
        points = []
        for month, value in enumerate(values):
            x = plot[0] + month / 35 * (plot[2] - plot[0])
            y = plot[3] - (value - minimum) / (maximum - minimum) * (plot[3] - plot[1])
            points.extend([x, y])
        f.line(tuple(points), color, 4)
        f.text((plot[0], plot[3] + 12), "1年目", 16, MUTED)
        f.text((plot[0] + (plot[2] - plot[0]) / 3, plot[3] + 12), "2年目", 16, MUTED)
        f.text((plot[0] + 2 * (plot[2] - plot[0]) / 3, plot[3] + 12), "3年目", 16, MUTED)
    f.text((800, 850), "季節調整済み系列には、傾向・循環・不規則変動が残る", 15, NAVY, True, "mm")
    f.save("statistics", "seasonal-adjustment.png")


# Programming ---------------------------------------------------------------

def programming_flow():
    f = Figure("Pythonの値の流れ：入力 → 保存 → 処理 → 出力", "PYTHON BASICS", VIOLET)
    items = [
        ("入力", "input()\n文字列として受け取る", BLUE, BLUE_SOFT),
        ("変換・代入", "int() / float()\n名前を付けて保存", GREEN, GREEN_SOFT),
        ("処理", "+ − * / // % **\n値を計算する", ORANGE, ORANGE_SOFT),
        ("出力", "print()\n結果を表示する", VIOLET, VIOLET_SOFT),
    ]
    horizontal_cards(f, items, top=220, bottom=570, gap=54)
    f.round((250, 680, 1350, 805), 17, WHITE, VIOLET, 2)
    f.text((800, 720), "プログラム = データ + 手順", 23, VIOLET, True, "mm")
    f.text((800, 770), "同じ入力に正しい出力を返し、有限時間で終了する手順をつくる", 17, MUTED, True, "mm")
    f.save("programming", "python-flow.png")


def programming_values():
    f = Figure("値の型と演算子を対応させる", "VALUES & TYPES", VIOLET)
    types = [("int", "42, −7", "整数", BLUE, BLUE_SOFT), ("float", "3.14, 1.0", "小数", GREEN, GREEN_SOFT), ("str", "\"情報Ⅰ\"", "文字列", ORANGE, ORANGE_SOFT), ("bool", "True / False", "真偽値", VIOLET, VIOLET_SOFT)]
    for i, (label, value, kind, color, fill) in enumerate(types):
        x = 70 + i * 380
        f.round((x, 185, x + 340, 420), 18, WHITE, VIOLET, 2)
        f.text((x + 28, 220), label, 27, VIOLET, True)
        f.text((x + 170, 310), value, 22, NAVY, True, "mm")
        f.text((x + 170, 365), kind, 16, MUTED, False, "mm")
    f.text((70, 500), "演算子", 24, NAVY, True)
    ops = [("+ − * /", "加減乗除"), ("//", "切り下げ除算"), ("%", "余り"), ("**", "べき乗"), ("== != < >", "比較"), ("and or not", "論理")]
    for i, (op, label) in enumerate(ops):
        col, row = i % 3, i // 3
        x = 70 + col * 500
        y = 560 + row * 105
        f.round((x, y, x + 455, y + 80), 13, WHITE, LINE, 1)
        f.text((x + 25, y + 40), op, 20, VIOLET, True, "lm")
        f.text((x + 250, y + 40), label, 16, MUTED, False, "lm")
    f.text((800, 825), "input()の戻り値はstr。数値計算の前に必要な型へ変換する。", 17, NAVY, True, "mm")
    f.save("programming", "values-types.png")


def programming_control():
    f = Figure("構造化プログラミングの三つの基本構造", "CONTROL FLOW", VIOLET)
    panels = [(70, 180, 520, 790), (575, 180, 1025, 790), (1080, 180, 1530, 790)]
    for box, title in zip(panels, ["順次", "分岐", "反復"]):
        f.round(box, 18, WHITE, VIOLET, 2)
        f.text((box[0] + 28, 220), title, 25, VIOLET, True)

    # 順次：入口から出口まで、処理を上から順に一度ずつ実行する。
    f.arrow((295, 275), (295, 330), VIOLET, 3, 10)
    for index, label in enumerate(["処理 A", "処理 B", "処理 C"]):
        y = 330 + index * 120
        f.rect((170, y, 420, y + 65), WHITE, VIOLET, 2)
        f.text((295, y + 32), label, 17, NAVY, True, "mm")
        f.arrow((295, y + 65), (295, y + 120), VIOLET, 3, 9)
    f.text((295, 735), "出口", 14, MUTED, True, "mm")

    # 分岐：二つの枝は必ず合流し、その後の処理へ進む。
    f.arrow((800, 275), (800, 325), VIOLET, 3, 10)
    decision = [(800, 325), (920, 395), (800, 465), (680, 395)]
    f.polygon(decision, WHITE, VIOLET)
    f.line(tuple(value for point in decision + [decision[0]] for value in point), VIOLET, 2)
    f.text((800, 395), "条件", 17, NAVY, True, "mm")
    f.poly_arrow([(680, 395), (645, 395), (645, 535)], VIOLET, 3, 10)
    f.poly_arrow([(920, 395), (955, 395), (955, 535)], VIOLET, 3, 10)
    f.text((650, 365), "はい", 13, NAVY, True, "mm")
    f.text((950, 365), "いいえ", 13, NAVY, True, "mm")
    f.rect((600, 535, 750, 600), WHITE, VIOLET, 2)
    f.text((675, 567), "処理 A", 16, NAVY, True, "mm")
    f.rect((850, 535, 1000, 600), WHITE, VIOLET, 2)
    f.text((925, 567), "処理 B", 16, NAVY, True, "mm")
    f.line((675, 600, 675, 660, 800, 660), VIOLET, 3)
    f.line((925, 600, 925, 660, 800, 660), VIOLET, 3)
    f.arrow((800, 660), (800, 705), VIOLET, 3, 10)
    f.text((800, 735), "出口", 14, MUTED, True, "mm")

    # 反復：条件が真なら処理し、判定へ戻る。偽なら出口へ進む。
    f.arrow((1305, 275), (1305, 325), VIOLET, 3, 10)
    loop_decision = [(1305, 325), (1430, 395), (1305, 465), (1180, 395)]
    f.polygon(loop_decision, WHITE, VIOLET)
    f.line(tuple(value for point in loop_decision + [loop_decision[0]] for value in point), VIOLET, 2)
    f.text((1305, 395), "継続条件", 16, NAVY, True, "mm")
    f.arrow((1305, 465), (1305, 545), VIOLET, 3, 10)
    f.text((1340, 505), "はい", 13, NAVY, True)
    f.rect((1200, 545, 1410, 610), WHITE, VIOLET, 2)
    f.text((1305, 577), "反復する処理", 16, NAVY, True, "mm")
    f.poly_arrow([(1410, 577), (1480, 577), (1480, 300), (1305, 300), (1305, 325)], VIOLET, 3, 10)
    f.poly_arrow([(1180, 395), (1135, 395), (1135, 700), (1305, 700)], VIOLET, 3, 10)
    f.text((1145, 365), "いいえ", 13, NAVY, True, "mm")
    f.text((1305, 735), "出口", 14, MUTED, True, "mm")
    f.text((800, 845), "どの構造も入口と出口を一つにすると、処理のまとまりを組み合わせやすい", 16, NAVY, True, "mm")
    f.save("programming", "control-flow.png")


def programming_loops():
    f = Figure("forとwhileを、変数の変化を追って確かめる", "LOOP TRACE", VIOLET)
    panels = [(70, 180, 760, 800), (840, 180, 1530, 800)]
    for box in panels:
        f.round(box, 18, WHITE, LINE, 2)
    f.text((110, 220), "for：決められた要素を順に取り出す", 22, NAVY, True)
    f.text((110, 265), "total = 0 / for n in range(1, 6): total += n", 14, MUTED)
    headers = ["反復", "n", "処理後のtotal"]
    rows = [("1回目", "1", "1"), ("2回目", "2", "3"), ("3回目", "3", "6"), ("4回目", "4", "10"), ("5回目", "5", "15")]
    x0, y0, widths = 110, 325, [180, 140, 260]
    for row_index, row in enumerate([headers] + rows):
        x = x0
        for value, width in zip(row, widths):
            fill = VIOLET_SOFT if row_index == 0 else WHITE
            f.rect((x, y0 + row_index * 68, x + width, y0 + (row_index + 1) * 68), fill, LINE, 1)
            f.text((x + width / 2, y0 + row_index * 68 + 34), value, 14, NAVY, row_index == 0, "mm")
            x += width
    f.text((400, 755), "次の要素がなければ終了", 14, VIOLET, True, "mm")

    f.text((880, 220), "while：条件が真の間だけ繰り返す", 22, NAVY, True)
    f.text((880, 265), "n = 1 / while n < 100: n *= 2", 14, MUTED)
    headers = ["判定時のn", "n < 100", "処理後のn"]
    rows = [("1", "真", "2"), ("2", "真", "4"), ("4", "真", "8"), ("8", "真", "16"), ("16", "真", "32"), ("32", "真", "64"), ("64", "真", "128"), ("128", "偽", "処理しない")]
    x0, y0, widths = 880, 325, [190, 170, 240]
    row_height = 48
    for row_index, row in enumerate([headers] + rows):
        x = x0
        for value, width in zip(row, widths):
            fill = VIOLET_SOFT if row_index == 0 else WHITE
            f.rect((x, y0 + row_index * row_height, x + width, y0 + (row_index + 1) * row_height), fill, LINE, 1)
            f.text((x + width / 2, y0 + row_index * row_height + row_height / 2), value, 13, NAVY, row_index == 0, "mm")
            x += width
    f.text((1180, 775), "偽になった時点でループを抜ける", 14, VIOLET, True, "mm")
    f.text((800, 845), "初期値・継続条件・更新処理を表にすると、無限ループや境界の誤りを見つけやすい", 16, NAVY, True, "mm")
    f.save("programming", "loops.png")


def programming_data_structures():
    f = Figure("目的に合わせて、データ構造を選ぶ", "DATA STRUCTURES", VIOLET)
    rows = [
        ("リスト", "[3, 5, 6, 4, 4]", "順序あり・変更可能・重複可能", BLUE, BLUE_SOFT),
        ("タプル", "(10, 20, 30)", "順序あり・変更不可・固定した組", GREEN, GREEN_SOFT),
        ("集合", "{1, 2, 3}", "重複なし・順序を前提にしない", ORANGE, ORANGE_SOFT),
        ("辞書", "{番号: 名前}", "キーと値の組・キーから検索", VIOLET, VIOLET_SOFT),
    ]
    for i, (title, example, body, color, fill) in enumerate(rows):
        y = 175 + i * 165
        f.round((90, y, 1510, y + 130), 17, WHITE, LINE, 2)
        f.text((130, y + 35), title, 24, VIOLET, True)
        f.round((430, y + 28, 850, y + 102), 12, WHITE, VIOLET, 1)
        f.text((640, y + 65), example, 20, NAVY, True, "mm")
        f.text((920, y + 65), body, 17, MUTED, False, "lm")
    f.text((800, 850), "必要なのは「順序」「変更」「重複除去」「キー検索」のどれか", 18, NAVY, True, "mm")
    f.save("programming", "data-structures.png")


def programming_functions():
    f = Figure("関数の入力・ローカル処理・戻り値と、再帰のスタック", "FUNCTIONS & RECURSION", VIOLET)
    f.round((70, 180, 800, 780), 18, WHITE, LINE, 2)
    f.text((110, 220), "関数", 25, VIOLET, True)
    f.round((140, 320, 320, 400), 12, WHITE, BLUE, 2)
    f.text((230, 360), "引数 4, 3", 17, NAVY, True, "mm")
    f.arrow((320, 360), (460, 360), BLUE, 4, 12)
    f.round((460, 280, 720, 560), 16, WHITE, BLUE, 2)
    f.text((590, 320), "rectangle_area", 18, BLUE, True, "mm")
    f.text((500, 390), "width = 4", 16, NAVY)
    f.text((500, 435), "height = 3", 16, NAVY)
    f.text((500, 480), "area = 12", 16, NAVY)
    f.arrow((590, 560), (590, 665), BLUE, 4, 12)
    f.round((460, 665, 720, 730), 12, WHITE, BLUE, 2)
    f.text((590, 697), "戻り値 12", 18, NAVY, True, "mm")
    f.text((190, 510), "関数内の変数は", 16, MUTED)
    f.text((190, 550), "ローカル", 19, BLUE, True)
    f.round((870, 180, 1530, 780), 18, WHITE, LINE, 2)
    f.text((910, 220), "factorial(4) の呼出しスタック", 23, VIOLET, True)
    calls = [("factorial(4)", "4×"), ("factorial(3)", "3×"), ("factorial(2)", "2×"), ("factorial(1)", "1×"), ("factorial(0)", "1を返す")]
    for i, (call, value) in enumerate(calls):
        y = 315 + i * 82
        x = 930 + i * 38
        f.round((x, y, 1430 - i * 15, y + 62), 10, WHITE, VIOLET, 2)
        f.text((x + 22, y + 31), call, 16, NAVY, True, "lm")
        f.text((1380 - i * 15, y + 31), value, 14, MUTED, False, "rm")
    f.text((1200, 745), "基底条件から逆順に戻る", 16, VIOLET, True, "mm")
    f.save("programming", "functions-recursion.png")


def programming_flowchart():
    f = Figure("教科書の基本記号で、開始から終了までを表す", "FLOWCHART", VIOLET)
    # 左は記号一覧、右は線が交差せず全経路が終了へ合流する例。
    f.round((70, 180, 420, 825), 18, WHITE, LINE, 2)
    f.text((105, 220), "基本記号", 24, NAVY, True)
    f.round((105, 285, 285, 345), 28, WHITE, VIOLET, 2)
    f.text((195, 315), "開始・終了", 16, NAVY, True, "mm")
    f.text((320, 315), "端子", 17, MUTED, True, "lm")
    f.rect((105, 410, 285, 470), WHITE, VIOLET, 2)
    f.text((195, 440), "計算・代入", 16, NAVY, True, "mm")
    f.text((320, 440), "処理", 17, MUTED, True, "lm")
    io_shape = [(125, 535), (305, 535), (270, 595), (90, 595)]
    f.polygon(io_shape, WHITE, VIOLET)
    f.line(tuple(value for point in io_shape + [io_shape[0]] for value in point), VIOLET, 2)
    f.text((197, 565), "入力・出力", 16, NAVY, True, "mm")
    f.text((320, 565), "入出力", 17, MUTED, True, "lm")
    decision_shape = [(195, 650), (295, 710), (195, 770), (95, 710)]
    f.polygon(decision_shape, WHITE, VIOLET)
    f.line(tuple(value for point in decision_shape + [decision_shape[0]] for value in point), VIOLET, 2)
    f.text((195, 710), "条件", 16, NAVY, True, "mm")
    f.text((320, 710), "判断", 17, MUTED, True, "lm")

    f.round((455, 180, 1530, 850), 18, WHITE, LINE, 2)
    f.text((495, 220), "例：年齢を3区分に分類する", 23, NAVY, True)
    centre = 990
    f.round((900, 245, 1080, 295), 24, WHITE, VIOLET, 2)
    f.text((centre, 270), "開始", 17, NAVY, True, "mm")
    f.arrow((centre, 295), (centre, 335), VIOLET, 3, 9)

    input_shape = [(875, 335), (1125, 335), (1095, 385), (845, 385)]
    f.polygon(input_shape, WHITE, VIOLET)
    f.line(tuple(value for point in input_shape + [input_shape[0]] for value in point), VIOLET, 2)
    f.text((985, 360), "年齢 age を入力", 16, NAVY, True, "mm")
    f.arrow((985, 385), (985, 420), VIOLET, 3, 9)

    first = [(985, 420), (1105, 480), (985, 540), (865, 480)]
    f.polygon(first, WHITE, VIOLET)
    f.line(tuple(value for point in first + [first[0]] for value in point), VIOLET, 2)
    f.text((985, 480), "age < 18 ?", 17, NAVY, True, "mm")

    # はい：左の出力へ。いいえ：次の判断へ。
    f.poly_arrow([(865, 480), (680, 480), (680, 580)], VIOLET, 3, 10)
    f.text((775, 452), "はい", 16, NAVY, True, "mm")
    minor = [(615, 580), (785, 580), (760, 630), (590, 630)]
    f.polygon(minor, WHITE, VIOLET)
    f.line(tuple(value for point in minor + [minor[0]] for value in point), VIOLET, 2)
    f.text((687, 605), "「未成年」と表示", 16, NAVY, True, "mm")

    f.poly_arrow([(1105, 480), (1240, 480), (1240, 525)], VIOLET, 3, 10)
    f.text((1170, 452), "いいえ", 16, NAVY, True, "mm")
    second = [(1240, 525), (1360, 585), (1240, 645), (1120, 585)]
    f.polygon(second, WHITE, VIOLET)
    f.line(tuple(value for point in second + [second[0]] for value in point), VIOLET, 2)
    f.text((1240, 585), "age < 65 ?", 17, NAVY, True, "mm")

    f.poly_arrow([(1120, 585), (1000, 585), (1000, 685)], VIOLET, 3, 10)
    f.text((1060, 557), "はい", 16, NAVY, True, "mm")
    adult = [(925, 685), (1095, 685), (1070, 735), (900, 735)]
    f.polygon(adult, WHITE, VIOLET)
    f.line(tuple(value for point in adult + [adult[0]] for value in point), VIOLET, 2)
    f.text((997, 710), "「成人」と表示", 16, NAVY, True, "mm")

    f.poly_arrow([(1360, 585), (1450, 585), (1450, 685)], VIOLET, 3, 10)
    f.text((1405, 557), "いいえ", 16, NAVY, True, "mm")
    senior = [(1380, 685), (1510, 685), (1490, 735), (1360, 735)]
    f.polygon(senior, WHITE, VIOLET)
    f.line(tuple(value for point in senior + [senior[0]] for value in point), VIOLET, 2)
    f.text((1435, 710), "「高齢者」と表示", 16, NAVY, True, "mm")

    # 三つの出力は専用の合流線へ入り、一本になって終了端子へ進む。
    merge_y = 775
    f.line((687, merge_y, 1435, merge_y), VIOLET, 3)
    f.arrow((687, 630), (687, merge_y), VIOLET, 3, 8)
    f.arrow((997, 735), (997, merge_y), VIOLET, 3, 8)
    f.arrow((1435, 735), (1435, merge_y), VIOLET, 3, 8)
    f.arrow((1120, merge_y), (1120, 810), VIOLET, 3, 9)
    f.round((1030, 810, 1210, 840), 15, WHITE, VIOLET, 2)
    f.text((1120, 825), "終了", 16, NAVY, True, "mm")
    f.save("programming", "flowchart.png")


def programming_sort_search():
    f = Figure("整列と探索：手順と計算量を比べる", "SORTING & SEARCHING", VIOLET)
    f.round((70, 180, 780, 790), 18, WHITE, LINE, 2)
    f.text((110, 220), "バブルソート", 25, VIOLET, True)
    rows = [("開始", "3  8  2  6  5"), ("1巡目", "3  2  6  5  8"), ("2巡目", "2  3  5  6  8"), ("完了", "2  3  5  6  8")]
    for i, (label, values) in enumerate(rows):
        y = 315 + i * 105
        f.round((130, y, 710, y + 70), 11, WHITE, VIOLET, 2)
        f.text((165, y + 35), label, 17, VIOLET, True, "lm")
        f.text((390, y + 35), values, 21, NAVY, True, "lm")
        if i < 3:
            f.arrow((420, y + 70), (420, y + 105), VIOLET, 3, 8)
    f.text((425, 760), "平均・最悪 O(n²)", 18, VIOLET, True, "mm")
    f.round((840, 180, 1530, 790), 18, WHITE, LINE, 2)
    f.text((880, 220), "クイックソート：基準値3", 24, VIOLET, True)
    f.text((880, 260), "入力例：2, 1, 3, 7, 6, 8, 5, 4", 15, MUTED)
    f.round((1080, 285, 1260, 350), 12, WHITE, VIOLET, 2)
    f.text((1170, 317), "3", 22, VIOLET, True, "mm")
    f.text((965, 410), "2, 1 ←", 18, NAVY, True, "mm")
    f.text((1370, 410), "→ 7, 6, 8, 5, 4", 18, NAVY, True, "mm")
    f.text((1170, 475), "平均 O(n log n)", 18, VIOLET, True, "mm")
    f.line((880, 535, 1490, 535), LINE, 2)
    f.text((880, 580), "線形探索", 20, VIOLET, True)
    f.text((1040, 580), "先頭から順に比較", 15, MUTED)
    f.round((1280, 550, 1460, 615), 11, WHITE, VIOLET, 2)
    f.text((1370, 582), "O(n)", 23, VIOLET, True, "mm")
    f.text((880, 680), "二分探索", 20, VIOLET, True)
    f.text((1040, 680), "整列済みの中央と比較", 15, MUTED)
    f.round((1280, 650, 1460, 715), 11, WHITE, VIOLET, 2)
    f.text((1370, 682), "O(log₂n)", 21, VIOLET, True, "mm")
    f.save("programming", "sorting-searching.png")


def build_all():
    society_literacy()
    society_properties()
    society_personal_data()
    society_privacy()
    society_ip()
    society_copyright()

    digital_analog()
    digital_bases_bits()
    digital_conversion()
    digital_signed_float_text()
    digital_logic_adder()
    digital_sound()
    digital_image()
    digital_color_models()
    digital_computer()
    digital_performance()

    network_types()
    network_processing()
    network_layers()
    network_encapsulation_gif()
    network_addressing()
    network_routing_gif()
    network_dns_gif()
    network_information_system()
    network_database()
    network_security()
    network_crypto()
    network_hybrid()
    network_signature()
    network_rsa()
    network_integrity()

    statistics_cycle()
    statistics_descriptive()
    statistics_scatter()
    statistics_regression()
    statistics_normal()
    statistics_estat()
    statistics_time_series()
    statistics_seasonal_adjustment()

    programming_flow()
    programming_values()
    programming_control()
    programming_loops()
    programming_data_structures()
    programming_functions()
    programming_flowchart()
    programming_sort_search()


if __name__ == "__main__":
    build_all()
    print(f"generated {len(list(OUT.rglob('*.png')))} PNG and {len(list(OUT.rglob('*.gif')))} GIF files in {OUT}")
