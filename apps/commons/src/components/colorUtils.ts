const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const hexToRgb = (hex: string): [number, number, number] | null => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1]!, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

export const rgbToHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b]
    .map((channel) =>
      clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0'),
    )
    .join('')}`;

export const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const lightness = (max + min) / 2;
  if (max === min) return [0, 0, lightness * 100];

  const delta = max - min;
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue = 0;
  if (max === rn) hue = (gn - bn) / delta + (gn < bn ? 6 : 0);
  else if (max === gn) hue = (bn - rn) / delta + 2;
  else hue = (rn - gn) / delta + 4;
  hue /= 6;

  return [hue * 360, saturation * 100, lightness * 100];
};

export const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s, 0, 100) / 100;
  const lightness = clamp(l, 0, 100) / 100;

  if (saturation === 0) {
    const gray = lightness * 255;
    return [gray, gray, gray];
  }

  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const convert = (t: number) => {
    let tone = t;
    if (tone < 0) tone += 1;
    if (tone > 1) tone -= 1;
    if (tone < 1 / 6) return p + (q - p) * 6 * tone;
    if (tone < 1 / 2) return q;
    if (tone < 2 / 3) return p + (q - p) * (2 / 3 - tone) * 6;
    return p;
  };

  return [
    convert(hue / 360 + 1 / 3) * 255,
    convert(hue / 360) * 255,
    convert(hue / 360 - 1 / 3) * 255,
  ];
};

export const hexToHsl = (hex: string): [number, number, number] => {
  const rgb = hexToRgb(hex);
  if (!rgb) return [0, 0, 100];
  return rgbToHsl(...rgb);
};

export const hslToHex = (h: number, s: number, l: number): string => {
  const [r, g, b] = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
};

export const hueGradientCss = (lightness: number): string => {
  const stops = [0, 60, 120, 180, 240, 300, 360].map(
    (hue) => `${hslToHex(hue, 100, lightness)} ${(hue / 360) * 100}%`,
  );
  return `linear-gradient(to right, ${stops.join(', ')})`;
};

export const lightnessGradientCss = (hue: number, saturation: number): string =>
  `linear-gradient(to right, ${hslToHex(hue, saturation, 0)}, ${hslToHex(hue, saturation, 50)}, ${hslToHex(hue, saturation, 100)})`;
