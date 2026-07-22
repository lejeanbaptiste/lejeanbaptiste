/** @jest-environment jsdom */

import { inferCorrectionKind } from './applyCorrection';

describe('inferCorrectionKind', () => {
  it('returns supplied when only correction is filled', () => {
    expect(inferCorrectionKind('', 'added')).toEqual({ kind: 'supplied' });
  });

  it('returns surplus when only selected text is filled', () => {
    expect(inferCorrectionKind('extra', '')).toEqual({ kind: 'surplus' });
  });

  it('returns substitution when both differ', () => {
    expect(inferCorrectionKind('when', 'then')).toEqual({ kind: 'substitution' });
  });

  it('rejects empty fields', () => {
    expect(inferCorrectionKind('', '')).toEqual({
      kind: 'invalid',
      errorKey: 'LWC.desktop.correction.empty_error',
    });
  });

  it('rejects identical text', () => {
    expect(inferCorrectionKind('same', 'same')).toEqual({
      kind: 'invalid',
      errorKey: 'LWC.desktop.correction.same_text_error',
    });
  });

  it('trims whitespace before inferring', () => {
    expect(inferCorrectionKind('  extra  ', '')).toEqual({ kind: 'surplus' });
    expect(inferCorrectionKind('', '  added  ')).toEqual({ kind: 'supplied' });
  });
});
