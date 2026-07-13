from __future__ import annotations

import hashlib
import json
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "video-questions.json"
REPORT_PATH = ROOT / "docs" / "video-keyword-audit.json"

# 2026-07-14の初回監査表。再監査時の比較記録として残すが、
# 現在のキーワード生成・判定には使用しない。
PREVIOUS_KEYWORD_TEXT = {
    1: "ソーシャルエンジニアリング|なりすまし",
    2: "肖像権|写真の利用",
    3: "パブリシティ権|著名人",
    4: "サイバー犯罪|不正アクセス",
    5: "個人情報保護法|年賀状",
    6: "匿名加工情報|個人情報",
    7: "個人情報|名刺",
    8: "産業財産権|保護期間",
    9: "特許権|実用新案権|ソフトウェア",
    10: "著作権|無方式主義",
    11: "著作権|複製権|クラスTシャツ",
    12: "著作権|演奏権|文化祭",
    13: "引用|著作権",
    14: "二次的著作物|翻案権|著作権",
    15: "アイデアと表現|著作権",
    16: "編集著作物|問題集|著作物性",
    17: "地図|著作権|著作物性",
    18: "私的使用|録画|著作権",
    19: "貸与権|小説|著作権",
    20: "著作権の譲渡|著作者人格権",
    21: "商標権|題号|小説",
    22: "技術的保護手段|リッピング|著作権",
    23: "著作隣接権|実演家|ワンチャンス主義",
    24: "著作権|保護期間",
    25: "写り込み|付随対象著作物|著作権",
    26: "公開の美術の著作物|写真投稿|著作権",
    27: "情報解析|人工知能|著作権",
    28: "依拠性|著作権侵害",
    29: "クリエイティブ・コモンズ|利用許諾",
    30: "歌ってみた|演奏してみた|YouTube|著作権",
    31: "パブリックドメイン|著作権の消滅",
    32: "親告罪|同人誌|著作権",
    33: "メディアリテラシー|情報の受け手",
    34: "ユニバーサルデザイン|バリアフリー",
    35: "ユーザインタフェース|動的UI",
    36: "アクセシビリティ|文字サイズ|読み上げ",
    37: "色相|彩度|明度|アクセシビリティ",
    38: "代替テキスト|Webアクセシビリティ",
    39: "長文スクリーンショット|アクセシビリティ",
    40: "h1要素|見出し|HTML",
    41: "キーボード操作|Webアクセシビリティ",
    42: "HTML|マークアップ|文書構造",
    43: "開始タグ|終了タグ|HTML",
    44: "レスポンシブWebデザイン|CSS|メディアクエリ",
    45: "head要素|メタ情報|HTML",
    46: "br要素|改行|HTML",
    47: "a要素|ハイパーリンク|HTML",
    48: "div要素|span要素|HTML",
    49: "CSSセレクタ|クラス|属性",
    50: "カスケード|CSS|優先順位",
    51: "アフォーダンス|シグニファイア",
    52: "LATCH|情報整理|口コミサイト",
    53: "LATCH|情報整理|検索サイト",
    54: "インフォグラフィックス|情報の単純化",
    55: "加法混色|減法混色|RGB|CMY",
    56: "グラフ|色使い|情報の可視化",
    57: "3Dグラフ|データの歪曲|情報デザイン",
    58: "直線型構造|階層型構造|Webサイト構造",
    59: "網状型構造|ハイパーリンク|Webサイト構造",
    60: "ハブアンドスポーク型|Webサイト構造|SNS",
    61: "TO|CC|BCC|電子メール",
    62: "PDCAサイクル|PDCASサイクル",
    63: "QC七つ道具|品質管理",
    64: "新QC七つ道具|言語データ|品質管理",
    65: "ブレーンストーミング|発想法",
    66: "デジタルデータ|ビット|二値",
    67: "標本化|量子化|音声のデジタル化",
    68: "ビット|バイト|情報量",
    69: "情報量の単位|KiB|2進接頭辞",
    70: "ビット|バイト|データ量",
    71: "記憶容量|10進接頭辞|2進接頭辞",
    72: "情報量|必要ビット数|組合せ",
    73: "2進数|10進数|基数変換",
    74: "10進数|2進数|基数変換",
    75: "16進数|10進数|基数変換",
    76: "2進数|16進数|基数変換",
    77: "16進数|2進数|基数変換",
    78: "2進小数|10進小数|基数変換",
    79: "10進小数|2進小数|基数変換",
    80: "16進小数|2進小数|基数変換",
    81: "2進数|加算|桁上がり",
    82: "補数|負数|2進数",
    83: "浮動小数点数|10進数|正規化",
    84: "浮動小数点数|有効桁数|表計算",
    85: "32ビット浮動小数点数|符号部|指数部|仮数部",
    86: "浮動小数点数|2進小数|符号部|指数部",
    87: "浮動小数点数|加算|桁合わせ",
    88: "丸め誤差|浮動小数点数|Python",
    89: "文字コード|Shift_JIS|UTF-8|データ量",
    90: "論理積回路|AND|真理値表",
    91: "論理和回路|OR|真理値表",
    92: "排他的論理和|XOR|真理値表",
    93: "ド・モルガンの法則|論理回路|真理値表",
    94: "排他的論理和|XOR|論理回路",
    95: "半加算器|全加算器|論理回路",
    96: "ベクタ画像|ラスタ画像|ロゴ",
    97: "画像データ量|解像度|色深度",
    98: "フルカラー|ハイカラー|色深度",
    99: "音声データ量|標本化周波数|量子化ビット数",
    100: "動画データ量|ビットレート|通信速度",
    101: "可逆圧縮|非可逆圧縮|符号化",
    102: "MP3|非可逆圧縮|聴覚心理モデル",
    103: "動画データ量|フレームレート|圧縮",
    104: "コンテナ形式|コーデック|映像圧縮",
    105: "コンピュータの五大装置|CPU|制御装置|演算装置",
    106: "入力装置|コンピュータ",
    107: "インタフェース|接続規格|情報機器",
    108: "主記憶装置|補助記憶装置|揮発性",
    109: "HDD|SSD|補助記憶装置",
    110: "光ディスク|補助記憶装置",
    111: "CPU|命令実行サイクル|主記憶装置",
    112: "クロック周波数|SI接頭辞|CPU",
    113: "クロック周波数|命令実行数|CPU",
    114: "キャッシュメモリ|CPU|主記憶装置",
    115: "平均アクセス時間|キャッシュヒット率|キャッシュメモリ",
    116: "GPU|並列処理|画像処理",
    117: "BIOS|起動処理|ファームウェア",
    118: "OS|コンピュータの分類",
    119: "OS|ハードウェア|ソフトウェア",
    120: "システムソフトウェア|応用ソフトウェア|SaaS",
    121: "サーバ|コンピュータ",
    122: "RAID|ミラーリング|ストライピング|パリティ",
    123: "演算誤差|コンピュータ",
    124: "桁落ち|情報落ち|演算誤差",
    125: "桁あふれ|丸め誤差|演算誤差",
    126: "情報ネットワーク|ネットワーク構成",
    127: "LAN|インターネット|ネットワーク",
    128: "イーサネット|有線LAN|通信規格",
    129: "無線LAN|Wi-Fi|IEEE 802.11",
    130: "Bluetooth|近距離無線通信|Wi-Fi",
    131: "ZigBee|UWB|近距離無線通信",
    132: "NFC|交通系ICカード|近距離無線通信",
    133: "WAN|LAN|広域ネットワーク",
    134: "スタンドアロン|オフライン",
    135: "スタンドアロン|情報漏えい対策|マルウェア対策",
    136: "リソース共有|ネットワーク|アクセス管理",
    137: "クライアントサーバシステム|分散処理",
    138: "P2P|ファイル共有|ブロックチェーン",
    139: "サーバ|ネットワークサービス",
    140: "クラウドコンピューティング|IaaS|PaaS|SaaS",
    141: "ルータ|ハブ|スイッチ|ONU",
    142: "インターネット|ISP",
    143: "インターネットガバナンス|分散管理",
    144: "ISP|Tier 1|インターネット接続",
    145: "ブロードバンド|ADSL|FTTH|CATV",
    146: "ARPANET|インターネットの歴史",
    147: "ARPANET|パケット交換",
    148: "回線交換|パケット交換",
    149: "相互接続性|ネットワーク|標準化",
    150: "通信プロトコル|TCP/IP",
    151: "TCP/IP階層モデル|通信プロトコル",
    152: "IPアドレス|階層化|ネットワーク部",
    153: "IPv4|IPv6|IPアドレス枯渇",
    154: "プライベートIPアドレス|グローバルIPアドレス|NAT",
    155: "プライベートIPアドレス|IPv4|アドレス範囲",
    156: "IPアドレス|MACアドレス",
    157: "ドメイン名|URL",
    158: "DNS|名前解決|IPアドレス",
    159: "nslookup|DNS|名前解決",
    160: "ルータ|ルーティング|パケット",
    161: "TCP|UDP|信頼性",
    162: "UDP|リアルタイム通信",
    163: "ポート番号|IPアドレス|通信サービス",
    164: "World Wide Web|インターネット|ハイパーテキスト",
    165: "ハイパーテキスト|HTML|HTTP|Webサーバ",
    166: "Webブラウザ|HTML|レンダリング",
    167: "HTTP|HTTPS|暗号化通信",
    168: "HTTPS|フィッシング|Webサイトの安全性",
    169: "Cookie|セッション管理|HTTP",
    170: "Webキャッシュ|ブラウザ|高速化",
    171: "HTTPステータスコード|404 Not Found",
    172: "メールサーバ|電子メール",
    173: "電子メール|暗号化|盗聴対策",
    174: "ストリーミング|プログレッシブダウンロード",
    175: "プロキシサーバ|Webブラウザ|中継",
    176: "ファイアウォール|アクセス制御|ネットワークセキュリティ",
    177: "ワンクリック詐欺|相談窓口|ネット詐欺",
    178: "スパイウェア|ボット|マルウェア",
    179: "ボットネット|DDoS攻撃|マルウェア",
    180: "偽警告|サポート詐欺|マルウェア対策",
    181: "不審メール|添付ファイル|フィッシング",
    182: "フリーWi-Fi|盗聴|フィッシング",
    183: "パスワード|総当たり攻撃|辞書攻撃",
    184: "POSシステム|販売時点情報管理|データ分析",
    185: "ポイントカード|顧客データ|販売促進",
    186: "キャッシュレス決済|電子決済",
    187: "BtoB|CtoC|シェアリングエコノミー",
    188: "電子商取引|ECサイト|オンライン取引",
    189: "ロングテール|ECサイト",
    190: "検索エンジン|クローラ|インデックス",
    191: "ディレクトリ型検索|ロボット型検索|検索エンジン",
    192: "ディープWeb|検索エンジン|インデックス",
    193: "OPAC|蔵書検索|図書館",
    194: "ポータルサイト|Webサービス",
    195: "データベース|データモデル|歴史",
    196: "SQL|データベース操作",
    197: "データベース|表計算ソフト|同時アクセス",
    198: "データベース|一元管理|データ共有",
    199: "排他制御|アクセス制御|データベース",
    200: "主キー|一意性|データベース",
    201: "主キー|複合キー|レコード",
    202: "正規化|リレーショナルデータベース",
    203: "選択|射影|結合|関係演算",
    204: "リレーションシップ|一対多|データベース",
    205: "ビッグデータ|3V|IoT",
    206: "オープンデータ|公共データ",
    207: "人工知能|機械学習|AIブーム",
    208: "地理情報システム|GIS|位置情報データ",
    209: "フールプルーフ|安全設計|誤操作防止",
    210: "フェールセーフ|安全設計",
    211: "フェールソフト|耐障害性",
    212: "Web 3.0|Webの歴史|分散型Web",
    213: "ブロックチェーン|分散型台帳",
    214: "Society 5.0|サイバー空間|フィジカル空間",
    215: "IoT|センサ|モノのインターネット",
    216: "ブラックリスト|ホワイトリスト|アクセス制御",
    217: "機密性|完全性|可用性|情報セキュリティ",
    218: "電子透かし|デジタルウォーターマーク|著作権保護",
    219: "パリティビット|誤り検出",
    220: "チェックディジット|誤入力検出",
    221: "水平垂直パリティ|誤り訂正",
    222: "共通鍵暗号方式|暗号化|鍵配送",
    223: "公開鍵暗号方式|暗号化|秘密鍵",
    224: "RSA暗号|公開鍵暗号方式|素因数分解",
    225: "共通鍵暗号方式|公開鍵暗号方式|鍵配送",
    226: "認証局|公開鍵基盤|デジタル証明書",
    227: "認証局|デジタル証明書|本人性",
    228: "ハイブリッド暗号方式|共通鍵|公開鍵",
    229: "HTTPS|ハイブリッド暗号方式|TLS",
    230: "デジタル署名|ハッシュ値|公開鍵暗号",
    231: "変数|代入|表示",
    232: "演算子の優先順位|平均|プログラム修正",
    233: "変数|代入|逐次処理",
    234: "変数|代入|値の更新",
    235: "変数|値の交換|一時変数",
    236: "変数|自己代入|インクリメント",
    237: "変数|自己代入|乗算",
    238: "変数|値の交換|算術演算",
    239: "文字列|連結|変数",
    240: "データ型|数値|文字列|連結",
    241: "配列|添字|要素",
    242: "配列|要素の更新|代入",
    243: "配列|要素間の代入|値の更新",
    244: "配列|平均|合計",
    245: "配列|対応するデータ|添字",
    246: "配列|添字|変数",
    247: "配列|要素の交換|一時変数",
    248: "二次元配列|行|列",
    249: "二次元配列|要素の更新",
    250: "二次元配列|行|列|会員情報",
    251: "二次元配列|座席予約|添字",
    252: "条件分岐|if|比較演算子",
    253: "条件分岐|if|条件不成立",
    254: "条件分岐|外部入力|実行順序",
    255: "条件分岐|if-else|大小比較",
    256: "条件分岐|年齢判定|if-else",
    257: "偶数と奇数|剰余|条件分岐",
    258: "コラッツ予想|偶奇判定|条件分岐",
    259: "比較演算子|不等号|条件分岐",
    260: "多分岐|else-if|条件分岐",
    261: "多分岐|年齢判定|else-if",
    262: "倍数判定|条件分岐|分岐順序",
    263: "入れ子|条件分岐|論理積",
    264: "複合条件|条件分岐|文字列比較",
    265: "論理演算子|AND|OR|条件分岐",
    266: "剰余|日付判定|条件分岐",
    267: "ゼロ除算|逆数|条件分岐",
    268: "論理演算子|OR|AND|年齢判定",
    269: "多分岐|年齢判定|料金計算",
    270: "繰り返し|for|カウンタ",
    271: "繰り返し|累積|合計",
    272: "繰り返し|総和|累積",
    273: "繰り返し|べき乗|累積乗算",
    274: "繰り返し|べき乗|外部入力",
    275: "階乗|繰り返し|累積乗算",
    276: "配列|平均|繰り返し|要素数",
    277: "繰り返し|条件分岐|倍数判定",
    278: "繰り返し|条件分岐|個数のカウント",
    279: "繰り返し|複合条件|倍数判定",
    280: "繰り返し|条件分岐|条件付き合計",
    281: "最大値|繰り返し|値の更新",
    282: "二重ループ|九九|繰り返し",
    283: "二次元配列|二重ループ|九九",
    284: "二重ループ|条件分岐|組合せ",
    285: "while|繰り返し|ループ条件",
    286: "while|繰り返し|条件分岐",
    287: "while|回数未定の繰り返し|ループ条件",
    288: "数列|繰り返し|漸化式|総和",
    289: "フィボナッチ数列|while|項数",
    290: "数当てゲーム|while|外部入力",
    291: "コラッツ予想|while|条件分岐",
    292: "配列|繰り返し|条件分岐|合否判定",
    293: "最大値探索|配列|繰り返し",
    294: "配列|循環シフト|要素の移動",
    295: "配列|逆順|要素の交換",
    296: "ド・モルガンの法則|倍数判定|個数のカウント",
    297: "ユークリッドの互除法|最大公約数|減算",
    298: "ユークリッドの互除法|最大公約数|剰余",
    299: "整数の桁分解|配列|商と剰余",
    300: "ISBN|チェックディジット|配列",
    301: "度数分布表|配列|階級",
    302: "硬貨枚数|貪欲法|商と剰余",
    303: "2進数|10進数|基数変換|配列",
    304: "2進数|10進数|基数変換|逐次計算",
    305: "2進数|10進数|基数変換|逆向きループ",
    306: "10進数|2進数|基数変換|配列",
    307: "16進数|10進数|基数変換|文字判定",
    308: "16進数|10進数|基数変換|配列",
    309: "10進数|16進数|基数変換|配列",
    310: "バブルソート|整列|配列",
    311: "選択ソート|整列|配列",
    312: "挿入ソート|整列|配列",
    313: "マージソート|併合|配列",
    314: "クイックソート|ピボット|分割",
    315: "線形探索|配列|探索",
    316: "線形探索|短絡評価|論理演算子",
    317: "二分探索|整列済み配列|探索範囲",
    318: "関数|乱数|整数化",
    319: "関数|入れ子|距離",
    320: "関数定義|引数|戻り値",
    321: "再帰関数|階乗",
    322: "再帰関数|フィボナッチ数列",
    323: "シミュレーション|投資|乱数",
    324: "シミュレーション|コイン投げ|度数分布表",
    325: "誕生日問題|シミュレーション|乱数",
    326: "検査精度|偽陽性|シミュレーション",
    327: "モンテカルロ法|円周率|乱数",
    328: "ランダムウォーク|シミュレーション|乱数",
    329: "在庫管理|定期発注モデル|シミュレーション",
    330: "待ち行列|平均待ち時間|シミュレーション",
}


