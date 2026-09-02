/**
 * @jest-environment jsdom
 */
import {
  installScriptNormalization,
  isScriptNormalizationInstalled,
  normalizeSurfaceWithOpencc,
  resetOpenccScriptStateForTest,
  setOpenccConvertersForTest,
} from './openccScriptNormalize';

describe('openccScriptNormalize', () => {
  beforeEach(() => resetOpenccScriptStateForTest());

  test('passes through when pack is not installed', () => {
    expect(normalizeSurfaceWithOpencc('濟陽', 'zh-Hans')).toBe('濟陽');
  });

  test('uses cached converters when installed', () => {
    setOpenccConvertersForTest(
      (text) => text.replace(/濟/g, '济').replace(/陽/g, '阳'),
      (text) => text.replace(/濟/g, '済'),
    );
    expect(isScriptNormalizationInstalled()).toBe(true);
    expect(normalizeSurfaceWithOpencc('濟陽', 'zh-Hans')).toBe('济阳');
    expect(normalizeSurfaceWithOpencc('濟陽', 'ja')).toBe('済陽');
  });
});

describe('installScriptNormalization', () => {
  beforeEach(() => resetOpenccScriptStateForTest());

  test('loads OpenCC and marks installed', async () => {
    const ok = await installScriptNormalization();
    expect(ok).toBe(true);
    expect(isScriptNormalizationInstalled()).toBe(true);
    expect(normalizeSurfaceWithOpencc('國', 'zh-Hans')).toBe('国');
    expect(normalizeSurfaceWithOpencc('國', 'ja')).toBe('国');
  });
});
