/**
 * The archive photo grade, ported from the QA asset browser
 * (visual_design/qa/asset-browser.html, `gradeFrame`) so the app renders what
 * the treatments were actually designed and reviewed against.
 *
 * QA is the design surface: it grades a real composite at both real output
 * sizes and every constant in it was tuned by eye there. The app previously
 * had an unrelated, much cruder approximation built out of CSS filter
 * shorthands - `grayscale(1) contrast(1.08) brightness(0.98)` and friends -
 * which shared no code, no channel weights and no curve with it. This module
 * replaces that with QA's own pipeline, expressed as an SVG filter so the DOM
 * portrait and the exported SVG can both use it.
 *
 * ONE deliberate departure, and it is a bug fix rather than a retune. Both
 * implementations ended their contrast step with a line pivoting on mid-grey
 * - QA's `clamp((v - .5) * c + .5)`, CSS's `contrast(c)`, algebraically the
 * same thing - whose intercept is negative for any c > 1. At c = 1.08 that is
 * `1.08v - 0.04`: everything at or below 9/255 clipped to solid black and
 * everything above 246/255 to paper white. Since these run on gamma-encoded
 * sRGB, that toe is where nearly all the shadow detail in a trench or smoke
 * scene lives, which is why dark records read as flat black. It also
 * contradicts docs/photo_filters.md, which asks for "Shadow crush: none" and
 * for blacks that "no longer become absolute black". `contrastCurve` below
 * keeps the tuned midtone slope but lands on [BLACK_LIFT, WHITE_CEILING]
 * instead of clipping at both ends. Everything downstream of it - gamma,
 * highlight stretch, tone triplets, vignette, grain - is QA's, unchanged.
 *
 * Keep this in sync with gradeFrame if the QA tuning moves again.
 */

/** Canvas width QA's size-dependent constants are anchored at: the in-game
 * compositing canvas (rewards/bg_*.png is 758x331). Both pipelines are
 * measured against it - see `gradeScale`. */
export const GRADE_REFERENCE_WIDTH = 758;

export type ArchiveTreatment =
  'colour' | 'wwi-ortho' | 'wwii-bw' | 'sepia' | 'tinted' | 'hand-coloured';

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** `scale` in QA's terms: output width over the reference width. Feed it the
 * width the scene is really *rasterized* at, not its CSS size - the live
 * portrait paints at 293px and the certificate's portrait, though authored at
 * 733 user units, lands at (640 - 60*2) * 3 = 1560 device pixels once
 * buildCertificateSvg scales it into the card and svgToPngBytes oversamples
 * by 3. That 1560 is exactly the print canvas QA grades its second preview
 * at, so the two pipelines line up without any fudge factor. */
export const gradeScale = (renderWidth: number): number => renderWidth / GRADE_REFERENCE_WIDTH;

/** How the scene is measured, which takes two numbers rather than one.
 * `renderWidth` is device pixels and drives QA's size-dependent *tuning*;
 * `sceneWidth` is the width in the filter's own user-space units and converts
 * QA's pixel-sized *spatial* effects (grain cell, blur radius) into that
 * space. They coincide for the live portrait only when the display is 1x. */
export interface SceneMetrics {
  renderWidth: number;
  sceneWidth: number;
}

/** Device pixels per user-space unit - the conversion QA's pixel constants
 * need to survive the move into a resolution-independent filter. */
const devicePixelsPerUnit = ({ renderWidth, sceneWidth }: SceneMetrics): number =>
  sceneWidth > 0 ? renderWidth / sceneWidth : 1;

/** QA's `scaledTone`: linear between the value at the reference width and the
 * value at 2x or beyond, clamped past either end. Softer crush and less
 * highlight stretch at game size, where legibility matters more than mood and
 * there is less spatial resolution to carry shape; the fuller treatment at
 * print size. */
