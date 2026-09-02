/**
 * Composites one ranked-uniform body-pose SVG (background/middle/foreground
 * layers, f-rankN/m-rankN decoration, and an optional weapon) entirely
 * locally, the same way avatarAssets.ts composites the head - except the
 * source art is progression-gated (higher ranks are a spoiler), so it's read
 * from the encrypted bundle via gameAssets.ts's `getGameAssetBuffer`, not a
 * plain resources folder.
 *
 * Each request asks for one of two layers - `back` (the pose's `background`
 * group only - rear props, a flag pole) or `front` (`middle` + `foreground`
 * - the uniform itself, plus any front prop) - so the caller can sandwich
 * the head SVG between two <img> elements instead of one flat body image
 * covering it entirely. See UniformAvatar.tsx, which fetches both.
 *
 * The renderer decides *what* to show (which pose, which weapon ids - see
 * UniformAvatar.tsx and generatedBodyPools.ts for the random-pick logic);
 * this file only does the mechanical "hide everything except these groups"
 * rewrite. That split keeps the pool/randomness logic in one place
 * (buildable, testable TS in apps/commons) while this file stays a dumb
 * string transform, mirroring avatarAssets.ts's composeAvatarSvg.
 *
 * Body SVGs are big (up to ~26MB - almost entirely embedded base64 PNG
 * data), so every full-text pass over one is expensive: toggling ~20
 * labels/ids one at a time (the original approach here) measured at
 * ~1.6s per layer on the worst-case pose - ~3.2s for one portrait's two
 * layers. `applyDisplayToggles` does every toggle in a single combined-regex
 * pass instead, which measured at ~35ms for the same input (roughly a 90x
 * speedup) - the win isn't a smarter algorithm, just not re-scanning the
 * same tens of megabytes twenty times over.
 *
 * This rewrite approach mirrors visual_design/scripts/bodySvg.mjs, which
 * does the same toggling (still one-label-at-a-time - fine there, since it
 * only runs a handful of times at pack time, not on every portrait render).
 * Keep both in sync if the tag-rewrite logic itself changes: same source
 * pattern (`inkscape:label="..."` / `id="..."`), same "add a style
 * attribute if there isn't one yet" fallback.
 */

import { protocol } from 'electron';

import { getGameAssetBuffer } from './gameAssets';

export const BODY_SCHEME = 'ljb-body';

const RANKS = [1, 2, 3, 4, 5, 6, 7] as const;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rewriteTagDisplay(tag: string, value: 'inline' | 'none'): string {
  if (/style="[^"]*display:[a-z]+/.test(tag)) {
    return tag.replace(/(style="[^"]*display:)[a-z]+/, `$1${value}`);
  }
  if (/style="[^"]*"/.test(tag)) {
    return tag.replace(/style="([^"]*)"/, `style="$1;display:${value}"`);
  }
  return tag.replace(/\/?>$/, (closing) => ` style="display:${value}"${closing}`);
}

/** One combined-regex pass toggling every element carrying a matching
 * `inkscape:label="..."` or `id="..."`, rather than one full-text pass per
 * toggle (see the perf note at the top of this file). */
function applyDisplayTogglePass(
  svgText: string,
  attrName: 'inkscape:label' | 'id',
  values: ReadonlyMap<string, 'inline' | 'none'>,
): string {
  if (values.size === 0) return svgText;
  const alt = Array.from(values.keys()).map(escapeRegex).join('|');
  const tagRe = new RegExp(`<[a-zA-Z]+\\b[^>]*\\b${attrName}="(?<value>${alt})"[^>]*>`, 'g');
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(svgText))) {
    const value = values.get(match.groups!.value!)!;
    result += svgText.slice(lastIndex, match.index) + rewriteTagDisplay(match[0], value);
    lastIndex = match.index + match[0].length;
  }
  result += svgText.slice(lastIndex);
  return result;
}

