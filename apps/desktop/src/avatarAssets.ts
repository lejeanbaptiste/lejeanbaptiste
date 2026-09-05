/**
 * Composites the Adventurer character-avatar layers (base, eyes, eyebrows,
 * mouth, glasses, hair) into a single SVG, entirely locally: no network
 * request, no dependency on api.dicebear.com. Served to the renderer over
 * the `grognard-avatar://` scheme so callers keep using `fetch(url).then(r =>
 * r.text())` exactly as they did against the old live-API URL - only
 * dicebear.ts's URL-building changed (see diceBearAvatarUrl).
 *
 * Unlike game-assets.ts's bundle, this artwork is plain, uncompressed,
 * unencrypted files under resources/avatar-parts/ - the face/hair options
 * aren't a spoiler, so there's nothing to hide here. Source: the private
 * visual_design repo's visual_style/ directory (CC BY 4.0, Lisa
 * Wischofsky) - see THIRD_PARTY_NOTICES.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import { app, protocol } from 'electron';

export const AVATAR_SCHEME = 'grognard-avatar';

// The real Adventurer canvas is 762x762 (see visual_style/manifest.json).
// Some hair variants draw outside it, which the browser clips at the
// viewBox edge - rather than patch the viewBox at render time (the old
// approach, a 40-unit pad applied per-consumer via padSvgViewBox), the
// composite is built directly on a much larger canvas: content-sized
// padding on every side, so nothing can ever clip regardless of how far a
// future layer overflows. Content sits centered in the middle third.
const CONTENT_SIZE = 762;
const PAD = CONTENT_SIZE;
export const CANVAS_SIZE = CONTENT_SIZE + PAD * 2;

// eyes -> eyebrows -> mouth -> features -> glasses -> hair -> earrings, on
// top of base. Matches visual_style/manifest.json's stackingOrder - every
// optional category (features/glasses/earrings) is wired in here, not just
// a subset: a variant list existing in visual_style/ with nothing reading
// it would be exactly the kind of hand-picked-shortlist-by-omission this is
// meant to avoid.
const LAYER_ORDER: readonly {
  folder: string;
  param: string;
  colorParam?: string;
  probabilityParam?: string;
}[] = [
  { folder: 'eyes', param: 'eyesVariant' },
  { folder: 'eyebrows', param: 'eyebrowsVariant' },
  { folder: 'mouth', param: 'mouthVariant' },
  { folder: 'features', param: 'featuresVariant', probabilityParam: 'featuresProbability' },
  { folder: 'glasses', param: 'glassesVariant', probabilityParam: 'glassesProbability' },
  { folder: 'hair', param: 'hairVariant', colorParam: 'hairColor' },
  { folder: 'earrings', param: 'earringsVariant', probabilityParam: 'earringsProbability' },
];

function getPartsDir(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'avatar-parts')
    : path.join(__dirname, '../resources/avatar-parts');
}

function readLayerSvg(folder: string, variant: string): string | null {
  const filePath = path.join(getPartsDir(), folder, `${variant}.svg`);
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const match = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(text);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function withColor(body: string, hex: string | null): string {
  if (!hex) return body;
  return body.replace(/currentColor/g, `#${hex.replace(/^#/, '')}`);
}

function isValidHex(value: string | null): value is string {
  return !!value && /^[0-9a-fA-F]{6}$/.test(value);
}

/** Only variant names matching the asset naming convention are ever read
 * from disk - this is the entire defense against a crafted query string
 * reaching outside resources/avatar-parts/. */
function isValidVariant(value: string | null): value is string {
  return !!value && /^[a-zA-Z0-9_-]+$/.test(value);
}

// visual_style/base/default.svg's neck is a single <rect id="neck">,
// separate from the face/ear paths - stripping it out and cropping to the
// plain (unpadded) content canvas is what closeUp mode below uses to turn
// the body-scene-registered portrait (small, padded, neck included - what
// every other caller needs to line up with the uniform collar) into a
// head-only preview with minimal dead space. The regex is scoped to the
// `id="neck"` attribute specifically (not geometry) so it keeps working if
// the shape is ever redrawn, as long as the id survives.
const NECK_ELEMENT_RE = /<rect\b[^>]*\bid="neck"[^>]*\/>/;

function composeAvatarSvg(params: URLSearchParams): string {
  const closeUp = params.get('closeUp') === '1';
  let base = readLayerSvg('base', 'default') ?? '';
  if (closeUp) base = base.replace(NECK_ELEMENT_RE, '');
  const skinColor = params.get('skinColor');
  const parts = [withColor(base, isValidHex(skinColor) ? skinColor : null)];

  for (const layer of LAYER_ORDER) {
    if (layer.probabilityParam) {
      const probability = Number(params.get(layer.probabilityParam) ?? '0');
      if (!(probability > 0)) continue;
    }
    const variant = params.get(layer.param);
    if (!isValidVariant(variant)) continue;
    const body = readLayerSvg(layer.folder, variant);
    if (!body) continue;
    const colorHex = layer.colorParam ? params.get(layer.colorParam) : null;
    parts.push(withColor(body, isValidHex(colorHex) ? colorHex : null));
  }

  // closeUp skips the registration padding entirely (that padding exists so
  // body-scene compositing can never clip an overflowing hairstyle at the
  // small size it's shown at there - not a concern for this dedicated,
  // large head-only preview) and drops the neck, giving a tight head-only
  // frame instead of a small figure lost in a mostly-empty square.
  const size = closeUp ? CONTENT_SIZE : CANVAS_SIZE;
  const offset = closeUp ? 0 : PAD;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">` +
    `<g transform="translate(${offset} ${offset})">${parts.join('')}</g></svg>`
  );
}

export function registerAvatarProtocol(): void {
  protocol.handle(AVATAR_SCHEME, (request) => {
    try {
      const url = new URL(request.url);
      const svg = composeAvatarSvg(url.searchParams);
      return new Response(svg, { headers: { 'content-type': 'image/svg+xml' } });
    } catch {
      return new Response(null, { status: 500 });
    }
  });
}
