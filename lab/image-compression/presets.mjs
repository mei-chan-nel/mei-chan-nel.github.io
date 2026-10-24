export const presets = [
  [
    "photo",
    "写真",
    "細かな質感と、なだらかな色の変化。JPEGとAVIFのサイズを比べよう。",
  ],
  [
    "illustration",
    "イラスト",
    "少ない色とくっきりした輪郭。PNGとGIFでも小さくできる？",
  ],
  ["text", "文字画像", "品質を下げて拡大。文字の周りに現れるにじみを探そう。"],
  [
    "pixel",
    "ドット絵",
    "GIFの色数を減らすと？「画素が完全一致」する境界を見つけよう。",
  ],
  [
    "gradient",
    "グラデーション",
    "GIFの色数を変えて、滑らかさとファイルサイズの関係を観察しよう。",
  ],
  [
    "alpha",
    "透過画像",
    "透過と半透明を含む画像。JPEG・GIFではどう変わる？ α誤差も確認しよう。",
  ],
];
export async function makePreset(id, size) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.scale(size / 512, size / 512);
  if (id === "photo") {
    const image = new Image();
    image.src = new URL("./presets/astronaut.png", import.meta.url).href;
    await image.decode();
    ctx.drawImage(image, 0, 0, 512, 512);
  } else if (id === "gradient") {
    const g = ctx.createLinearGradient(0, 0, 512, 512);
    g.addColorStop(0, "#102f35");
    g.addColorStop(0.35, "#4a82b8");
    g.addColorStop(0.7, "#d8b0dd");
    g.addColorStop(1, "#ffe2a3");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    const radial = ctx.createRadialGradient(180, 160, 0, 180, 160, 240);
    radial.addColorStop(0, "#ffffffa0");
    radial.addColorStop(1, "#ffffff00");
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, 512, 512);
  } else if (id === "pixel") {
    ctx.fillStyle = "#e8eedb";
    ctx.fillRect(0, 0, 512, 512);
    const pattern = [
      "...........3333...........",
      ".........33333333.........",
      "........3333333333........",
      "........3443443443........",
      "........3443443443........",
      "........3333333333........",
      ".........35555333.........",
      "..........333333..........",
      ".......222222222222.......",
      "......22222222222222......",
      ".....2222666666222222.....",
      ".....2222666666222222.....",
      "......22222222222222......",
      "........2222222222........",
      "........2222222222........",
      ".........11..11...........",
      ".........11..11...........",
      "........111..111..........",
    ];
    const colors = [
      "#e8eedb",
      "#102f35",
      "#48a38d",
      "#e7a93d",
      "#fffef9",
      "#e96f51",
      "#267765",
    ];
    pattern.forEach((line, y) =>
      [...line].forEach((c, x) => {
        if (c !== ".") {
          ctx.fillStyle = colors[+c];
          ctx.fillRect(x * 18 + 22, y * 18 + 88, 18, 18);
        }
      }),
    );
  } else if (id === "alpha") {
    for (const [x, y, color] of [
      [200, 202, "#e96f51"],
      [310, 202, "#4a82b8"],
      [255, 298, "#48a38d"],
    ]) {
      const g = ctx.createRadialGradient(x, y, 15, x, y, 140);
      g.addColorStop(0, color);
      g.addColorStop(0.55, color + "b0");
      g.addColorStop(1, color + "00");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 140, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#102f35";
    ctx.fillRect(72, 420, 368, 3);
    ctx.font = "bold 28px sans-serif";
    ctx.fillText("TRANSPARENCY", 112, 470);
  } else if (id === "text") {
    ctx.fillStyle = "#fffef9";
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = "#102f35";
    ctx.font = "bold 48px sans-serif";
    ctx.fillText("Study Atlas", 42, 98);
    ctx.font = "bold 34px sans-serif";
    ctx.fillText("画像を小さくする", 42, 165);
    ctx.font = "22px sans-serif";
    [
      "くっきりした文字と、細い線。",
      "データ量と画質を比べよう。",
      "0123456789  ABCDEFG",
      "BMP PNG GIF JPEG",
      "WebP AVIF",
    ].forEach((t, i) => ctx.fillText(t, 42, 230 + i * 38));
    ["#e96f51", "#4a82b8", "#48a38d"].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(42 + i * 145, 438, 125, 8);
    });
    ctx.strokeStyle = "#102f35";
    for (let i = 0; i < 5; i++) {
      ctx.lineWidth = (i + 1) / 2;
      ctx.beginPath();
      ctx.moveTo(42, 465 + i * 8);
      ctx.lineTo(468, 465 + i * 8);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "#f2eddf";
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = "#e7a93d";
    ctx.beginPath();
    ctx.arc(385, 119, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4a82b8";
    ctx.beginPath();
    ctx.moveTo(0, 400);
    ctx.lineTo(190, 130);
    ctx.lineTo(410, 420);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#267765";
    ctx.beginPath();
    ctx.moveTo(170, 430);
    ctx.lineTo(370, 215);
    ctx.lineTo(512, 430);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#48a38d";
    ctx.fillRect(0, 410, 512, 102);
    ctx.fillStyle = "#fffef9";
    ctx.beginPath();
    ctx.moveTo(146, 192);
    ctx.lineTo(190, 130);
    ctx.lineTo(236, 191);
    ctx.lineTo(210, 181);
    ctx.lineTo(188, 198);
    ctx.lineTo(171, 183);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#102f35";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(58, 462);
    ctx.bezierCurveTo(160, 405, 300, 493, 446, 443);
    ctx.stroke();
  }
  return ctx.getImageData(0, 0, size, size);
}