/** Targets every element carrying a matching `inkscape:label="..."` (not
 * just a single `<g>` wrapper - the f-rankN/m-rankN groups are always
 * exactly one `<g>` per label, but f-body/m-body, the base silhouette, is
 * NOT a single wrapping group: the label repeats across an `<image>` and
 * one or more `<path>` siblings, e.g. bodies/body1.svg has 3 elements
 * labeled "f-body", and some poses (body2.svg) even repeat a rank label
 * across two separate groups - a partial set in `middle`, a full set in
 * `foreground`) or a matching `id="..."` (weapon images), in two sequential
 * passes rather than one combined alternation.
 *
 * Two passes, not one: a weapon `<image>` can carry BOTH a matching id and
 * an `inkscape:label` that collides with a rank-decoration label being
 * toggled here (e.g. bodies/body7.svg's rank-3 weapon pieces are labeled
 * plainly "m-rank3", identical to the outer m-rank3 decoration group's own
 * label, since rank 3 has no a/b variant needing a suffix). A single
 * combined regex can only take one alternative per tag - which one depends
 * on where the greedy backtracking lands, not on which is "correct" - so a
 * weapon image could get hidden by the rank pass's "rank 3 isn't the
 * current rank" instead of shown by the id pass's "this weapon was picked",
 * with no way to fix by reordering the alternation. Running ids in a
 * second, later pass makes an id match always win on any tag that matches
 * both - weapon ids are a more specific, per-element intent than a shared
 * rank label. Exported for testing only - composeBodySvg below is the real
 * entry point. */
export function applyDisplayToggles(
  svgText: string,
  labelValues: ReadonlyMap<string, 'inline' | 'none'>,
  idValues: ReadonlyMap<string, 'inline' | 'none'>,
): string {
  const afterLabels = applyDisplayTogglePass(svgText, 'inkscape:label', labelValues);
  return applyDisplayTogglePass(afterLabels, 'id', idValues);
}

/** Every toggleable weapon element id inside any <g inkscape:label="weapons">
 * block (case-insensitive - see bodies/body7.svg's "Weapons"), across however
 * many such blocks this pose has (0, 1, or 2 - see bodySvg.mjs).
 *
 * That means <image id="..."> leaves *and* any labelled <g id="..."> wrapper
 * around them: bodies/body11.svg wraps each weapon variant in its own
 * `<g inkscape:label="m-wwii4" style="display:none">` carrying the same label
 * as the images inside it, so toggling only the leaves to display:inline
 * leaves them invisible under a still-hidden parent - the weapon simply never
 * appears. visual_design/scripts/bodySvg.mjs's poolImagesByRankLabel already
 * pools those wrapper ids alongside the leaf ids (so they arrive here in
 * `weaponIds`); this is the runtime half of the same fix. Unlabelled <g>
 * wrappers are deliberately left alone - they're structural, not a weapon
 * variant, and hiding them would take the whole block down with them.
 * Exported for testing only. */
export function allWeaponElementIds(svgText: string): string[] {
  const ids: string[] = [];
  const openRe = /<g\b[^>]*\binkscape:label="weapons"[^>]*>/gi;
  let openMatch: RegExpExecArray | null;
  while ((openMatch = openRe.exec(svgText))) {
    const tagRe = /<g[\s>]|<\/g>/g;
    tagRe.lastIndex = openMatch.index;
    let depth = 0;
    let end = -1;
    let tagMatch: RegExpExecArray | null;
    while ((tagMatch = tagRe.exec(svgText))) {
      if (tagMatch[0] === '</g>') {
        depth -= 1;
        if (depth === 0) {
          end = tagRe.lastIndex;
          break;
        }
      } else {
        depth += 1;
      }
    }
    if (end === -1) break;
    const inner = svgText.slice(openMatch.index + openMatch[0].length, end - '</g>'.length);
    const elementRe = /<(?<tag>g|image)\b[^>]*>/g;
    let elementMatch: RegExpExecArray | null;
    while ((elementMatch = elementRe.exec(inner))) {
      const tag = elementMatch[0];
      const id = /\bid="([^"]*)"/.exec(tag)?.[1];
      if (!id) continue;
      if (elementMatch.groups!.tag === 'g' && !/\binkscape:label="/.test(tag)) continue;
      ids.push(id);
    }
    openRe.lastIndex = end;
  }
  return ids;
}

