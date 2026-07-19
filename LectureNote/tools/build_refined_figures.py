"""Build the raster diagrams that genuinely benefit from spatial explanation.

The diagrams use a restrained semantic palette:
  blue   = message/data flow
  teal   = lookup or publicly shared information
  orange = secret/private key material or an exceptional event

Tables remain HTML in the lecture pages.  These PNGs are for routes, key flows,
verification, flowchart notation, and an actual-data time-series chart.
"""

from __future__ import annotations

from datetime import datetime
import math
from pathlib import Path
from statistics import mean

import matplotlib.dates as mdates
import matplotlib.pyplot as plt
from matplotlib.font_manager import FontProperties
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "assets" / "lecture-v2"

FONT_REGULAR = Path(r"C:\Windows\Fonts\YuGothR.ttc")
FONT_BOLD = Path(r"C:\Windows\Fonts\YuGothB.ttc")

BG = "#F5F8F8"
WHITE = "#FFFFFF"
INK = "#18343E"
MUTED = "#60757E"
LINE = "#C8D7DB"
BLUE = "#096B82"
BLUE_DARK = "#075467"
BLUE_SOFT = "#E7F3F5"
TEAL = "#2C806E"
TEAL_SOFT = "#E9F4F0"
ORANGE = "#C96D35"
ORANGE_SOFT = "#FBEDE3"
RED = "#B84B3A"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REGULAR), size)


def text_size(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont) -> tuple[int, int]:
    box = draw.multiline_textbbox((0, 0), text, font=fnt, spacing=6)
    return box[2] - box[0], box[3] - box[1]


def centered_text(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    text: str,
    size: int,
    color: str = INK,
    bold: bool = False,
    spacing: int = 7,
) -> None:
    fnt = font(size, bold)
    width, height = text_size(draw, text, fnt)
    x1, y1, x2, y2 = box
    draw.multiline_text(
        ((x1 + x2 - width) / 2, (y1 + y2 - height) / 2),
        text,
        font=fnt,
        fill=color,
        spacing=spacing,
        align="center",
    )


def heading(draw: ImageDraw.ImageDraw, title: str, subtitle: str | None = None) -> None:
    draw.text((70, 46), title, font=font(42, True), fill=INK)
    draw.rounded_rectangle((70, 105, 190, 112), radius=3, fill=BLUE)
    if subtitle:
        draw.text((70, 128), subtitle, font=font(21), fill=MUTED)


def rounded_box(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    title: str,
    subtitle: str = "",
    *,
    fill: str = WHITE,
    outline: str = LINE,
    title_color: str = INK,
    title_size: int = 28,
    subtitle_size: int = 19,
    radius: int = 22,
    width: int = 3,
) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)
    x1, y1, x2, y2 = box
    if subtitle:
        draw.text((x1 + 22, y1 + 20), title, font=font(title_size, True), fill=title_color)
        draw.multiline_text(
            (x1 + 22, y1 + 62),
            subtitle,
            font=font(subtitle_size),
            fill=MUTED,
            spacing=7,
        )
    else:
        centered_text(draw, box, title, title_size, title_color, True)


