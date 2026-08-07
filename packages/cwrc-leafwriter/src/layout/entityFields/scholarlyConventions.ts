/**
 * Scholarly display conventions (global profile prefs, not per-language).
 * How Sanmiao Western conversion appears in LJBtero date glosses.
 */

import {
  DEFAULT_DATE_MONTH_SPAN_STYLE,
  DEFAULT_DATE_WESTERN_DISPLAY,
  isDateMonthSpanStyle,
  isDateWesternDisplayMode,
  type DateMonthSpanStyle,
  type DateWesternDisplayMode,
} from './dateGloss';

const STORAGE_KEY = 'ljb.scholarlyConventions.v1';

export const SCHOLARLY_CONVENTIONS_CHANGED_EVENT = 'desktop:scholarly-conventions-changed';

export interface ScholarlyConventions {
  dateWesternDisplay: DateWesternDisplayMode;
  /** Month-only span style when conversion is shown. */
  dateMonthSpanStyle: DateMonthSpanStyle;
}

export const DEFAULT_SCHOLARLY_CONVENTIONS: ScholarlyConventions = {
  dateWesternDisplay: DEFAULT_DATE_WESTERN_DISPLAY,
  dateMonthSpanStyle: DEFAULT_DATE_MONTH_SPAN_STYLE,
};

export const loadScholarlyConventions = (): ScholarlyConventions => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ...DEFAULT_SCHOLARLY_CONVENTIONS };
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SCHOLARLY_CONVENTIONS };
    const parsed = JSON.parse(raw) as Partial<ScholarlyConventions>;
    return {
      dateWesternDisplay: isDateWesternDisplayMode(parsed.dateWesternDisplay)
        ? parsed.dateWesternDisplay
        : DEFAULT_DATE_WESTERN_DISPLAY,
      dateMonthSpanStyle: isDateMonthSpanStyle(parsed.dateMonthSpanStyle)
        ? parsed.dateMonthSpanStyle
        : DEFAULT_DATE_MONTH_SPAN_STYLE,
    };
  } catch {
    return { ...DEFAULT_SCHOLARLY_CONVENTIONS };
  }
};

export const saveScholarlyConventions = (state: ScholarlyConventions): void => {
  const next: ScholarlyConventions = {
    dateWesternDisplay: isDateWesternDisplayMode(state.dateWesternDisplay)
      ? state.dateWesternDisplay
      : DEFAULT_DATE_WESTERN_DISPLAY,
    dateMonthSpanStyle: isDateMonthSpanStyle(state.dateMonthSpanStyle)
      ? state.dateMonthSpanStyle
      : DEFAULT_DATE_MONTH_SPAN_STYLE,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota / private mode — in-memory callers still hold the update.
  }
  window.dispatchEvent(new CustomEvent(SCHOLARLY_CONVENTIONS_CHANGED_EVENT));
};

export const getDateWesternDisplayMode = (): DateWesternDisplayMode =>
  loadScholarlyConventions().dateWesternDisplay;

export const getDateMonthSpanStyle = (): DateMonthSpanStyle =>
  loadScholarlyConventions().dateMonthSpanStyle;
