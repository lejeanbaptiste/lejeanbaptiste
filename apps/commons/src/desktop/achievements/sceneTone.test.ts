import {
  gradeScale,
  sceneGradeDefs,
  sceneGradeFilter,
  sceneVignetteCss,
  sceneVignetteSvg,
  GRADE_REFERENCE_WIDTH,
  type ArchiveTreatment,
} from './sceneTone';

/** QA's two real canvases: the in-game composite and the certificate's
 * portrait, which rasterizes at (640 - 60*2) * 3 device pixels. */
const GAME = { renderWidth: GRADE_REFERENCE_WIDTH, sceneWidth: GRADE_REFERENCE_WIDTH };
const PRINT = { renderWidth: 1560, sceneWidth: 733 };

const defs = (treatment: ArchiveTreatment, metrics = GAME) =>
  sceneGradeDefs(treatment, 'p', metrics);

const tableFor = (markup: string, channel: 'R' | 'G' | 'B'): number[] => {
  const match = new RegExp(`<feFunc${channel} type="table" tableValues="([^"]+)"`).exec(markup);
  if (!match) throw new Error(`no ${channel} tone table in ${markup.slice(0, 120)}`);
  return match[1].split(' ').map(Number);
};

/** Slope across the middle of the curve, in the same units as QA's contrast
 * multiplier - the table is evenly spaced over [0,1]. */
const midtoneSlope = (table: number[]): number => {
  const mid = Math.floor(table.length / 2);
  return (table[mid + 1] - table[mid - 1]) / (2 / (table.length - 1));
};

describe('tonal response', () => {
  it('never crushes to black', () => {
    // The bug both implementations shared: a contrast pivoting on mid-grey
    // has a negative intercept, so at 1.08 everything under 9/255 clipped to
    // solid black. No treatment's curve may sit on zero now.
    for (const treatment of ['wwi-ortho', 'wwii-bw', 'sepia', 'tinted', 'hand-coloured'] as const) {
      const markup = defs(treatment);
      for (const channel of ['R', 'G', 'B'] as const) {
        expect(tableFor(markup, channel)[0]).toBeGreaterThan(0);
      }
    }
  });

  it('rolls the highlights off rather than clipping them', () => {
    // The same negative intercept clipped the top end too. Only checked
    // where QA leaves the grey alone: sepia and tinted then multiply by a
    // cast (1.10 on sepia's red) and clamp, which is QA's own choice about
    // how a warm highlight runs into paper, not the contrast bug.
    for (const treatment of ['wwi-ortho', 'wwii-bw', 'hand-coloured'] as const) {
      const table = tableFor(defs(treatment), 'R');
      expect(table.at(-1)!).toBeLessThan(1);
    }
  });

  it('is monotonic', () => {
    for (const treatment of ['wwi-ortho', 'wwii-bw', 'sepia', 'hand-coloured'] as const) {
      const table = tableFor(defs(treatment), 'R');
      for (let i = 1; i < table.length; i += 1) {
        // Non-decreasing rather than strictly increasing: a cast channel can
        // plateau once it reaches the clamp (see above).
        expect(table[i]).toBeGreaterThanOrEqual(table[i - 1]);
      }
    }
  });

  it("keeps QA's midtone contrast for each treatment", () => {
    // The crush is gone but the tuned slope through the midtones is not.
    expect(midtoneSlope(tableFor(defs('wwii-bw'), 'R'))).toBeCloseTo(1.08, 1);
    expect(midtoneSlope(tableFor(defs('hand-coloured'), 'R'))).toBeCloseTo(1.03, 1);
  });

  it("follows QA's size-dependent tuning: softer in game, fuller in print", () => {
    // scaledTone(scale, 1.05, 1.08) - legibility at game size, mood at print.
    const game = midtoneSlope(tableFor(defs('wwi-ortho', GAME), 'R'));
    const print = midtoneSlope(tableFor(defs('wwi-ortho', PRINT), 'R'));
    expect(print).toBeGreaterThan(game);
    expect(game).toBeCloseTo(1.05, 1);
    expect(print).toBeCloseTo(1.08, 1);
  });

  it('folds a sepia/tinted cast into the per-channel tables', () => {
    // QA multiplies the graded grey by [1.10, 1.00, 0.72] / [0.82, 0.94, 1.05].
    const sepia = defs('sepia');
    const last = (channel: 'R' | 'G' | 'B') => tableFor(sepia, channel).at(-1)!;
    expect(last('R')).toBeGreaterThan(last('G'));
    expect(last('G')).toBeGreaterThan(last('B'));

    const tinted = defs('tinted');
    const tintedLast = (channel: 'R' | 'G' | 'B') => tableFor(tinted, channel).at(-1)!;
    expect(tintedLast('B')).toBeGreaterThan(tintedLast('G'));
    expect(tintedLast('G')).toBeGreaterThan(tintedLast('R'));
  });
});

describe('greyscale conversion', () => {
  it('gives wwi-ortho a real orthochromatic response, not a luma greyscale', () => {
    // The single biggest thing the old CSS approximation got wrong: ortho
    // plates are blue-sensitive and near red-blind. grayscale(1) is Rec.709,
    // roughly the inverse weighting, and it made wwi-ortho and wwii-bw render
    // identically. Blue must outweigh red here by a wide margin.
    const markup = defs('wwi-ortho');
    expect(markup).toContain('<feColorMatrix type="matrix" values="0.1 0.35 0.55');
  });

  it('gives wwii-bw a panchromatic luma, distinct from ortho', () => {
    expect(defs('wwii-bw')).toContain('<feColorMatrix type="matrix" values="0.3 0.59 0.11');
    expect(defs('wwii-bw')).not.toEqual(defs('wwi-ortho'));
  });

  it('leaves hand-coloured in colour', () => {
    // A restraint pass, not a conversion - and QA has no desaturation here,
    // so the old saturate(0.92) is gone with the rest of the approximation.
    expect(defs('hand-coloured')).not.toContain('feColorMatrix');
    expect(sceneGradeFilter('hand-coloured', 'p')).not.toContain('saturate');
  });
});