const scaledTone = (scale: number, atReference: number, atDoubled: number): number =>
  atReference + (atDoubled - atReference) * clamp01(scale - 1);

/** Printed black and white points - the ends the contrast curve lands on
 * instead of clipping. docs/photo_filters.md asks for 18/255 and 228/255;
 * these are deliberately more conservative (11/255 and 246/255), because
 * unlike the doc's single curve this one still has QA's gamma and highlight
 * stretch running after it. */
const BLACK_LIFT = 0.045;
const WHITE_CEILING = 0.965;

/** Replaces QA's `clamp((v - .5) * contrast + .5)`, holding its midtone slope
 * but as a smooth S over [BLACK_LIFT, WHITE_CEILING]:
 *
 *   out = lift + range * (v + k * (-2v^3 + 3v^2 - v))
 *
 * The cubic is zero at v = 0, 0.5 and 1, so k moves the slope without moving
 * the mid-grey anchor the original pivoted on: slope is range * (1 + k/2) in
 * the middle and range * (1 - k) at the ends. Solving the first for the
 * requested contrast gives k below. Monotonic as long as k < 1, which holds
 * for every contrast QA uses (the largest, 1.10, gives k = 0.39). */
const contrastCurve = (v: number, contrast: number): number => {
  const range = WHITE_CEILING - BLACK_LIFT;
  const k = 2 * (contrast / range - 1);
  return BLACK_LIFT + range * (v + k * (-2 * v ** 3 + 3 * v ** 2 - v));
};

/** Per-treatment constants, all read straight off gradeFrame. `luma` is the
 * greyscale conversion (null = none, the treatment keeps its own colour);
 * `tone` multiplies the graded grey into a colour cast; `vignette` and
 * `grain` are the spatial passes. */
interface TreatmentSpec {
  /** RGB weights for the greyscale conversion, or null to grade in colour. */
  luma: [number, number, number] | null;
  /** Midtone contrast; a pair is QA's reference/2x scaled range. */
  contrast: number | [number, number];
  /** Exponent applied after contrast. */
  gamma: number;
  /** Stretch applied above 0.7 only; a pair scales like contrast does. */
  highlight?: [number, number];
  /** Per-channel multiplier turning the grey into a cast. */
  tone?: [number, number, number];
  /** Peak edge darkening, as QA's `v *= 1 - k * edge^2`. */
  vignette: number;
  /** Grain amplitude, as QA's `v + (noise - .5) * k * (1 - v)`. */
  grain: number;
  /** Whether QA blurs this treatment above the reference size. */
  opticalBlur: boolean;
}

const TREATMENTS: Record<ArchiveTreatment, TreatmentSpec | null> = {
  // Orthochromatic plates were blue-sensitive and nearly red-blind, which is
  // why this is a wildly different conversion from a luma greyscale rather
  // than a tweak to one: red goes almost black, blue goes bright. It is the
  // first and most important item in docs/photo_filters.md, and the CSS
  // grayscale(1) this replaces (Rec.709, near the inverse weighting on red
  // and blue) never implemented it - which is also why wwi-ortho and wwii-bw
  // used to render identically.
  'wwi-ortho': {
    luma: [0.1, 0.35, 0.55],
    contrast: [1.05, 1.08],
    gamma: 0.95,
    highlight: [1.05, 1.1],
    vignette: 0.12,
    grain: 0.08,
    opticalBlur: true,
  },
  // Panchromatic stock does see the whole spectrum, so this one is an
  // ordinary Rec.601 luma - much less grain and vignette than ortho, no
  // highlight stretch, and barely any gamma.
  'wwii-bw': {
    luma: [0.3, 0.59, 0.11],
    contrast: 1.08,
    gamma: 0.98,
    vignette: 0.035,
    grain: 0.022,
    opticalBlur: false,
  },
  sepia: {
    luma: [0.3, 0.59, 0.11],
    contrast: 1.1,
    gamma: 1,
    tone: [1.1, 1.0, 0.72],
    vignette: 0,
    grain: 0,
    opticalBlur: false,
  },
  tinted: {
    luma: [0.3, 0.59, 0.11],
    contrast: 1.05,
    gamma: 1,
    tone: [0.82, 0.94, 1.05],
    vignette: 0,
    grain: 0,
    opticalBlur: false,
  },
  // Hand-colouring is a restraint pass, not a conversion: the record keeps
  // its own colour and only the curve is applied, per channel. QA has no
  // desaturation here, so the app's old saturate(0.92) is gone with the rest
  // of the CSS approximation.
  'hand-coloured': {
    luma: null,
    contrast: 1.03,
    gamma: 1,
    vignette: 0,
    grain: 0,
    opticalBlur: false,
  },
  colour: null,
};