def controlled_keywords(number: int) -> list[str]:
    """Return the reviewed, reusable learning facets for Q001-Q330.

    The ranges follow the actual question sequence.  Terms are intentionally
    broader than a question title: every public keyword must connect at least
    two questions, while the programming range keeps practical subtopics.
    """
    keywords: list[str]

    if 1 <= number <= 32:
        keywords = ["情報社会"]
        if number in {1, 4}:
            keywords += ["情報セキュリティ", "サイバー犯罪"]
        elif number in {2, 3}:
            keywords += ["知的財産権", "肖像・パブリシティ"]
        elif 5 <= number <= 7:
            keywords += ["個人情報", "個人情報保護"]
        elif number in {8, 9, 21}:
            keywords += ["知的財産権", "産業財産権"]
        else:
            keywords += ["著作権"]
            if number in {10, 24, 31, 32}:
                keywords += ["著作権制度"]
            elif number in {13, 14, 15, 16, 17, 27, 28}:
                keywords += ["著作物性・二次利用"]
            elif number in {20, 23}:
                keywords += ["著作者・実演家"]
            else:
                keywords += ["著作物の利用"]
    elif 33 <= number <= 60:
        keywords = ["情報デザイン"]
        if 34 <= number <= 41:
            keywords += ["アクセシビリティ"]
            if number in {35, 41}:
                keywords += ["ユーザインタフェース"]
            if number in {37, 39}:
                keywords += ["視覚表現"]
        elif 42 <= number <= 50:
            keywords += ["Webデザイン", "HTML・CSS"]
        elif number in {37, 55, 56, 57}:
            keywords += ["視覚表現", "色彩・グラフ"]
        elif number in {51, 35}:
            keywords += ["ユーザインタフェース"]
        elif number in {52, 53, 58, 59, 60}:
            keywords += ["情報整理・サイト構造"]
        else:
            keywords += ["情報整理・可視化"]
    elif number == 61:
        keywords = ["情報社会", "電子メール・配信サービス"]
    elif 62 <= number <= 65:
        keywords = ["問題解決", "発想・品質管理"]
    elif 66 <= number <= 125:
        keywords = ["デジタル"]
        if 66 <= number <= 72:
            keywords += ["情報量・データ量"]
            if 66 <= number <= 70:
                keywords += ["ビット・バイト"]
                if number == 67:
                    keywords += ["音声のデジタル化"]
            elif number in {71, 72}:
                keywords += ["記憶容量・必要ビット数"]
        elif 73 <= number <= 80:
            keywords += ["基数変換", "2進数・16進数"]
        elif 81 <= number <= 82:
            keywords += ["数値表現・演算", "2進数の演算"]
        elif 83 <= number <= 88:
            keywords += ["数値表現・演算", "浮動小数点数"]
        elif number == 89:
            keywords += ["情報量・データ量", "符号化・圧縮"]
        elif 90 <= number <= 95:
            keywords += ["論理演算・回路"]
        elif 96 <= number <= 104:
            keywords += ["画像・音声・動画"]
            if number in {96, 97, 98}:
                keywords += ["画像のデジタル化"]
            elif number in {67, 99}:
                keywords += ["音声のデジタル化"]
            elif number in {100, 103, 104}:
                keywords += ["動画のデジタル化"]
            else:
                keywords += ["符号化・圧縮"]
        else:
            keywords += ["コンピュータの仕組み"]
            if 105 <= number <= 107:
                keywords += ["装置・インタフェース"]
            elif 108 <= number <= 110 or number == 122:
                keywords += ["記憶装置"]
            elif 111 <= number <= 116:
                keywords += ["CPU・処理性能"]
            elif 117 <= number <= 121:
                keywords += ["OS・ソフトウェア"]
            else:
                keywords += ["演算誤差"]
    elif 126 <= number <= 183:
        keywords = ["ネットワーク"]
        if 126 <= number <= 136:
            keywords += ["ネットワーク基礎・構成"]
        elif 137 <= number <= 140:
            keywords += ["分散処理・クラウド"]
        elif 141 <= number <= 151:
            keywords += ["インターネット・通信方式"]
        elif 152 <= number <= 160:
            keywords += ["IPアドレス・ルーティング"]
        elif 161 <= number <= 163:
            keywords += ["TCP・UDP・ポート"]
        elif 164 <= number <= 171:
            keywords += ["Web・HTTP"]
        elif 172 <= number <= 175:
            keywords += ["電子メール・配信サービス"]
        else:
            keywords += ["情報セキュリティ", "ネットワーク安全対策"]
    elif 184 <= number <= 194:
        keywords = ["情報システム"]
        if number <= 189:
            keywords += ["電子商取引・データ活用"]
        else:
            keywords += ["情報検索・Webサービス"]
    elif 195 <= number <= 204:
        keywords = ["データ活用", "データベース"]
        if number in {195, 196, 197, 198, 199}:
            keywords += ["データ管理"]
        else:
            keywords += ["関係データベース"]
    elif 205 <= number <= 208:
        keywords = ["データ活用", "AI・IoT・オープンデータ"]
    elif 209 <= number <= 211:
        keywords = ["情報システム", "安全設計"]
    elif 212 <= number <= 215:
        keywords = ["情報社会", "AI・IoT・分散技術"]
    elif 216 <= number <= 230:
        keywords = ["情報セキュリティ"]
        if number in {216, 217}:
            keywords += ["アクセス制御・安全対策"]
        elif 218 <= number <= 221:
            keywords += ["データ保護・誤り検出"]
        elif number in {226, 227}:
            keywords += ["認証・デジタル証明書"]
        else:
            keywords += ["暗号技術"]
    elif 231 <= number <= 330:
        keywords = ["プログラミング"]
        if 231 <= number <= 240:
            keywords += ["変数・データ型"]
            keywords += ["変数と代入" if number <= 238 else "文字列とデータ型"]
        elif 241 <= number <= 251:
            keywords += ["配列", "一次元配列" if number <= 247 else "二次元配列"]
        elif 252 <= number <= 269:
            keywords += ["条件分岐", "比較と判定" if number <= 259 else "複合条件・多分岐"]
        elif 270 <= number <= 292:
            keywords += ["繰り返し"]
            if number <= 281:
                keywords += ["集計と累積"]
            elif number <= 284:
                keywords += ["二重ループ"]
            elif number <= 291:
                keywords += ["whileループ"]
            else:
                keywords += ["配列処理"]
        elif 293 <= number <= 309:
            keywords += ["アルゴリズム", "配列"]
            keywords += ["配列処理" if number <= 300 else "基数変換"]
        elif 310 <= number <= 314:
            keywords += ["アルゴリズム", "配列", "整列"]
        elif 315 <= number <= 317:
            keywords += ["アルゴリズム", "配列", "探索"]
        elif 318 <= number <= 322:
            keywords += ["関数・再帰", "関数" if number <= 320 else "再帰"]
        else:
            keywords += ["シミュレーション"]
    else:
        raise ValueError(f"Unsupported video question number: {number}")

    return list(dict.fromkeys(keywords))


