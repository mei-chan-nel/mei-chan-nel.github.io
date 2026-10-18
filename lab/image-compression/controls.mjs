// Codec quality values stay unchanged. Only the slider's physical direction
// is reversed: moving right requests stronger compression, or more effort.
export function sliderPosition(key, value, min, max) {
  return key === "quality" || key === "speed" ? min + max - value : value;
}
export const sliderSetting = sliderPosition;

export function compressionMode(format, settings) {
  if (format === "bmp")
    return {
      kind: "uncompressed",
      label: "非圧縮",
      description: settings.alpha
        ? "圧縮せずに保存。色と透明度を保持します。"
        : "圧縮せずに保存。透過は白背景に合成します。",
    };
  if (format === "gif")
    return {
      kind: "lossy",
      label: "非可逆（減色）",
      description:
        "減色・半透明の変換で情報が失われる場合があります。LZW圧縮自体は可逆です。",
    };
  const lossless = format === "png" || settings.lossless;
  return lossless
    ? {
        kind: "lossless",
        label: "可逆圧縮",
        description: "保存したデータから、元のRGBA画素を完全に復元できます。",
      }
    : {
        kind: "lossy",
        label: "非可逆圧縮",
        description:
          "情報を減らして小さくします。元の画素を完全には復元できません。",
      };
}