const resolve = (value: number | [number, number], scale: number): number =>
  Array.isArray(value) ? scaledTone(scale, value[0], value[1]) : value;

/** The scalar part of a treatment, exactly as gradeFrame applies it: contrast
 * (with the crush fixed), then gamma, then the highlight stretch above 0.7 -
 * all functions of one value, which is what lets the whole chain collapse
 * into a single feComponentTransfer table per channel. */
const tonalResponse = (spec: TreatmentSpec, scale: number, input: number): number => {
  let v = contrastCurve(input, resolve(spec.contrast, scale));
  if (spec.gamma !== 1) v = v ** spec.gamma;
  if (spec.highlight && v > 0.7) v = clamp01(0.7 + (v - 0.7) * resolve(spec.highlight, scale));
  return clamp01(v);
};

/** Samples enough to keep the piecewise-linear interpolation feComponentTransfer
 * does between table entries well under a 1/255 step. */
const TABLE_SAMPLES = 33;

const toneTable = (spec: TreatmentSpec, scale: number, channelTone: number): string =>
  Array.from({ length: TABLE_SAMPLES }, (_, index) => {
    const v = tonalResponse(spec, scale, index / (TABLE_SAMPLES - 1));
    return clamp01(v * channelTone).toFixed(4);
  }).join(' ');

export const gradeFilterId = (prefix: string): string => `${prefix}-grade`;

/**
 * The `<filter>` for one treatment, as SVG markup, or '' for an ungraded
 * record. Chain order follows gradeFrame: greyscale, then the tonal response,
 * then grain, then the optical blur. The vignette is the one pass that isn't
 * here - see sceneVignetteLayers.
 *
 * `color-interpolation-filters="sRGB"` is not optional. SVG primitives default
 * to linearRGB, and every constant in QA was tuned against canvas ImageData,
 * i.e. gamma-encoded sRGB values.
 *
 * @param metrics the scene's device and user-space widths - see SceneMetrics.
 */
export const sceneGradeDefs = (
  treatment: ArchiveTreatment,
  prefix: string,
  metrics: SceneMetrics,
): string => {
  const spec = TREATMENTS[treatment];
  if (!spec) return '';
  const scale = gradeScale(metrics.renderWidth);
  const tone = spec.tone ?? [1, 1, 1];

  const luma = spec.luma;
  const greyscale = luma
    ? `<feColorMatrix type="matrix" values="${[luma, luma, luma]
        .map((row) => `${row.join(' ')} 0 0`)
        .join(' ')} 0 0 0 1 0"/>`
    : '';

  const transfer =
    `<feComponentTransfer result="toned">` +
    (['R', 'G', 'B'] as const)
      .map(
        (channel, index) =>
          `<feFunc${channel} type="table" tableValues="${toneTable(spec, scale, tone[index])}"/>`,
      )
      .join('') +
    `</feComponentTransfer>`;

  return (
    `<filter id="${gradeFilterId(prefix)}" color-interpolation-filters="sRGB" ` +
    `x="0%" y="0%" width="100%" height="100%">` +
    greyscale +
    transfer +
    grainPrimitives(spec, scale, metrics) +
    blurPrimitive(spec, scale, metrics) +
    `</filter>`
  );
};

