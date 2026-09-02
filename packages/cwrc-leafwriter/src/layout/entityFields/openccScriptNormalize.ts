/**
 * Lazy-loaded OpenCC converters for CJK script normalization in translation.
 * Installed via Chinese / Japanese asset onboarding — not loaded for other users.
 */

import { canonicalLanguageCode } from '../../utilities/languageCodes';

const STORAGE_KEY = 'ljb.assets.openccScript.v1';

type ConverterFn = (text: string) => string;

let t2sConverter: ConverterFn | null = null;
let t2jpConverter: ConverterFn | null = null;
let warmPromise: Promise<void> | null = null;

export const isScriptNormalizationInstalled = (): boolean => {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  return window.localStorage.getItem(STORAGE_KEY) === 'installed';
};

export const markScriptNormalizationInstalled = (): void => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(STORAGE_KEY, 'installed');
  }
};

/** Dynamic-import OpenCC and cache t2s + t2jp converters (shared East Asian script pack). */
export const warmOpenccConverters = async (): Promise<void> => {
  if (t2sConverter && t2jpConverter) return;
  if (warmPromise) return warmPromise;

  warmPromise = (async () => {
    const module = await import('opencc-js');
    const OpenCC = module.default;
    t2sConverter = OpenCC.Converter({ from: 't', to: 'cn' });
    t2jpConverter = OpenCC.Converter({ from: 't', to: 'jp' });
  })();

  try {
    await warmPromise;
  } catch (error) {
    warmPromise = null;
    throw error;
  }
};

/** Download / enable the OpenCC script pack (lazy chunk + in-memory converters). */
export const installScriptNormalization = async (): Promise<boolean> => {
  try {
    await warmOpenccConverters();
    markScriptNormalizationInstalled();
    return true;
  } catch (error) {
    console.warn('[scriptNormalize] OpenCC install failed', error);
    return false;
  }
};

export const normalizeSurfaceWithOpencc = (
  surface: string,
  targetLang: string | null | undefined,
): string => {
  if (!surface || !isScriptNormalizationInstalled()) return surface;

  const canonical = canonicalLanguageCode(targetLang ?? '');
  if (canonical === 'zh-Hans' && t2sConverter) return t2sConverter(surface);
  if (canonical.startsWith('ja') && t2jpConverter) return t2jpConverter(surface);
  return surface;
};

/** Test helper — reset cached converters and install flag. */
export const resetOpenccScriptStateForTest = (): void => {
  t2sConverter = null;
  t2jpConverter = null;
  warmPromise = null;
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
};

export const setOpenccConvertersForTest = (
  t2s: ConverterFn | null,
  t2jp: ConverterFn | null,
): void => {
  t2sConverter = t2s;
  t2jpConverter = t2jp;
  markScriptNormalizationInstalled();
};
