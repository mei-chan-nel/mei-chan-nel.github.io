(function () {
  "use strict";

  window.LECTURE_KEYWORDS = {
    society: [
      {
        title: "情報を扱う基礎",
        keywords: [
          { id: "society-data", label: "データ", sectionId: "society-data", targetText: "データ" },
          { id: "society-information", label: "情報", sectionId: "society-data", targetText: "情報" },
          { id: "society-knowledge", label: "知識", sectionId: "society-data", targetText: "知識" },
          { id: "society-reliability", label: "信頼性", sectionId: "society-data", targetText: "信頼性" },
          { id: "society-media", label: "メディア", sectionId: "society-media", targetText: "メディア" },
          { id: "society-problem-solving", label: "問題解決", sectionId: "society-problem-solving", targetText: "問題解決" }
        ]
      },
      {
        title: "個人情報とプライバシー",
        keywords: [
          { id: "society-personal-information", label: "個人情報", sectionId: "society-personal-data", targetText: "個人情報" },
          { id: "society-personal-identifier", label: "個人識別符号", sectionId: "society-personal-data", targetText: "個人識別符号" },
          { id: "society-sensitive-information", label: "要配慮個人情報", sectionId: "society-personal-data", targetText: "要配慮個人情報" },
          { id: "society-anonymously-processed", label: "匿名加工情報", sectionId: "society-personal-data", targetText: "匿名加工情報" },
          { id: "society-privacy", label: "プライバシー", sectionId: "society-privacy", targetText: "プライバシー" },
          { id: "society-portrait-right", label: "肖像権", sectionId: "society-privacy", targetText: "肖像権" }
        ]
      },
      {
        title: "知的財産と産業財産権",
        keywords: [
          { id: "society-intellectual-property", label: "知的財産権", sectionId: "society-industrial-property", targetText: "知的財産権" },
          { id: "society-industrial-property", label: "産業財産権", sectionId: "society-industrial-property", targetText: "産業財産権" },
          { id: "society-patent", label: "特許権", sectionId: "society-industrial-property", targetText: "特許権" },
          { id: "society-utility-model", label: "実用新案権", sectionId: "society-industrial-property", targetText: "実用新案権" },
          { id: "society-design-right", label: "意匠権", sectionId: "society-industrial-property", targetText: "意匠権" },
          { id: "society-trademark", label: "商標権", sectionId: "society-industrial-property", targetText: "商標権" }
        ]
      },
      {
        title: "著作物の保護と利用",
        keywords: [
          { id: "society-copyright", label: "著作権", sectionId: "society-copyright", targetText: "著作権" },
          { id: "society-moral-rights", label: "著作者人格権", sectionId: "society-copyright", targetText: "著作者人格権" },
          { id: "society-neighbouring-rights", label: "著作隣接権", sectionId: "society-neighbouring-rights", targetText: "著作隣接権" },
          { id: "society-quotation", label: "引用", sectionId: "society-copyright-exceptions", targetText: "引用" },
          { id: "society-cc-license", label: "CCライセンス", sectionId: "society-copyright-exceptions", targetText: "CCライセンス" },
          { id: "society-information-ethics", label: "情報モラル", sectionId: "society-judgement", targetText: "情報モラル" }
        ]
      }
    ],
    digital: [
      {
        title: "数とデータ量",
        keywords: [
          { id: "digital-analog", label: "アナログ", sectionId: "digital-analog", targetText: "アナログ" },
          { id: "digital-digital", label: "デジタル", sectionId: "digital-analog", targetText: "デジタル" },
          { id: "digital-binary", label: "2進数", sectionId: "digital-bases-bits", targetText: "2進数" },
          { id: "digital-hexadecimal", label: "16進数", sectionId: "digital-bases-bits", targetText: "16進数" },
          { id: "digital-bit", label: "ビット", sectionId: "digital-bases-bits", targetText: "ビット" },
          { id: "digital-byte", label: "バイト", sectionId: "digital-bases-bits", targetText: "バイト" }
        ]
      },
      {
        title: "数値と文字の表現",
        keywords: [
          { id: "digital-twos-complement", label: "2の補数", sectionId: "digital-signed-float-text", targetText: "2の補数" },
          { id: "digital-fixed-point", label: "固定小数点", sectionId: "digital-signed-float-text", targetText: "固定小数点" },
          { id: "digital-floating-point", label: "浮動小数点数", sectionId: "digital-signed-float-text", targetText: "浮動小数点数" },
          { id: "digital-character-code", label: "文字コード", sectionId: "digital-signed-float-text", targetText: "文字コード" },
          { id: "digital-unicode", label: "Unicode", sectionId: "digital-signed-float-text", targetText: "Unicode" },
          { id: "digital-encoding-scheme", label: "符号化方式", sectionId: "digital-signed-float-text", targetText: "符号化方式" }
        ]
      },
      {
        title: "論理回路",
        keywords: [
          { id: "digital-and", label: "AND", sectionId: "digital-logic", targetText: "AND" },
          { id: "digital-or", label: "OR", sectionId: "digital-logic", targetText: "OR" },
          { id: "digital-not", label: "NOT", sectionId: "digital-logic", targetText: "NOT" },
          { id: "digital-half-adder", label: "半加算器", sectionId: "digital-adders", targetText: "半加算器" },
          { id: "digital-full-adder", label: "全加算器", sectionId: "digital-adders", targetText: "全加算器" },
          { id: "digital-carry", label: "繰り上がり", sectionId: "digital-adders", targetText: "繰り上がり" }
        ]
      },
      {
        title: "音・画像のデジタル化",
        keywords: [
          { id: "digital-sampling", label: "標本化", sectionId: "digital-sound", targetText: "標本化" },
          { id: "digital-quantization", label: "量子化", sectionId: "digital-sound", targetText: "量子化" },
          { id: "digital-encoding", label: "符号化", sectionId: "digital-sound", targetText: "符号化" },
          { id: "digital-raster", label: "ラスタ形式", sectionId: "digital-image", targetText: "ラスタ形式" },
          { id: "digital-vector", label: "ベクタ形式", sectionId: "digital-image", targetText: "ベクタ形式" },
          { id: "digital-resolution", label: "解像度", sectionId: "digital-image", targetText: "解像度" }
        ]
      }
    ],
    network: [
      {
        title: "ネットワークの構成",
        keywords: [
          { id: "network-lan", label: "LAN", sectionId: "network-scope", targetText: "LAN" },
          { id: "network-wan", label: "WAN", sectionId: "network-scope", targetText: "WAN" },
          { id: "network-internet", label: "インターネット", sectionId: "network-scope", targetText: "インターネット" },
          { id: "network-client-server", label: "クライアントサーバ", sectionId: "network-processing", targetText: "クライアントサーバ" },
          { id: "network-p2p", label: "P2P", sectionId: "network-processing", targetText: "P2P" },
          { id: "network-protocol", label: "プロトコル", sectionId: "network-protocols", targetText: "プロトコル" }
        ]
      },
      {
        title: "TCP/IPとデータ転送",
        keywords: [
          { id: "network-application-layer", label: "アプリケーション層", sectionId: "network-protocols", targetText: "アプリケーション層" },
          { id: "network-transport-layer", label: "トランスポート層", sectionId: "network-protocols", targetText: "トランスポート層" },
          { id: "network-internet-layer", label: "インターネット層", sectionId: "network-protocols", targetText: "インターネット層" },
          { id: "network-tcp", label: "TCP", sectionId: "network-protocols", targetText: "TCP" },
          { id: "network-udp", label: "UDP", sectionId: "network-protocols", targetText: "UDP" },
          { id: "network-encapsulation", label: "カプセル化", sectionId: "network-encapsulation", targetText: "カプセル化" }
        ]
      },
      {
        title: "アドレスとサービス",
        keywords: [
          { id: "network-ip-address", label: "IPアドレス", sectionId: "network-addressing", targetText: "IPアドレス" },
          { id: "network-mac-address", label: "MACアドレス", sectionId: "network-addressing", targetText: "MACアドレス" },
          { id: "network-router", label: "ルータ", sectionId: "network-routing", targetText: "ルータ" },
          { id: "network-dns", label: "DNS", sectionId: "network-dns", targetText: "DNS" },
          { id: "network-http", label: "HTTP", sectionId: "network-web-mail", targetText: "HTTP" },
          { id: "network-smtp", label: "SMTP", sectionId: "network-web-mail", targetText: "SMTP" }
        ]
      },
      {
        title: "安全な通信",
        keywords: [
          { id: "network-confidentiality", label: "機密性", sectionId: "network-security", targetText: "機密性" },
          { id: "network-integrity", label: "完全性", sectionId: "network-security", targetText: "完全性" },
          { id: "network-availability", label: "可用性", sectionId: "network-security", targetText: "可用性" },
          { id: "network-shared-key", label: "共通鍵暗号方式", sectionId: "network-cryptography", targetText: "共通鍵暗号方式" },
          { id: "network-public-key", label: "公開鍵暗号方式", sectionId: "network-cryptography", targetText: "公開鍵暗号方式" },
          { id: "network-digital-signature", label: "デジタル署名", sectionId: "network-signature", targetText: "デジタル署名" }
        ]
      }
    ],
    statistics: [
      {
        title: "尺度と調査対象",
        keywords: [
          { id: "statistics-nominal-scale", label: "名義尺度", sectionId: "statistics-scales", targetText: "名義尺度" },
          { id: "statistics-ordinal-scale", label: "順序尺度", sectionId: "statistics-scales", targetText: "順序尺度" },
          { id: "statistics-interval-scale", label: "間隔尺度", sectionId: "statistics-scales", targetText: "間隔尺度" },
          { id: "statistics-ratio-scale", label: "比例尺度", sectionId: "statistics-scales", targetText: "比例尺度" },
          { id: "statistics-population", label: "母集団", sectionId: "statistics-data-collection", targetText: "母集団" },
          { id: "statistics-sample", label: "標本", sectionId: "statistics-data-collection", targetText: "標本" }
        ]
      },
      {
        title: "データ収集と表計算",
        keywords: [
          { id: "statistics-bias", label: "バイアス", sectionId: "statistics-investigation", targetText: "バイアス" },
          { id: "statistics-random-sampling", label: "無作為抽出", sectionId: "statistics-investigation", targetText: "無作為抽出" },
          { id: "statistics-outlier", label: "外れ値", sectionId: "statistics-investigation", targetText: "外れ値" },
          { id: "statistics-absolute-reference", label: "絶対参照", sectionId: "statistics-spreadsheet", targetText: "絶対参照" },
          { id: "statistics-relative-reference", label: "相対参照", sectionId: "statistics-spreadsheet", targetText: "相対参照" },
          { id: "statistics-function", label: "関数", sectionId: "statistics-spreadsheet", targetText: "関数" }
        ]
      },
      {
        title: "代表値と分布",
        keywords: [
          { id: "statistics-mean", label: "平均値", sectionId: "statistics-summary", targetText: "平均値" },
          { id: "statistics-median", label: "中央値", sectionId: "statistics-summary", targetText: "中央値" },
          { id: "statistics-mode", label: "最頻値", sectionId: "statistics-summary", targetText: "最頻値" },
          { id: "statistics-variance", label: "分散", sectionId: "statistics-summary", targetText: "分散" },
          { id: "statistics-standard-deviation", label: "標準偏差", sectionId: "statistics-summary", targetText: "標準偏差" },
          { id: "statistics-box-plot", label: "箱ひげ図", sectionId: "statistics-graphs", targetText: "箱ひげ図" }
        ]
      },
      {
        title: "関係・予測・分布",
        keywords: [
          { id: "statistics-correlation-coefficient", label: "相関係数", sectionId: "statistics-correlation", targetText: "相関係数" },
          { id: "statistics-causation", label: "因果関係", sectionId: "statistics-correlation", targetText: "因果関係" },
          { id: "statistics-confounding", label: "交絡", sectionId: "statistics-correlation", targetText: "交絡" },
          { id: "statistics-regression-line", label: "回帰直線", sectionId: "statistics-regression", targetText: "回帰直線" },
          { id: "statistics-residual", label: "残差", sectionId: "statistics-regression", targetText: "残差" },
          { id: "statistics-normal-distribution", label: "正規分布", sectionId: "statistics-normal", targetText: "正規分布" }
        ]
      }
    ],
    programming: [
      {
        title: "手順と値",
        keywords: [
          { id: "programming-algorithm", label: "アルゴリズム", sectionId: "programming-algorithm", targetText: "アルゴリズム" },
          { id: "programming-sequence", label: "順次", sectionId: "programming-algorithm", targetText: "順次" },
          { id: "programming-branching", label: "分岐", sectionId: "programming-algorithm", targetText: "分岐" },
          { id: "programming-repetition", label: "反復", sectionId: "programming-algorithm", targetText: "反復" },
          { id: "programming-variable", label: "変数", sectionId: "programming-values", targetText: "変数" },
          { id: "programming-type", label: "型", sectionId: "programming-values", targetText: "型" }
        ]
      },
      {
        title: "条件分岐と反復",
        keywords: [
          { id: "programming-if", label: "if", sectionId: "programming-branch", targetText: "if" },
          { id: "programming-elif", label: "elif", sectionId: "programming-branch", targetText: "elif" },
          { id: "programming-else", label: "else", sectionId: "programming-branch", targetText: "else" },
          { id: "programming-for", label: "for", sectionId: "programming-for", targetText: "for" },
          { id: "programming-while", label: "while", sectionId: "programming-while", targetText: "while" },
          { id: "programming-infinite-loop", label: "無限ループ", sectionId: "programming-while", targetText: "無限ループ" }
        ]
      },
      {
        title: "配列と関数",
        keywords: [
          { id: "programming-array", label: "配列", sectionId: "programming-data-structures", targetText: "配列" },
          { id: "programming-index", label: "添字", sectionId: "programming-data-structures", targetText: "添字" },
          { id: "programming-function", label: "関数", sectionId: "programming-functions", targetText: "関数" },
          { id: "programming-argument", label: "引数", sectionId: "programming-functions", targetText: "引数" },
          { id: "programming-return-value", label: "戻り値", sectionId: "programming-functions", targetText: "戻り値" },
          { id: "programming-return", label: "return文", sectionId: "programming-functions", targetText: "return" }
        ]
      },
      {
        title: "探索・整列・テスト",
        keywords: [
          { id: "programming-bubble-sort", label: "バブルソート", sectionId: "programming-sort-search", targetText: "バブルソート" },
          { id: "programming-linear-search", label: "線形探索", sectionId: "programming-sort-search", targetText: "線形探索" },
          { id: "programming-binary-search", label: "二分探索", sectionId: "programming-sort-search", targetText: "二分探索" },
          { id: "programming-normal-value", label: "正常値", sectionId: "programming-test", targetText: "正常値" },
          { id: "programming-boundary-value", label: "境界値", sectionId: "programming-test", targetText: "境界値" },
          { id: "programming-invalid-value", label: "異常値", sectionId: "programming-test", targetText: "異常値" }
        ]
      }
    ]
  };
})();