/** QA's grain: `v + (noise - .5) * amp * (1 - v)` - uniform value noise on a
 * grid whose cell is `max(1, round(scale))` device pixels, so speckle stays
 * roughly the same size relative to the image at either output size rather
 * than just getting finer on a bigger canvas. baseFrequency is per user-space
 * unit, so the cell converts through the scene's own pixel density.
 *
 * The one thing that does not port exactly: feTurbulence is Perlin noise,
 * where QA hashes a coordinate pair into a uniform value. Same amplitude and
 * same shadow weighting, slightly smoother texture.
 *
 * The two arithmetic composites implement the signed multiply-accumulate
 * without ever leaving [0,1], which filter intermediates are clamped to:
 * biasing the noise to sit around 0.5 keeps it representable, and the k3/k4
 * terms subtract that bias back out.
 */
const grainPrimitives = (spec: TreatmentSpec, scale: number, metrics: SceneMetrics): string => {
  if (spec.grain <= 0) return '';
  const cellDevicePixels = Math.max(1, Math.round(scale));
  const frequency = (devicePixelsPerUnit(metrics) / cellDevicePixels).toFixed(5);
  return (
    // Alpha forced opaque: the scene is a full-bleed composite, and letting
    // turbulence generate its own alpha would punch holes through it.
    `<feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="1" ` +
    `seed="7" result="noiseRaw"/>` +
    `<feColorMatrix in="noiseRaw" type="matrix" values="` +
    `0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 1" result="noiseFlat"/>` +
    `<feComponentTransfer in="noiseRaw" result="noise">` +
    (['R', 'G', 'B'] as const)
      .map(
        (channel) =>
          `<feFunc${channel} type="linear" slope="${spec.grain}" ` +
          `intercept="${(0.5 - spec.grain / 2).toFixed(5)}"/>`,
      )
      .join('') +
    `<feFuncA type="linear" slope="0" intercept="1"/>` +
    `</feComponentTransfer>` +
    // shadowWeight = 1 - toned, so grain is strongest in the darks.
    `<feComponentTransfer in="toned" result="shadowWeight">` +
    (['R', 'G', 'B'] as const)
      .map((channel) => `<feFunc${channel} type="linear" slope="-1" intercept="1"/>`)
      .join('') +
    `<feFuncA type="linear" slope="0" intercept="1"/>` +
    `</feComponentTransfer>` +
    // (noise - .5) * shadowWeight + .5
    `<feComposite in="noise" in2="shadowWeight" operator="arithmetic" ` +
    `k1="1" k2="0" k3="-0.5" k4="0.5" result="grain"/>` +
    // toned + (grain - .5)
    `<feComposite in="toned" in2="grain" operator="arithmetic" ` +
    `k1="0" k2="1" k3="1" k4="-0.5"/>`
  );
};

/** Period lenses had a roughly fixed resolving power, so a bigger output
 * canvas needs proportionally more blur to read as the same optical softness.
 * Zero at game size; QA scales it up from there. CSS/canvas `blur(Npx)` is a
 * Gaussian of standard deviation N, and the filter works in user space, so
 * the pixel radius converts by the scene's own pixel density. */
const blurPrimitive = (spec: TreatmentSpec, scale: number, metrics: SceneMetrics): string => {
  if (!spec.opticalBlur || scale <= 1.02) return '';
  const stdDeviation = ((1.4 * (scale - 1)) / devicePixelsPerUnit(metrics)).toFixed(4);
  return `<feGaussianBlur stdDeviation="${stdDeviation}"/>`;
};

/** CSS `filter` value referencing the treatment's filter, or undefined for an
 * ungraded record. The caller must have rendered the matching
 * sceneGradeDefs(prefix) into the same document. */