function isValidPoseIndex(value: string | null): value is string {
  return !!value && /^\d+$/.test(value);
}

function isValidRank(value: string | null): value is string {
  return !!value && /^[1-7]$/.test(value);
}

function isValidBodyType(value: string | null): value is 'm' | 'f' {
  return value === 'm' || value === 'f';
}

function isValidLayer(value: string | null): value is 'back' | 'front' {
  return value === 'back' || value === 'front';
}

function isValidSubjectBackground(value: string | null): value is string {
  return value === null || /^[1-4]$/.test(value);
}

/** Only ids matching the asset naming convention are ever matched against
 * the SVG text - same defense-in-depth as avatarAssets.ts's isValidVariant. */
function isValidId(value: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(value);
}

function composeBodySvg(params: URLSearchParams): string | null {
  const poseIndex = params.get('pose');
  const bodyType = params.get('bodyType');
  const rank = params.get('rank');
  const layer = params.get('layer');
  const subjectBackground = params.get('subjectBackground');
  if (
    !isValidPoseIndex(poseIndex) ||
    !isValidBodyType(bodyType) ||
    !isValidRank(rank) ||
    !isValidLayer(layer) ||
    !isValidSubjectBackground(subjectBackground)
  ) {
    return null;
  }

  const buffer = getGameAssetBuffer(`body/pose${poseIndex}`);
  if (!buffer) return null;
  const svg = buffer.toString('utf8');

  // Head renders between the two: `back` (background - rear props, a flag
  // pole) sits behind the head, `front` (middle + foreground - the uniform
  // itself, plus any front prop) sits in front of it. A pose missing one of
  // these top-level groups just gets a blank layer for that half - hiding a
  // label that doesn't exist in this pose's SVG is already a no-op, so
  // there's nothing to special-case per pose.
  const showBackground = layer === 'back';
  const labelValues = new Map<string, 'inline' | 'none'>([
    ['background', showBackground ? 'inline' : 'none'],
    ['middle', showBackground ? 'none' : 'inline'],
    ['foreground', showBackground ? 'none' : 'inline'],
    // The base silhouette itself (f-body/m-body) is a separate thing from
    // the rank decoration overlays below - forgetting to toggle it was
    // exactly why picking "F" didn't actually change the body.
    ['f-body', bodyType === 'f' ? 'inline' : 'none'],
    ['m-body', bodyType === 'm' ? 'inline' : 'none'],
  ]);
  // Subject scenes can carry their own full-frame environments. They are
  // visible only in the rear layer so the front layer still contains the
  // aircraft and uniform without duplicating the scene behind the head.
  for (let environment = 1; environment <= 4; environment += 1) {
    labelValues.set(
      `background${environment}`,
      showBackground && subjectBackground === String(environment) ? 'inline' : 'none',
    );
  }
  for (const r of RANKS) {
    labelValues.set(`f-rank${r}`, bodyType === 'f' && String(r) === rank ? 'inline' : 'none');
    labelValues.set(`m-rank${r}`, bodyType === 'm' && String(r) === rank ? 'inline' : 'none');
  }

  const requestedWeaponIds = new Set(
    (params.get('weaponIds') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0 && isValidId(id)),
  );
  const idValues = new Map<string, 'inline' | 'none'>(
    allWeaponElementIds(svg).map((id) => [id, requestedWeaponIds.has(id) ? 'inline' : 'none']),
  );

  return applyDisplayToggles(svg, labelValues, idValues);
}

export function registerBodyProtocol(): void {
  protocol.handle(BODY_SCHEME, (request) => {
    try {
      const url = new URL(request.url);
      const svg = composeBodySvg(url.searchParams);
      if (!svg) return new Response(null, { status: 404 });
      return new Response(svg, { headers: { 'content-type': 'image/svg+xml' } });
    } catch {
      return new Response(null, { status: 500 });
    }
  });
}
