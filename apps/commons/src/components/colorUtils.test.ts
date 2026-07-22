import { hexToHsl, hexToRgb, hslToHex, hueGradientCss, lightnessGradientCss } from './colorUtils';

describe('colorUtils', () => {
  test('round-trips hex through hsl', () => {
    expect(hslToHex(...hexToHsl('#1a5276'))).toBe('#1a5276');
  });

  test('builds hue and lightness gradients', () => {
    expect(hueGradientCss(50)).toContain('linear-gradient');
    expect(lightnessGradientCss(210, 80)).toContain('linear-gradient');
  });

  test('parses hex to rgb', () => {
    expect(hexToRgb('#ff8040')).toEqual([255, 128, 64]);
  });
});