describe('grain and optical blur', () => {
  it('grains only the two stocks QA grains, with their own amplitudes', () => {
    expect(defs('wwi-ortho')).toContain('feTurbulence');
    expect(defs('wwii-bw')).toContain('feTurbulence');
    for (const treatment of ['sepia', 'tinted', 'hand-coloured'] as const) {
      expect(defs(treatment)).not.toContain('feTurbulence');
    }
    // Ortho is the grainier stock: 0.08 against wwii-bw's 0.022.
    expect(defs('wwi-ortho')).toContain('slope="0.08"');
    expect(defs('wwii-bw')).toContain('slope="0.022"');
  });

  it('scales grain with the canvas so speckle keeps its apparent size', () => {
    const frequency = (markup: string) =>
      Number(/baseFrequency="([\d.]+)"/.exec(markup)?.[1] ?? NaN);
    // Print is coarser per user unit only because its user space is smaller
    // than its pixel count; what matters is that it isn't left at the game
    // value, which would make grain finer purely by having more pixels.
    expect(frequency(defs('wwi-ortho', PRINT))).not.toBeCloseTo(
      frequency(defs('wwi-ortho', GAME)),
      3,
    );
  });

  it('blurs ortho only above the reference size', () => {
    // Period lenses had a fixed resolving power, so only the bigger canvas
    // needs blur to read as equally soft. Zero at game size.
    expect(defs('wwi-ortho', GAME)).not.toContain('feGaussianBlur');
    expect(defs('wwi-ortho', PRINT)).toContain('feGaussianBlur');
    expect(defs('wwii-bw', PRINT)).not.toContain('feGaussianBlur');
  });
});

describe('vignette', () => {
  const valueAt = (treatment: ArchiveTreatment, offsetPercent: number): number => {
    const css = sceneVignetteCss(treatment);
    if (!css) throw new Error('no vignette');
    const match = new RegExp(`rgb\\((\\d+), \\d+, \\d+\\) ${offsetPercent.toFixed(1)}%`).exec(
      css.backgroundImage,
    );
    if (!match) throw new Error(`no stop at ${offsetPercent}%`);
    return Number(match[1]);
  };

  it('darkens the edges and leaves the centre alone', () => {
    expect(valueAt('wwi-ortho', 50)).toBe(255);
    expect(valueAt('wwi-ortho', 0)).toBe(Math.round(255 * (1 - 0.12)));
    expect(valueAt('wwi-ortho', 100)).toBe(Math.round(255 * (1 - 0.12)));
  });

  it("uses QA's per-treatment depth", () => {
    // 0.12 for ortho against 0.035 for wwii-bw.
    expect(valueAt('wwii-bw', 0)).toBe(Math.round(255 * (1 - 0.035)));
    expect(valueAt('wwii-bw', 0)).toBeGreaterThan(valueAt('wwi-ortho', 0));
  });

  it('combines the two axes with darken, giving a rectangular falloff', () => {
    // QA's edge term is max(|nx|, |ny|) - Chebyshev, so the level sets are
    // nested rectangles and a corner is no darker than an edge midpoint. That
    // is only true if the two ramps are combined with min, i.e. darken.
    expect(sceneVignetteCss('wwi-ortho')?.backgroundBlendMode).toBe('darken');
    expect(sceneVignetteCss('wwi-ortho')?.mixBlendMode).toBe('multiply');
    const svg = sceneVignetteSvg('wwi-ortho', 'p', 400, 200);
    expect(svg).toContain('mix-blend-mode:darken');
    expect(svg).toContain('isolation:isolate;mix-blend-mode:multiply');
  });

  it('leaves the treatments QA does not vignette alone', () => {
    for (const treatment of ['sepia', 'tinted', 'hand-coloured', 'colour'] as const) {
      expect(sceneVignetteCss(treatment)).toBeUndefined();
      expect(sceneVignetteSvg(treatment, 'p', 400, 200)).toBe('');
    }
  });
});

describe('plumbing', () => {
  it('declares sRGB interpolation', () => {
    // SVG primitives default to linearRGB. Every QA constant was tuned
    // against canvas ImageData, i.e. gamma-encoded sRGB.
    expect(defs('wwi-ortho')).toContain('color-interpolation-filters="sRGB"');
  });

  it('defines exactly the id the filter value references', () => {
    const id = /url\(#([^)]+)\)/.exec(sceneGradeFilter('sepia', 'p') ?? '')?.[1];
    expect(id).toBeDefined();
    expect(defs('sepia')).toContain(`id="${id}"`);
  });

  it('namespaces ids by prefix so two portraits can share a document', () => {
    expect(sceneGradeDefs('sepia', 'a', GAME)).not.toContain('"b-');
    expect(sceneVignetteSvg('wwi-ortho', 'a', 10, 10)).not.toContain('"b-');
  });

  it('leaves an untreated colour record alone', () => {
    expect(sceneGradeFilter('colour', 'p')).toBeUndefined();
    expect(defs('colour')).toBe('');
  });

  it('measures scale against the reference canvas', () => {
    expect(gradeScale(GRADE_REFERENCE_WIDTH)).toBe(1);
    expect(gradeScale(1560)).toBeCloseTo(2.058, 3);
  });
});