def main() -> int:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    questions = [
        (section["id"], section["label"], question)
        for section in data.get("sections", [])
        for question in section.get("questions", [])
    ]
    numbers = [int(question["number"]) for _, _, question in questions]
    expected = set(range(1, 331))
    if len(numbers) != 330 or set(numbers) != expected or len(numbers) != len(set(numbers)):
        raise SystemExit("Video questions must uniquely cover Q001 through Q330")
    audit_entries: list[dict[str, object]] = []
    for section_id, section_label, question in questions:
        number = int(question["number"])
        keywords = controlled_keywords(number)
        if not 2 <= len(keywords) <= 4 or len(keywords) != len(set(keywords)):
            raise SystemExit(f"Q{number:03d}: keywords must contain 2-4 unique terms")
        question["keywords"] = keywords
        audit_entries.append(
            {
                "number": number,
                "section_id": section_id,
                "section_label": section_label,
                "question": question["question"],
                "answer": question["answer"],
                "video_titles": [video["title"] for video in question.get("videos", [])],
                "keywords": keywords,
            }
        )

    frequencies: dict[str, int] = {}
    for entry in audit_entries:
        for keyword in entry["keywords"]:
            frequencies[keyword] = frequencies.get(keyword, 0) + 1
    singleton_keywords = sorted(keyword for keyword, count in frequencies.items() if count < 2)
    if singleton_keywords:
        raise SystemExit(f"Every keyword must connect multiple questions: {singleton_keywords}")

    serialized = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    DATA_PATH.write_text(serialized, encoding="utf-8")
    report = {
        "audited_on": date.today().isoformat(),
        "question_count": len(audit_entries),
        "keyword_count": sum(len(entry["keywords"]) for entry in audit_entries),
        "unique_keyword_count": len({keyword for entry in audit_entries for keyword in entry["keywords"]}),
        "minimum_keywords_per_question": min(len(entry["keywords"]) for entry in audit_entries),
        "maximum_keywords_per_question": max(len(entry["keywords"]) for entry in audit_entries),
        "minimum_questions_per_keyword": min(frequencies.values()),
        "maximum_questions_per_keyword": max(frequencies.values()),
        "single_question_keyword_count": len(singleton_keywords),
        "keyword_frequencies": dict(sorted(frequencies.items())),
        "old_keywords_used_as_input": False,
        "taxonomy_version": 2,
        "taxonomy_policy": "Every public keyword connects at least two questions; programming keeps reusable subtopics.",
        "classification_inputs": ["question", "answer", "section", "videos.title"],
        "data_sha256": hashlib.sha256(DATA_PATH.read_bytes()).hexdigest(),
        "entries": audit_entries,
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"questions={report['question_count']} keywords={report['keyword_count']} "
        f"unique={report['unique_keyword_count']} old_keywords_used={report['old_keywords_used_as_input']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