def arrow(
    draw: ImageDraw.ImageDraw,
    points: list[tuple[int, int]],
    *,
    color: str = BLUE,
    width: int = 6,
    head: int = 16,
    dash: bool = False,
) -> None:
    if dash:
        for start, end in zip(points, points[1:]):
            x1, y1 = start
            x2, y2 = end
            distance = max(abs(x2 - x1), abs(y2 - y1))
            pieces = max(1, distance // 20)
            for index in range(0, pieces, 2):
                a = index / pieces
                b = min(1, (index + 1) / pieces)
                draw.line(
                    (x1 + (x2 - x1) * a, y1 + (y2 - y1) * a,
                     x1 + (x2 - x1) * b, y1 + (y2 - y1) * b),
                    fill=color,
                    width=width,
                )
    else:
        draw.line(points, fill=color, width=width, joint="curve")

    x1, y1 = points[-2]
    x2, y2 = points[-1]
    if abs(x2 - x1) >= abs(y2 - y1):
        direction = 1 if x2 > x1 else -1
        triangle = [(x2, y2), (x2 - direction * head, y2 - head // 2), (x2 - direction * head, y2 + head // 2)]
    else:
        direction = 1 if y2 > y1 else -1
        triangle = [(x2, y2), (x2 - head // 2, y2 - direction * head), (x2 + head // 2, y2 - direction * head)]
    draw.polygon(triangle, fill=color)


def double_arrow(draw: ImageDraw.ImageDraw, start: tuple[int, int], end: tuple[int, int], color: str = BLUE) -> None:
    """Draw one clean connection with an arrowhead at each end."""
    arrow(draw, [start, end], color=color, width=5, head=14)
    arrow(draw, [end, start], color=color, width=5, head=14)


def label(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, *, color: str = INK, size: int = 20, bold: bool = False, anchor: str = "la") -> None:
    draw.text(xy, text, font=font(size, bold), fill=color, anchor=anchor)


def save(image: Image.Image, relative: str) -> None:
    path = ASSETS / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=True)
    print(path)


def save_gif(frames: list[Image.Image], relative: str, durations: list[int] | None = None) -> None:
    path = ASSETS / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    frame_durations = durations or [900] * len(frames)
    frames[0].save(
        path,
        format="GIF",
        save_all=True,
        append_images=frames[1:],
        duration=frame_durations,
        loop=0,
        disposal=2,
        optimize=True,
    )
    print(path)


def build_email_delivery() -> None:
    image = Image.new("RGB", (1700, 1080), BG)
    draw = ImageDraw.Draw(image)
    heading(draw, "AliceからBobへ：メールアドレスのドメインを手掛かりに届ける", "送信側メールサーバがDNSで配送先のIPアドレスを調べ、インターネット経由で送る")

    sender_group = (60, 185, 610, 950)
    receiver_group = (1090, 185, 1640, 950)
    draw.rounded_rectangle(sender_group, radius=28, fill=WHITE, outline=LINE, width=3)
    draw.rounded_rectangle(receiver_group, radius=28, fill=WHITE, outline=LINE, width=3)
    label(draw, (90, 220), "送信側  example.co.jp", color=BLUE_DARK, size=27, bold=True)
    label(draw, (1120, 220), "受信側  sample.ac.jp", color=BLUE_DARK, size=27, bold=True)

    client_a = (110, 300, 560, 450)
    server_a = (110, 650, 560, 850)
    client_b = (1140, 300, 1590, 450)
    server_b = (1140, 650, 1590, 850)
    dns = (690, 315, 1020, 535)

    rounded_box(draw, client_a, "Aliceの端末", "差出人：Alice@example.co.jp\n宛先：Bob@sample.ac.jp", fill=WHITE, outline=BLUE, title_color=BLUE_DARK, title_size=27)
    rounded_box(draw, server_a, "送信側メールサーバ", "宛先の @ より右\n『sample.ac.jp』を読む", fill=BLUE_SOFT, outline=BLUE, title_color=BLUE_DARK, title_size=26)
    rounded_box(draw, client_b, "Bobの端末", "Bobのメールボックスを\n閲覧・同期する", fill=WHITE, outline=BLUE, title_color=BLUE_DARK, title_size=27)
    rounded_box(draw, server_b, "受信側メールサーバ", "Bobのメールボックスへ\nメールを保存する", fill=BLUE_SOFT, outline=BLUE, title_color=BLUE_DARK, title_size=26)
    rounded_box(draw, dns, "DNSサーバ", "MX：受信メールサーバ名\nA / AAAA：IPアドレス\n例 203.0.113.25", fill=TEAL_SOFT, outline=TEAL, title_color=TEAL, title_size=28)

    arrow(draw, [(335, 450), (335, 650)], color=BLUE)
    label(draw, (355, 550), "① SMTPで送信", color=BLUE_DARK, size=19, bold=True, anchor="lm")

    arrow(draw, [(560, 705), (650, 705), (650, 470), (690, 470)], color=TEAL)
    label(draw, (665, 555), "② 問い合わせ", color=TEAL, size=17, bold=True, anchor="lm")
    arrow(draw, [(855, 535), (855, 610), (470, 610), (470, 650)], color=TEAL, dash=True)
    label(draw, (760, 630), "③ IPアドレスを回答", color=TEAL, size=17, bold=True, anchor="mm")

    draw.rounded_rectangle((675, 650, 1025, 850), radius=80, fill=WHITE, outline=BLUE, width=3)
    centered_text(draw, (675, 675, 1025, 770), "インターネット", 29, BLUE_DARK, True)
    centered_text(draw, (700, 760, 1000, 825), "宛先IPアドレスへ\nメールを配送", 18, MUTED, True)
    arrow(draw, [(560, 815), (675, 815)], color=BLUE)
    arrow(draw, [(1025, 815), (1140, 815)], color=BLUE)
    label(draw, (850, 875), "④ SMTPでサーバ間配送", color=BLUE_DARK, size=20, bold=True, anchor="mm")

    arrow(draw, [(1365, 650), (1365, 450)], color=BLUE)
    label(draw, (1390, 550), "⑤ IMAP / POPで\n閲覧・同期", color=BLUE_DARK, size=18, bold=True, anchor="lm")

    draw.rounded_rectangle((70, 985, 1630, 1040), radius=14, fill=WHITE, outline=LINE, width=2)
    centered_text(draw, (95, 985, 1605, 1040), "端末どうしが直接送るのではない。送信側と受信側の二つのメールサーバが、メールをいったん預かって配送する。", 18, MUTED)
    save(image, "network/email-delivery.png")


def build_processing_models() -> None:
    image = Image.new("RGB", (1700, 1080), BG)
    draw = ImageDraw.Draw(image)
    heading(draw, "集中処理と分散処理：見た目ではなく、処理する場所で区別する", "クライアントサーバとP2Pは、どちらも分散処理の代表的な構成")

    draw.rounded_rectangle((55, 190, 545, 1000), radius=28, fill=WHITE, outline=LINE, width=3)
    label(draw, (90, 230), "集中処理", color=BLUE_DARK, size=32, bold=True)
    label(draw, (90, 275), "処理とデータを中央へ集める", color=MUTED, size=19)
    terminals = [(95, 355, 275, 455), (95, 500, 275, 600), (95, 645, 275, 745)]
    for index, box in enumerate(terminals, 1):
        rounded_box(draw, box, f"端末{index}", "入力・表示のみ", fill=WHITE, outline=LINE, title_size=22, subtitle_size=16)
        arrow(draw, [(275, (box[1] + box[3]) // 2), (340, (box[1] + box[3]) // 2)], color=BLUE, width=4, head=12)
    rounded_box(draw, (320, 400, 505, 705), "中央計算機", "計算・判断\nデータ管理\nすべてを担当", fill=BLUE_SOFT, outline=BLUE, title_color=BLUE_DARK, title_size=22, subtitle_size=17)
    draw.rounded_rectangle((90, 810, 510, 945), radius=18, fill=ORANGE_SOFT, outline=ORANGE, width=2)
    centered_text(draw, (110, 825, 490, 930), "強調：端末は処理を分担しない\n中央が止まると全体へ影響しやすい", 19, ORANGE, True)

    draw.rounded_rectangle((595, 190, 1645, 1000), radius=28, fill=WHITE, outline=LINE, width=3)
    label(draw, (630, 230), "分散処理", color=BLUE_DARK, size=32, bold=True)
    label(draw, (630, 275), "複数のコンピュータが処理を分担する", color=MUTED, size=19)
    arrow(draw, [(1120, 315), (1120, 355), (850, 355), (850, 395)], color=TEAL, width=4, head=13)
    arrow(draw, [(1120, 355), (1390, 355), (1390, 395)], color=TEAL, width=4, head=13)
    rounded_box(draw, (970, 295, 1270, 360), "分散処理の代表例", fill=TEAL_SOFT, outline=TEAL, title_color=TEAL, title_size=22)

    draw.rounded_rectangle((630, 400, 1080, 940), radius=22, fill=BLUE_SOFT, outline=BLUE, width=3)
    label(draw, (665, 435), "クライアントサーバ", color=BLUE_DARK, size=27, bold=True)
    rounded_box(draw, (665, 500, 845, 620), "クライアント", "画面処理・入力確認\n要求を送る", fill=WHITE, outline=BLUE, title_size=20, subtitle_size=15)
    rounded_box(draw, (665, 755, 845, 875), "クライアント", "自分の処理も行う", fill=WHITE, outline=BLUE, title_size=20, subtitle_size=15)
    rounded_box(draw, (905, 615, 1045, 765), "サーバ", "共通の\nサービス・データ", fill=WHITE, outline=TEAL, title_color=TEAL, title_size=22, subtitle_size=16)
    arrow(draw, [(845, 560), (875, 560), (875, 665), (905, 665)], color=BLUE, width=4, head=12)
    arrow(draw, [(845, 815), (875, 815), (875, 715), (905, 715)], color=BLUE, width=4, head=12)
    centered_text(draw, (660, 865, 1050, 925), "役割は分かれるが、クライアントも処理する", 18, BLUE_DARK, True)

    draw.rounded_rectangle((1120, 400, 1610, 940), radius=22, fill=TEAL_SOFT, outline=TEAL, width=3)
    label(draw, (1155, 435), "P2P", color=TEAL, size=29, bold=True)
    peers = [((1160, 520, 1330, 635), "ピアA"), ((1410, 520, 1580, 635), "ピアB"), ((1285, 735, 1455, 850), "ピアC")]
    for box, name in peers:
        rounded_box(draw, box, name, "受け取る＋提供する", fill=WHITE, outline=TEAL, title_color=TEAL, title_size=22, subtitle_size=16)
    # Connect only the outer edges of the boxes so the reciprocal arrows never
    # cross a node or its text.
    double_arrow(draw, (1330, 578), (1410, 578), TEAL)
    double_arrow(draw, (1245, 635), (1330, 735), TEAL)
    double_arrow(draw, (1495, 635), (1410, 735), TEAL)
    centered_text(draw, (1150, 865, 1580, 925), "各ピアが利用側にも提供側にもなる", 18, TEAL, True)
    save(image, "network/processing-models.png")


def build_shared_key_animation() -> None:
    frames: list[Image.Image] = []
    for stage in range(7):
        image = Image.new("RGB", (1700, 950), BG)
        draw = ImageDraw.Draw(image)
        heading(draw, "共通鍵暗号方式：同じ共通鍵Kで暗号化・復号する", "青＝本文・暗号文の流れ　橙＝外へ漏らしてはいけない共通鍵K")
        steps = ["① 共通鍵Kを共有", "② 共通鍵Kで暗号化", "③ 暗号文を作る", "④ 暗号文を送る", "⑤ 共通鍵Kで復号", "⑥ 平文を受信"]
        for index, item in enumerate(steps):
            x1 = 55 + index * 270
            active = index < stage
            draw.rounded_rectangle((x1, 175, x1 + 250, 230), radius=16, fill=BLUE_SOFT if active else WHITE, outline=BLUE if active else LINE, width=2)
            centered_text(draw, (x1, 175, x1 + 250, 230), item, 16, BLUE_DARK if active else MUTED, active)

        sender = (60, 350, 300, 555)
        encrypt = (360, 350, 650, 555)
        ciphertext = (710, 350, 990, 555)
        decrypt = (1050, 350, 1340, 555)
        receiver = (1400, 350, 1640, 555)
        rounded_box(draw, sender, "送信者", "平文\n『テストは9時』", fill=BLUE_SOFT, outline=BLUE, title_color=BLUE_DARK, title_size=27)
        rounded_box(draw, encrypt, "暗号化", "平文と共通鍵Kから\n暗号文を作る", fill=WHITE, outline=ORANGE, title_color=ORANGE, title_size=27)
        rounded_box(draw, ciphertext, "暗号文", "鍵を知らなければ\n内容を読みにくい", fill=WHITE, outline=BLUE, title_size=27)
        rounded_box(draw, decrypt, "復号", "暗号文と共通鍵Kから\n元の平文へ戻す", fill=WHITE, outline=ORANGE, title_color=ORANGE, title_size=27)
        rounded_box(draw, receiver, "受信者", "復号した平文\n『テストは9時』", fill=BLUE_SOFT, outline=BLUE, title_color=BLUE_DARK, title_size=27)

        if stage >= 1:
            rounded_box(draw, (430, 665, 580, 740), "共通鍵K", fill=ORANGE_SOFT, outline=ORANGE, title_color=ORANGE, title_size=21)
            rounded_box(draw, (1120, 665, 1270, 740), "共通鍵K", fill=ORANGE_SOFT, outline=ORANGE, title_color=ORANGE, title_size=21)
            arrow(draw, [(580, 703), (1120, 703)], color=ORANGE, dash=True, width=4, head=13)
            label(draw, (850, 675), "通信前に、安全な方法で同じ共通鍵Kを共有", color=ORANGE, size=18, bold=True, anchor="mm")
        if stage >= 2:
            arrow(draw, [(300, 452), (360, 452)], color=BLUE)
            arrow(draw, [(505, 665), (505, 555)], color=ORANGE)
        if stage >= 3:
            arrow(draw, [(650, 452), (710, 452)], color=BLUE)
        if stage >= 4:
            arrow(draw, [(990, 452), (1050, 452)], color=BLUE)
        if stage >= 5:
            arrow(draw, [(1195, 665), (1195, 555)], color=ORANGE)
        if stage >= 6:
            arrow(draw, [(1340, 452), (1400, 452)], color=BLUE)
            draw.rounded_rectangle((1010, 805, 1640, 880), radius=16, fill=TEAL_SOFT, outline=TEAL, width=2)
            centered_text(draw, (1030, 805, 1620, 880), "送信者 → 暗号化 → 暗号文 → 復号 → 受信者\n暗号化と復号に同じ共通鍵Kを使う", 18, TEAL, True)
        frames.append(image)
    save_gif(frames, "network/shared-key-encryption.gif", [1000, 1400, 1200, 1100, 1100, 1200, 4200])


def build_public_key_animation() -> None:
    frames: list[Image.Image] = []
    for stage in range(8):
        image = Image.new("RGB", (1700, 1050), BG)
        draw = ImageDraw.Draw(image)
        heading(draw, "公開鍵暗号方式：公開鍵Pで暗号化し、秘密鍵Sで復号する", "青＝本文・暗号文　青緑＝公開してよい鍵P　橙＝受信者だけが保管する鍵S")
        steps = ["① 鍵ペアを生成", "② 公開鍵Pを公開", "③ 公開鍵Pを取得", "④ 公開鍵Pで暗号化", "⑤ 暗号文を送る", "⑥ 秘密鍵Sで復号", "⑦ 平文を受信"]
        for index, item in enumerate(steps):
            x1 = 40 + index * 237
            active = index < stage
            draw.rounded_rectangle((x1, 175, x1 + 220, 230), radius=16, fill=TEAL_SOFT if active else WHITE, outline=TEAL if active else LINE, width=2)
            centered_text(draw, (x1, 175, x1 + 220, 230), item, 15, TEAL if active else MUTED, active)

        sender = (60, 335, 300, 540)
        encrypt = (360, 335, 650, 540)
        ciphertext = (710, 335, 990, 540)
        decrypt = (1050, 335, 1340, 540)
        receiver = (1400, 335, 1640, 540)
        rounded_box(draw, sender, "送信者", "受信者へ秘密に\n平文を送りたい", fill=BLUE_SOFT, outline=BLUE, title_color=BLUE_DARK, title_size=27)
        rounded_box(draw, encrypt, "暗号化", "受信者の公開鍵Pで\n平文を暗号化", fill=WHITE, outline=TEAL, title_color=TEAL, title_size=27)
        rounded_box(draw, ciphertext, "暗号文", "公開鍵Pでは\n平文へ戻せない", fill=WHITE, outline=BLUE, title_size=27)
        rounded_box(draw, decrypt, "復号", "受信者の秘密鍵Sで\n元の平文へ戻す", fill=WHITE, outline=ORANGE, title_color=ORANGE, title_size=27)
        rounded_box(draw, receiver, "受信者", "公開鍵P・秘密鍵Sを作り\n秘密鍵Sを保管", fill=BLUE_SOFT, outline=BLUE, title_color=BLUE_DARK, title_size=27)

        # First show both keys directly under the receiver: the receiver created them.
        if stage == 1:
            rounded_box(draw, (1405, 660, 1515, 735), "公開鍵P", fill=TEAL_SOFT, outline=TEAL, title_color=TEAL, title_size=18)
            rounded_box(draw, (1525, 660, 1635, 735), "秘密鍵S", fill=ORANGE_SOFT, outline=ORANGE, title_color=ORANGE, title_size=18)
            label(draw, (1520, 625), "受信者が鍵ペアを生成", color=INK, size=18, bold=True, anchor="mm")

        # Then move P to a public position while S remains under the receiver.
        if stage >= 2:
            rounded_box(draw, (785, 660, 935, 735), "公開鍵P", fill=TEAL_SOFT, outline=TEAL, title_color=TEAL, title_size=21)
            rounded_box(draw, (1485, 660, 1635, 735), "秘密鍵S", fill=ORANGE_SOFT, outline=ORANGE, title_color=ORANGE, title_size=21)
            label(draw, (860, 625), "公開された鍵", color=TEAL, size=17, bold=True, anchor="mm")
            label(draw, (1560, 625), "受信者だけが保管", color=ORANGE, size=17, bold=True, anchor="mm")
            arrow(draw, [(1485, 697), (1110, 697), (935, 697)], color=TEAL, dash=True, width=4, head=13)
            label(draw, (1210, 730), "公開鍵Pだけを公開する", color=TEAL, size=17, bold=True, anchor="mm")

        # The sender obtains a copy of the published public key.
        if stage >= 3:
            rounded_box(draw, (430, 660, 580, 735), "公開鍵P", fill=TEAL_SOFT, outline=TEAL, title_color=TEAL, title_size=21)
            arrow(draw, [(785, 697), (580, 697)], color=TEAL, dash=True, width=4, head=13)
            label(draw, (680, 730), "送信者が公開鍵Pを取得", color=TEAL, size=17, bold=True, anchor="mm")

        if stage >= 4:
            arrow(draw, [(300, 437), (360, 437)], color=BLUE)
            arrow(draw, [(505, 660), (505, 540)], color=TEAL)
        if stage >= 5:
            arrow(draw, [(650, 437), (710, 437)], color=BLUE)
        if stage >= 6:
            arrow(draw, [(990, 437), (1050, 437)], color=BLUE)
            arrow(draw, [(1485, 697), (1380, 697), (1380, 585), (1195, 585), (1195, 540)], color=ORANGE)
        if stage >= 7:
            arrow(draw, [(1340, 437), (1400, 437)], color=BLUE)
            draw.rounded_rectangle((790, 870, 1640, 975), radius=16, fill=TEAL_SOFT, outline=TEAL, width=2)
            centered_text(draw, (815, 870, 1615, 975), "受信者が公開鍵P・秘密鍵Sを生成 → 公開鍵Pだけ公開 → 送信者が取得\n送信者は公開鍵Pで暗号化し、受信者は外へ出していない秘密鍵Sで復号", 18, TEAL, True)
        frames.append(image)
    save_gif(frames, "network/public-key-encryption.gif", [1000, 1600, 1600, 1600, 1200, 1200, 1200, 4200])


def build_cryptography_overview() -> None:
    image = Image.new("RGB", (1700, 1120), BG)
    draw = ImageDraw.Draw(image)
    heading(draw, "共通鍵暗号と公開鍵暗号：鍵を用意する人から追う", "青＝本文の流れ　青緑＝公開して渡せる鍵　橙＝外へ出してはいけない鍵")

    draw.rounded_rectangle((70, 190, 1630, 590), radius=28, fill=WHITE, outline=LINE, width=3)
    label(draw, (105, 225), "共通鍵暗号方式", color=BLUE_DARK, size=31, bold=True)
    label(draw, (105, 270), "送信者と受信者が、暗号化にも復号にも同じ共通鍵Kを使う", color=MUTED, size=20)
    rounded_box(draw, (120, 360, 360, 500), "送信者", "平文を用意", fill=BLUE_SOFT, outline=BLUE, title_size=27)
    rounded_box(draw, (620, 360, 880, 500), "暗号文", "途中で見られても\n内容を読みにくくする", fill=WHITE, outline=BLUE, title_size=27)
    rounded_box(draw, (1330, 360, 1570, 500), "受信者", "平文へ戻す", fill=BLUE_SOFT, outline=BLUE, title_size=27)
    rounded_box(draw, (390, 315, 580, 385), "共通鍵K", fill=ORANGE_SOFT, outline=ORANGE, title_color=ORANGE, title_size=23)
    rounded_box(draw, (1090, 315, 1280, 385), "共通鍵K", fill=ORANGE_SOFT, outline=ORANGE, title_color=ORANGE, title_size=23)
    arrow(draw, [(360, 430), (620, 430)], color=BLUE)
    label(draw, (490, 405), "共通鍵Kで暗号化", color=ORANGE, size=18, bold=True, anchor="mm")
    arrow(draw, [(880, 430), (1330, 430)], color=BLUE)
    label(draw, (1105, 405), "共通鍵Kで復号", color=ORANGE, size=18, bold=True, anchor="mm")
    arrow(draw, [(485, 315), (485, 295), (1185, 295), (1185, 315)], color=ORANGE, dash=True)
    label(draw, (835, 270), "通信を始める前に、同じ鍵を安全に共有する必要がある", color=ORANGE, size=18, bold=True, anchor="mm")

    draw.rounded_rectangle((70, 635, 1630, 1040), radius=28, fill=WHITE, outline=LINE, width=3)
    label(draw, (105, 670), "公開鍵暗号方式（受信者へ秘密に送りたい場合）", color=BLUE_DARK, size=31, bold=True)
    label(draw, (105, 715), "受信者が鍵ペアを作り、公開鍵だけを渡す。秘密鍵は受信者が保管する", color=MUTED, size=20)
    rounded_box(draw, (120, 830, 360, 970), "送信者", "受信者の公開鍵で\n平文を暗号化", fill=BLUE_SOFT, outline=BLUE, title_size=27)
    rounded_box(draw, (690, 830, 950, 970), "暗号文", "公開鍵から秘密鍵を\n求めることは困難", fill=WHITE, outline=BLUE, title_size=27)
    rounded_box(draw, (1330, 830, 1570, 970), "受信者", "自分の秘密鍵で\n復号", fill=BLUE_SOFT, outline=BLUE, title_size=27)
    rounded_box(draw, (1050, 765, 1260, 835), "公開鍵P", fill=TEAL_SOFT, outline=TEAL, title_color=TEAL, title_size=23)
    rounded_box(draw, (1360, 765, 1570, 835), "秘密鍵S", fill=ORANGE_SOFT, outline=ORANGE, title_color=ORANGE, title_size=23)
    arrow(draw, [(1435, 765), (1435, 745), (1155, 745), (1155, 765)], color=TEAL)
    label(draw, (1295, 720), "受信者が鍵ペアを生成", color=INK, size=18, bold=True, anchor="mm")
    arrow(draw, [(1050, 800), (520, 800), (520, 850), (360, 850)], color=TEAL)
    label(draw, (700, 775), "公開鍵Pを送信者へ（公開してよい）", color=TEAL, size=18, bold=True, anchor="mm")
    arrow(draw, [(360, 920), (690, 920)], color=BLUE)
    arrow(draw, [(950, 920), (1330, 920)], color=BLUE)
    label(draw, (1140, 895), "秘密鍵Sで復号", color=ORANGE, size=18, bold=True, anchor="mm")
    save(image, "network/cryptography.png")


def build_hybrid_encryption() -> None:
    image = Image.new("RGB", (1700, 1040), BG)
    draw = ImageDraw.Draw(image)
    heading(draw, "ハイブリッド暗号の一例：共通鍵Kと本文で方式を使い分ける", "共通鍵Kは公開鍵暗号で送り、本文は共有できた共通鍵Kで暗号化する")

    draw.rounded_rectangle((70, 190, 1630, 535), radius=28, fill=WHITE, outline=LINE, width=3)
    label(draw, (105, 225), "段階1　共通鍵Kを、受信者の公開鍵Pで暗号化して送る", color=BLUE_DARK, size=29, bold=True)
    rounded_box(draw, (120, 340, 390, 470), "送信者", "ランダムな\n共通鍵Kを作る", fill=BLUE_SOFT, outline=BLUE, title_size=26)
    rounded_box(draw, (555, 340, 880, 470), "共通鍵Kを暗号化", "受信者の公開鍵Pで\n共通鍵Kを読めない形にする", fill=TEAL_SOFT, outline=TEAL, title_color=TEAL, title_size=23)
    rounded_box(draw, (1320, 340, 1580, 470), "受信者", "秘密鍵Sで\n共通鍵Kを取り出す", fill=BLUE_SOFT, outline=BLUE, title_size=26)
    rounded_box(draw, (1030, 260, 1220, 325), "公開鍵P", fill=TEAL_SOFT, outline=TEAL, title_color=TEAL, title_size=22)
    rounded_box(draw, (1370, 260, 1560, 325), "秘密鍵S", fill=ORANGE_SOFT, outline=ORANGE, title_color=ORANGE, title_size=22)
    arrow(draw, [(1125, 325), (1125, 365), (880, 365)], color=TEAL)
    arrow(draw, [(390, 405), (555, 405)], color=BLUE)
    arrow(draw, [(880, 405), (1320, 405)], color=BLUE)
    label(draw, (1100, 380), "送る", color=BLUE_DARK, size=18, bold=True, anchor="mm")
    arrow(draw, [(1465, 325), (1465, 340)], color=ORANGE)

    draw.rounded_rectangle((70, 585, 1630, 900), radius=28, fill=WHITE, outline=LINE, width=3)
    label(draw, (105, 620), "段階2　共有できた共通鍵Kで、本文を高速に暗号化", color=BLUE_DARK, size=29, bold=True)
    rounded_box(draw, (120, 725, 390, 840), "送信者", "共通鍵Kで本文を暗号化", fill=BLUE_SOFT, outline=BLUE, title_size=26)
    rounded_box(draw, (690, 725, 960, 840), "暗号化された本文", "大きなデータを\n効率よく送れる", fill=WHITE, outline=BLUE, title_size=26)
    rounded_box(draw, (1320, 725, 1580, 840), "受信者", "同じ共通鍵Kで復号", fill=BLUE_SOFT, outline=BLUE, title_size=26)
    rounded_box(draw, (410, 680, 565, 745), "共通鍵K", fill=ORANGE_SOFT, outline=ORANGE, title_color=ORANGE, title_size=22)
    rounded_box(draw, (1120, 680, 1275, 745), "共通鍵K", fill=ORANGE_SOFT, outline=ORANGE, title_color=ORANGE, title_size=22)
    arrow(draw, [(390, 785), (690, 785)], color=BLUE)
    arrow(draw, [(960, 785), (1320, 785)], color=BLUE)

    draw.rounded_rectangle((70, 935, 1630, 995), radius=14, fill=WHITE, outline=LINE, width=2)
    centered_text(draw, (95, 935, 1605, 995), "これはハイブリッド暗号の一例。現在のTLSでは、一時的な鍵交換から両者が同じ共通鍵を導出する方式が一般的。", 18, MUTED)
    save(image, "network/hybrid-encryption.png")


def build_digital_signature() -> None:
    image = Image.new("RGB", (1800, 1400), BG)
    draw = ImageDraw.Draw(image)
    heading(draw, "デジタル署名：署名生成から検証結果までを1〜9で追う", "代表的な「本文をハッシュして署名する」モデル。署名は本文を隠す暗号化ではない")

    draw.rounded_rectangle((70, 185, 1730, 560), radius=28, fill=WHITE, outline=LINE, width=3)
    label(draw, (110, 225), "A　署名者がデジタル署名を作り、本文と一緒に送る", color=BLUE_DARK, size=31, bold=True)
    rounded_box(draw, (105, 315, 330, 455), "1 本文", "送る内容", fill=BLUE_SOFT, outline=BLUE, title_size=25)
    rounded_box(draw, (410, 315, 700, 455), "2 ハッシュ関数", "本文から\n要約値Aを計算", fill=WHITE, outline=BLUE, title_size=24)
    rounded_box(draw, (790, 315, 1130, 455), "3 署名生成", "要約値Aと秘密鍵から\nデジタル署名を作る", fill=WHITE, outline=ORANGE, title_color=ORANGE, title_size=24)
    rounded_box(draw, (1230, 315, 1690, 455), "4 本文＋署名を送信", "本文とデジタル署名を\n受信者へ送る", fill=BLUE_SOFT, outline=BLUE, title_size=25)
    arrow(draw, [(330, 385), (410, 385)], color=BLUE)
    arrow(draw, [(700, 385), (790, 385)], color=BLUE)
    arrow(draw, [(1130, 385), (1230, 385)], color=BLUE)
    rounded_box(draw, (835, 480, 1085, 540), "署名者の秘密鍵", fill=ORANGE_SOFT, outline=ORANGE, title_color=ORANGE, title_size=20)
    arrow(draw, [(960, 480), (960, 455)], color=ORANGE, width=5, head=14)
    label(draw, (120, 505), "秘密鍵は署名者だけが保管し、受信者へ送らない", color=ORANGE, size=18, bold=True)

    draw.rounded_rectangle((70, 630, 1730, 1260), radius=28, fill=WHITE, outline=LINE, width=3)
    label(draw, (110, 670), "B　5→6と、届いた署名→7を、8で合流させて検証する", color=BLUE_DARK, size=31, bold=True)

    rounded_box(draw, (1480, 770, 1700, 920), "5 受信した本文", "送られてきた\n本文", fill=BLUE_SOFT, outline=BLUE, title_size=23)
    rounded_box(draw, (1130, 770, 1410, 920), "6 要約値Bを計算", "受信した本文から\n要約値Bを計算", fill=WHITE, outline=BLUE, title_size=22)
    rounded_box(draw, (820, 1010, 1110, 1170), "7 署名を検証", "届いた署名と公開鍵から\n署名側の要約値Aを確認", fill=WHITE, outline=TEAL, title_color=TEAL, title_size=23)
    rounded_box(draw, (470, 770, 760, 940), "8 AとBを比較", "6の要約値Bと\n7の要約値Aを比べる", fill=WHITE, outline=BLUE, title_size=24)
    rounded_box(draw, (100, 770, 350, 920), "9 結果", "一致：有効\n不一致：無効", fill=TEAL_SOFT, outline=TEAL, title_color=TEAL, title_size=25)
    arrow(draw, [(1480, 845), (1410, 845)], color=BLUE)
    arrow(draw, [(1130, 845), (760, 845)], color=BLUE)
    arrow(draw, [(820, 1090), (790, 1090), (790, 970), (615, 970), (615, 940)], color=TEAL)
    arrow(draw, [(470, 845), (350, 845)], color=BLUE)

    arrow(draw, [(1510, 455), (1510, 720), (1590, 720), (1590, 770)], color=BLUE)
    label(draw, (1540, 600), "送信した本文", color=BLUE_DARK, size=18, bold=True, anchor="lm")
    arrow(draw, [(1650, 455), (1650, 580), (1710, 580), (1710, 1210), (965, 1210), (965, 1170)], color=BLUE)
    label(draw, (1685, 620), "届いたデジタル署名", color=BLUE_DARK, size=18, bold=True, anchor="rm")

    rounded_box(draw, (1160, 1050, 1410, 1120), "署名者の公開鍵", fill=TEAL_SOFT, outline=TEAL, title_color=TEAL, title_size=20)
    arrow(draw, [(1160, 1085), (1110, 1085)], color=TEAL, width=5, head=14)
    label(draw, (1180, 1145), "本人との対応は証明書などで別に確認", color=MUTED, size=17, bold=True, anchor="lm")

    draw.rounded_rectangle((70, 1290, 1730, 1370), radius=16, fill=WHITE, outline=LINE, width=2)
    centered_text(draw, (95, 1290, 1705, 1370), "これはAとBを照合する学習用モデル。実際には方式によって7・8を一体で処理し、Aをそのまま取り出さず有効性を判定する。", 18, MUTED)
    save(image, "network/digital-signature.png")


def build_sound_digitization() -> None:
    image = Image.new("RGB", (1700, 960), BG)
    draw = ImageDraw.Draw(image)
    heading(draw, "音のデジタル化：標本化 → 量子化 → 符号化", "縦方向の段階値は、上ほど大きく、下ほど小さい")

    panels = [(60, 190, 545, 855), (610, 190, 1095, 855), (1160, 190, 1645, 855)]
    for box in panels:
        draw.rounded_rectangle(box, radius=26, fill=WHITE, outline=LINE, width=3)
    label(draw, (95, 230), "1 標本化", color=BLUE_DARK, size=29, bold=True)
    label(draw, (645, 230), "2 量子化", color=BLUE_DARK, size=29, bold=True)
    label(draw, (1195, 230), "3 符号化", color=BLUE_DARK, size=29, bold=True)

    # Smooth analogue waveform and equally spaced sampling points.
    curve: list[tuple[int, int]] = []
    for offset in range(0, 390, 3):
        x = 105 + offset
        y = 505 - int(150 * math.sin(offset / 62))
        curve.append((x, y))
    draw.line(curve, fill=ORANGE, width=6, joint="curve")
    for offset in range(10, 390, 47):
        x = 105 + offset
        y = 505 - int(150 * math.sin(offset / 62))
        draw.line((x, 735, x, y), fill="#A8C9D1", width=3)
        draw.ellipse((x - 8, y - 8, x + 8, y + 8), fill=BLUE)
    centered_text(draw, (90, 750, 515, 820), "一定時間ごとに振幅を測る\n横方向を細かく区切る", 19, MUTED, True)

    # Quantization: level 7 is visually highest, level 0 is lowest.
    level_y = {value: 305 + (7 - value) * 56 for value in range(8)}
    for value in range(7, -1, -1):
        y = level_y[value]
        draw.line((690, y, 1040, y), fill="#CFE0E3", width=2)
        label(draw, (675, y), str(value), color=INK, size=17, bold=True, anchor="rm")
    values = [1, 3, 6, 7, 5, 2, 1, 3, 6]
    for index, value in enumerate(values):
        x = 705 + index * 40
        y = level_y[value]
        draw.ellipse((x - 8, y - 8, x + 8, y + 8), fill=BLUE)
        if index:
            previous_x = 705 + (index - 1) * 40
            previous_y = level_y[values[index - 1]]
            draw.line((previous_x, previous_y, x, previous_y, x, y), fill=BLUE, width=3)
    label(draw, (665, 292), "大", color=ORANGE, size=17, bold=True, anchor="rm")
    label(draw, (665, 710), "小", color=ORANGE, size=17, bold=True, anchor="rm")
    centered_text(draw, (640, 750, 1065, 820), "各標本値を最も近い段階へ丸める\n8段階なら3ビットで表せる", 19, MUTED, True)

    # Encoding table in descending visual order.
    draw.rounded_rectangle((1210, 300, 1595, 735), radius=20, fill=BG, outline=LINE, width=2)
    for row, value in enumerate(range(7, -1, -1)):
        y1 = 315 + row * 50
        if row:
            draw.line((1230, y1, 1575, y1), fill=LINE, width=1)
        label(draw, (1260, y1 + 25), f"段階 {value}", color=INK, size=19, bold=True, anchor="lm")
        label(draw, (1530, y1 + 25), format(value, "03b"), color=BLUE_DARK, size=24, bold=True, anchor="rm")
    centered_text(draw, (1190, 760, 1615, 820), "段階番号を2進数へ置き換える\n上の大きな段階ほど番号も大きい", 19, MUTED, True)

    arrow(draw, [(545, 520), (610, 520)], color=BLUE, width=5, head=14)
    arrow(draw, [(1095, 520), (1160, 520)], color=BLUE, width=5, head=14)
    draw.rounded_rectangle((225, 880, 1475, 935), radius=14, fill=WHITE, outline=LINE, width=2)
    centered_text(draw, (245, 880, 1455, 935), "標本化周波数は時間方向、量子化ビット数は振幅方向の細かさを決める。どちらを増やしてもデータ量は増える。", 18, MUTED)
    save(image, "digital/sound-digitization.png")


def flow_terminal(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], text: str) -> None:
    draw.rounded_rectangle(box, radius=32, fill=WHITE, outline=BLUE, width=4)
    centered_text(draw, box, text, 22, INK, True)


def flow_process(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], text: str) -> None:
    draw.rectangle(box, fill=WHITE, outline=BLUE, width=4)
    centered_text(draw, box, text, 21, INK, True)


def flow_io(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], text: str) -> None:
    x1, y1, x2, y2 = box
    slant = 25
    poly = [(x1 + slant, y1), (x2, y1), (x2 - slant, y2), (x1, y2)]
    draw.polygon(poly, fill=BLUE_SOFT, outline=BLUE)
    draw.line(poly + [poly[0]], fill=BLUE, width=4)
    centered_text(draw, box, text, 20, INK, True)


def flow_decision(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], text: str) -> None:
    x1, y1, x2, y2 = box
    poly = [((x1 + x2) // 2, y1), (x2, (y1 + y2) // 2), ((x1 + x2) // 2, y2), (x1, (y1 + y2) // 2)]
    draw.polygon(poly, fill=WHITE, outline=BLUE)
    draw.line(poly + [poly[0]], fill=BLUE, width=4)
    centered_text(draw, box, text, 19, INK, True)


def flow_loop(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], text: str, *, start: bool) -> None:
    x1, y1, x2, y2 = box
    cut = 23
    if start:
        poly = [(x1 + cut, y1), (x2 - cut, y1), (x2, y1 + cut), (x2, y2), (x1, y2), (x1, y1 + cut)]
    else:
        poly = [(x1, y1), (x2, y1), (x2, y2 - cut), (x2 - cut, y2), (x1 + cut, y2), (x1, y2 - cut)]
    draw.polygon(poly, fill=TEAL_SOFT, outline=TEAL)
    draw.line(poly + [poly[0]], fill=TEAL, width=4)
    centered_text(draw, box, text, 18, INK, True)


def build_basic_flowcharts() -> None:
    image = Image.new("RGB", (1800, 1080), BG)
    draw = ImageDraw.Draw(image)
    heading(draw, "順次・分岐・反復を、正しいフローチャート記号で読む", "上から下へ流れ、どの構造も開始から終了までたどれる")

    panels = [(55, 180, 565, 1010), (645, 180, 1155, 1010), (1235, 180, 1745, 1010)]
    for box in panels:
        draw.rounded_rectangle(box, radius=28, fill=WHITE, outline=LINE, width=3)

    label(draw, (310, 225), "順次", color=BLUE_DARK, size=31, bold=True, anchor="mm")
    flow_terminal(draw, (175, 280, 445, 345), "開始")
    arrow(draw, [(310, 345), (310, 390)], color=BLUE, width=5, head=14)
    flow_io(draw, (150, 390, 470, 470), "数値を入力")
    arrow(draw, [(310, 470), (310, 520)], color=BLUE, width=5, head=14)
    flow_process(draw, (150, 520, 470, 600), "数値を2倍する")
    arrow(draw, [(310, 600), (310, 650)], color=BLUE, width=5, head=14)
    flow_io(draw, (150, 650, 470, 730), "結果を表示")
    arrow(draw, [(310, 730), (310, 790)], color=BLUE, width=5, head=14)
    flow_terminal(draw, (175, 790, 445, 855), "終了")
    centered_text(draw, (105, 890, 515, 970), "処理を上から順番に\n一度ずつ実行する", 20, MUTED)

    label(draw, (900, 225), "分岐", color=BLUE_DARK, size=31, bold=True, anchor="mm")
    flow_terminal(draw, (765, 275, 1035, 340), "開始")
    arrow(draw, [(900, 340), (900, 380)], color=BLUE, width=5, head=14)
    flow_decision(draw, (760, 380, 1040, 515), "点数が\n60以上？")
    arrow(draw, [(760, 447), (710, 447), (710, 590), (760, 590)], color=BLUE, width=5, head=14)
    label(draw, (700, 420), "はい", color=BLUE_DARK, size=17, bold=True, anchor="mm")
    arrow(draw, [(1040, 447), (1090, 447), (1090, 590), (1040, 590)], color=BLUE, width=5, head=14)
    label(draw, (1100, 420), "いいえ", color=BLUE_DARK, size=17, bold=True, anchor="mm")
    flow_io(draw, (660, 590, 850, 680), "「合格」\nと表示")
    flow_io(draw, (950, 590, 1140, 680), "「再挑戦」\nと表示")
    draw.line([(755, 680), (755, 735), (900, 735)], fill=BLUE, width=5)
    draw.line([(1045, 680), (1045, 735), (900, 735)], fill=BLUE, width=5)
    arrow(draw, [(900, 735), (900, 790)], color=BLUE, width=5, head=14)
    flow_terminal(draw, (765, 790, 1035, 855), "終了")
    centered_text(draw, (695, 890, 1105, 970), "条件の結果に応じて\nどちらか一方を実行する", 20, MUTED)

    label(draw, (1490, 225), "反復", color=BLUE_DARK, size=31, bold=True, anchor="mm")
    flow_terminal(draw, (1355, 275, 1625, 340), "開始")
    arrow(draw, [(1490, 340), (1490, 385)], color=BLUE, width=5, head=14)
    flow_loop(draw, (1310, 385, 1670, 485), "iを1から3まで\n1ずつ増やす", start=True)
    arrow(draw, [(1490, 485), (1490, 535)], color=BLUE, width=5, head=14)
    flow_io(draw, (1330, 535, 1650, 615), "iを表示")
    arrow(draw, [(1490, 615), (1490, 665)], color=BLUE, width=5, head=14)
    flow_loop(draw, (1310, 665, 1670, 745), "繰返し終端", start=False)
    arrow(draw, [(1490, 745), (1490, 790)], color=BLUE, width=5, head=14)
    flow_terminal(draw, (1355, 790, 1625, 855), "終了")
    draw.line([(1285, 390), (1265, 390), (1265, 745), (1285, 745)], fill=TEAL, width=4)
    label(draw, (1250, 568), "こ\nの\n範\n囲\nを\n繰\nり\n返\nす", color=TEAL, size=15, bold=True, anchor="rm")
    centered_text(draw, (1285, 890, 1695, 970), "繰返し始端と終端を対にし、\nその間を指定された回数実行する", 20, MUTED)

    save(image, "programming/basic-structures.png")


def build_full_adder() -> None:
    image = Image.new("RGB", (1700, 820), BG)
    draw = ImageDraw.Draw(image)
    heading(
        draw,
        "全加算器：同じ桁の2数と、下位桁からの繰り上がりを加える",
        "青＝その桁の和　橙＝上位桁へ渡す繰り上がり",
    )

    first = (360, 235, 690, 410)
    second = (790, 455, 1120, 630)
    combine = (1200, 235, 1470, 390)
    rounded_box(draw, first, "半加算器①", "A と B を加える\nS₁（和）と C₁（繰り上がり）", fill=WHITE, outline=BLUE, title_color=BLUE_DARK)
    rounded_box(draw, second, "半加算器②", "S₁ と Cin を加える\nS（和）と C₂（繰り上がり）", fill=WHITE, outline=BLUE, title_color=BLUE_DARK)
    rounded_box(draw, combine, "OR回路", "C₁またはC₂が1なら\nCoutを1にする", fill=ORANGE_SOFT, outline=ORANGE, title_color=ORANGE)

    label(draw, (95, 275), "A", size=32, bold=True)
    label(draw, (95, 365), "B", size=32, bold=True)
    arrow(draw, [(140, 285), (360, 285)], color=BLUE)
    arrow(draw, [(140, 375), (360, 375)], color=BLUE)

    label(draw, (95, 560), "Cin", size=32, bold=True)
    label(draw, (95, 603), "下位桁から届く1", size=19, color=MUTED)
    arrow(draw, [(220, 565), (790, 565)], color=ORANGE)

    arrow(draw, [(690, 360), (740, 360), (740, 505), (790, 505)], color=BLUE)
    label(draw, (720, 385), "S₁", color=BLUE_DARK, size=24, bold=True, anchor="ma")

    arrow(draw, [(690, 275), (1200, 275)], color=ORANGE)
    label(draw, (930, 238), "C₁", color=ORANGE, size=24, bold=True, anchor="mm")
    arrow(draw, [(1120, 505), (1160, 505), (1160, 350), (1200, 350)], color=ORANGE)
    label(draw, (1145, 450), "C₂", color=ORANGE, size=24, bold=True, anchor="rm")

    arrow(draw, [(1120, 590), (1540, 590)], color=BLUE)
    label(draw, (1580, 590), "S", color=BLUE_DARK, size=36, bold=True, anchor="lm")
    label(draw, (1370, 550), "いまの桁に書く数", color=MUTED, size=19, anchor="mm")

    arrow(draw, [(1470, 315), (1540, 315)], color=ORANGE)
    label(draw, (1580, 315), "Cout", color=ORANGE, size=34, bold=True, anchor="lm")
    label(draw, (1375, 425), "上位桁へ渡す1", color=MUTED, size=19, anchor="mm")

    draw.rounded_rectangle((70, 700, 1630, 770), radius=16, fill=WHITE, outline=LINE, width=2)
    centered_text(
        draw,
        (95, 700, 1605, 770),
        "半加算器①でA＋Bを計算し、半加算器②で下位桁からの繰り上がりを加える。二か所で生じ得る繰り上がりをOR回路で一つにまとめる。",
        19,
        MUTED,
    )
    save(image, "digital/logic/full-adder.png")


def build_multi_bit_adder() -> None:
    image = Image.new("RGB", (1700, 860), BG)
    draw = ImageDraw.Draw(image)
    heading(
        draw,
        "3ビット加算：右の桁で生じた繰り上がりを、一つ左の桁へ渡す",
        "2進数の筆算を、半加算器と全加算器のつながりとして読む",
    )

    boxes = [
        ((1120, 315, 1430, 520), "最下位桁", "半加算器", "A₁ と B₁"),
        ((695, 315, 1005, 520), "2桁目", "全加算器", "A₂・B₂・C₁"),
        ((270, 315, 580, 520), "3桁目", "全加算器", "A₃・B₃・C₂"),
    ]
    for box, stage, block, inputs in boxes:
        x1, y1, x2, y2 = box
        draw.rounded_rectangle(box, radius=24, fill=WHITE, outline=BLUE, width=3)
        centered_text(draw, (x1, y1 + 18, x2, y1 + 62), stage, 20, MUTED, True)
        centered_text(draw, (x1, y1 + 66, x2, y1 + 126), block, 29, BLUE_DARK, True)
        centered_text(draw, (x1, y1 + 128, x2, y2 - 18), inputs, 22, INK)

    # Inputs descend into each digit block.
    for x, index in ((1275, 1), (850, 2), (425, 3)):
        label(draw, (x - 55, 245), f"A{chr(0x2080 + index)}", size=28, bold=True, anchor="mm")
        label(draw, (x + 55, 245), f"B{chr(0x2080 + index)}", size=28, bold=True, anchor="mm")
        arrow(draw, [(x - 55, 270), (x - 55, 315)], color=BLUE)
        arrow(draw, [(x + 55, 270), (x + 55, 315)], color=BLUE)

    # Sum outputs go downward to the corresponding answer digit.
    for x, index in ((1275, 1), (850, 2), (425, 3)):
        arrow(draw, [(x, 520), (x, 650)], color=BLUE)
        label(draw, (x, 680), f"S{chr(0x2080 + index)}", color=BLUE_DARK, size=34, bold=True, anchor="mm")

    # Carries move from the lower-order digit on the right to the next digit on the left.
    arrow(draw, [(1120, 385), (1035, 385), (1035, 440), (1005, 440)], color=ORANGE)
    label(draw, (1060, 350), "C₁", color=ORANGE, size=25, bold=True, anchor="mm")
    arrow(draw, [(695, 385), (610, 385), (610, 440), (580, 440)], color=ORANGE)
    label(draw, (635, 350), "C₂", color=ORANGE, size=25, bold=True, anchor="mm")
    arrow(draw, [(270, 385), (150, 385)], color=ORANGE)
    label(draw, (115, 385), "C", color=ORANGE, size=36, bold=True, anchor="mm")
    label(draw, (115, 435), "最終的な\n繰り上がり", color=MUTED, size=18, anchor="ma")

    draw.rounded_rectangle((190, 740, 1510, 810), radius=16, fill=WHITE, outline=LINE, width=2)
    centered_text(
        draw,
        (215, 740, 1485, 810),
        "A₃A₂A₁ ＋ B₃B₂B₁ ＝ C S₃S₂S₁　　右端だけは繰り上がり入力がないため半加算器を使う。",
        22,
        INK,
        True,
    )
    save(image, "digital/logic/multi-bit-adder.png")


def build_time_series_chart() -> None:
    # Statistics Bureau of Japan, Family Income and Expenditure Survey,
    # two-or-more-person households, monthly consumption expenditures.
    values = {
        2017: [279249, 260644, 297942, 295929, 283056, 268802, 279197, 280320, 268802, 282872, 277361, 322157],
        2018: [289703, 265614, 301230, 294439, 281307, 267641, 283387, 292481, 271273, 290396, 281041, 329271],
        2019: [296345, 271232, 309274, 301136, 300901, 276882, 288026, 296327, 300609, 279671, 278765, 321380],
        2020: [287173, 271735, 292214, 267922, 252017, 273699, 266897, 276360, 269863, 283508, 278718, 315007],
        2021: [267760, 252451, 309800, 301043, 281063, 260285, 267710, 266638, 265306, 281996, 277029, 317206],
    }
    monthly_baseline = [mean(values[year][month] for year in (2017, 2018, 2019)) for month in range(12)]
    overall = mean(monthly_baseline)
    seasonal_index = [value / overall for value in monthly_baseline]

    dates: list[datetime] = []
    raw: list[float] = []
    adjusted: list[float] = []
    for year in (2019, 2020, 2021):
        for month in range(1, 13):
            dates.append(datetime(year, month, 1))
            value = values[year][month - 1]
            raw.append(value / 10_000)
            adjusted.append(value / seasonal_index[month - 1] / 10_000)

    fp = FontProperties(fname=str(FONT_REGULAR))
    fp_bold = FontProperties(fname=str(FONT_BOLD))
    fig, ax = plt.subplots(figsize=(16, 9), dpi=120)
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(WHITE)
    ax.plot(dates, raw, color="#9AA9AE", linewidth=2.4, label="原系列（月ごとの支出金額）", zorder=2)
    ax.plot(dates, adjusted, color=BLUE, linewidth=3.6, label="季節調整済み（教材用の簡易計算）", zorder=3)
    ax.axvspan(datetime(2020, 4, 1), datetime(2020, 6, 1), color=ORANGE_SOFT, alpha=1.0, zorder=1)

    march_index = 14
    may_index = 16
    ax.scatter([dates[march_index], dates[may_index]], [adjusted[march_index], adjusted[may_index]], color=ORANGE, s=72, zorder=5)
    ax.annotate(
        "2020年3月 約27.8万円",
        (dates[march_index], adjusted[march_index]),
        xytext=(-105, 40),
        textcoords="offset points",
        fontproperties=fp_bold,
        fontsize=12,
        color=INK,
        arrowprops={"arrowstyle": "-", "color": ORANGE, "lw": 1.5},
    )
    ax.annotate(
        "2020年5月 約25.2万円\n3月から約9.5%低下",
        (dates[may_index], adjusted[may_index]),
        xytext=(28, -42),
        textcoords="offset points",
        fontproperties=fp_bold,
        fontsize=12,
        color=ORANGE,
        arrowprops={"arrowstyle": "->", "color": ORANGE, "lw": 1.8},
    )

    ax.set_title(
        "月別消費支出：季節要因をならすと、2020年春の落ち込みが見える",
        loc="left",
        pad=24,
        fontproperties=fp_bold,
        fontsize=23,
        color=INK,
    )
    ax.text(
        0,
        1.015,
        "二人以上の世帯・1世帯当たり1か月・名目値。2017〜2019年の月別平均から季節指数を作成。",
        transform=ax.transAxes,
        fontproperties=fp,
        fontsize=12,
        color=MUTED,
    )
    ax.set_ylabel("支出金額（万円）", fontproperties=fp_bold, fontsize=13, color=INK)
    ax.set_ylim(23, 34.5)
    ax.xaxis.set_major_locator(mdates.MonthLocator(bymonth=(1, 4, 7, 10)))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
    ax.grid(axis="y", color="#DDE6E8", linewidth=1)
    ax.grid(axis="x", visible=False)
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    ax.spines["left"].set_color(LINE)
    ax.spines["bottom"].set_color(LINE)
    ax.tick_params(colors=MUTED, labelsize=11)
    for tick in ax.get_xticklabels() + ax.get_yticklabels():
        tick.set_fontproperties(fp)
    legend = ax.legend(loc="upper right", frameon=False, prop=fp_bold, fontsize=12)
    for text in legend.get_texts():
        text.set_color(INK)
    fig.text(
        0.08,
        0.025,
        "出典：総務省統計局「家計調査 長期時系列表」。公式の季節調整は、より高度なモデルを使い過去値も改訂される。",
        fontproperties=fp,
        fontsize=10.5,
        color=MUTED,
    )
    fig.tight_layout(rect=(0.055, 0.065, 0.985, 0.95))
    path = ASSETS / "statistics" / "seasonal-adjustment-example.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, facecolor=fig.get_facecolor())
    plt.close(fig)
    print(path)


def main() -> None:
    build_processing_models()
    build_email_delivery()
    build_shared_key_animation()
    build_public_key_animation()
    build_hybrid_encryption()
    build_digital_signature()
    build_sound_digitization()
    build_basic_flowcharts()
    build_full_adder()
    build_multi_bit_adder()
    build_time_series_chart()


if __name__ == "__main__":
    main()