export const sceneGradeFilter = (
  treatment: ArchiveTreatment,
  prefix: string,
): string | undefined => (TREATMENTS[treatment] ? `url(#${gradeFilterId(prefix)})` : undefined);

/** Stops for one axis of the vignette, as `1 - k * n^2` sampled across the
 * scene, where n is the distance from the centre along that axis. Rendered as
 * a multiply overlay's own colour, so the stop value *is* the multiplier. */
const VIGNETTE_STOPS = 11;

const vignetteStops = (strength: number): { offset: number; value: number }[] =>
  Array.from({ length: VIGNETTE_STOPS }, (_, index) => {
    const offset = index / (VIGNETTE_STOPS - 1);
    const distance = Math.abs(offset * 2 - 1);
    return { offset, value: clamp01(1 - strength * distance ** 2) };
  });

const stopColour = (value: number): string => {
  const channel = Math.round(value * 255);
  return `rgb(${channel}, ${channel}, ${channel})`;
};

/**
 * QA's vignette, `v *= 1 - k * edge^2` with `edge = max(|nx|, |ny|)`. The
 * Chebyshev max means its level sets are nested rectangles, not ellipses, so
 * a radial gradient is the wrong shape for it - but `min` of a horizontal and
 * a vertical gradient is exactly right, and both CSS and SVG can express that
 * (`darken` between the two layers, then `multiply` onto the scene).
 *
 * It rides on top of the filter rather than inside it because SVG filter
 * primitives have no access to coordinates - there is no way to build a
 * positional ramp without feImage, whose sizing behaviour is not worth
 * depending on. The only consequence is ordering: QA vignettes before it
 * grains, so its grain is attenuated in the corners and this one is not. That
 * is bounded by grain amplitude times vignette depth - 0.08 * 0.12, under
 * 2.5/255, in the corners of the ortho treatment alone.
 */
export const sceneVignetteCss = (
  treatment: ArchiveTreatment,
):
  | { backgroundImage: string; backgroundBlendMode: string; mixBlendMode: 'multiply' }
  | undefined => {
  const strength = TREATMENTS[treatment]?.vignette ?? 0;
  if (strength <= 0) return undefined;
  const ramp = vignetteStops(strength)
    .map(({ offset, value }) => `${stopColour(value)} ${(offset * 100).toFixed(1)}%`)
    .join(', ');
  return {
    backgroundImage: `linear-gradient(to right, ${ramp}), linear-gradient(to bottom, ${ramp})`,
    backgroundBlendMode: 'darken',
    mixBlendMode: 'multiply',
  };
};

/** The same vignette as SVG markup, for the certificate's string-built scene:
 * two gradient-filled rects isolated in a group so `darken` combines them
 * with each other, and the group multiplied onto the scene beneath. */
export const sceneVignetteSvg = (
  treatment: ArchiveTreatment,
  prefix: string,
  width: number,
  height: number,
): string => {
  const strength = TREATMENTS[treatment]?.vignette ?? 0;
  if (strength <= 0) return '';
  const stops = vignetteStops(strength)
    .map(
      ({ offset, value }) =>
        `<stop offset="${(offset * 100).toFixed(1)}%" stop-color="${stopColour(value)}"/>`,
    )
    .join('');
  const horizontal = `${prefix}-vignette-h`;
  const vertical = `${prefix}-vignette-v`;
  const rect = (fill: string, blend: string) =>
    `<rect x="0" y="0" width="${width}" height="${height}" fill="url(#${fill})"${blend}/>`;
  return (
    `<defs>` +
    `<linearGradient id="${horizontal}" x1="0" y1="0" x2="1" y2="0">${stops}</linearGradient>` +
    `<linearGradient id="${vertical}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>` +
    `</defs>` +
    `<g style="isolation:isolate;mix-blend-mode:multiply">` +
    rect(horizontal, '') +
    rect(vertical, ' style="mix-blend-mode:darken"') +
    `</g>`
  );
};
