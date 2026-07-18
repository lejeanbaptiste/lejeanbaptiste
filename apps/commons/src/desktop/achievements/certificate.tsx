import { colorMatchFilter } from './colorMatch';
import { getHeadColorStats } from './headColorStats';
import { medalAssetKey, type MedalMetric, type MedalTier } from './MedalIcon';
import {
  BG_ASPECT,
  COAT_FRACTION,
  DECORATION_PANEL,
  GAME_ASSET_PREFIX,
  getCachedColorStats,
  HEAD_BOX_SIZE,
  HEAD_BOX_TOP,
  MEDAL_ASPECT,
  MEDAL_COUNT_FLOOR,
  packGrid,
  PADDED_VIEWBOX_SIZE,
  RIBBON_ASPECT,
  RIBBON_BAND_FRACTION,
  RIBBON_COUNT_FLOOR,
  UNIFORM_ASPECT,
  UNIFORM_KEYS,
} from './UniformAvatar';

type Ribbon = [string, string] | [string, string, string];

export interface CertificateMetric {
  label: string;
  value: number;
}

export interface CertificateMedal {
  metric: MedalMetric;
  tier: MedalTier;
  label: string;
}

export interface CertificatePortraitInput {
  rankIndex: number;
  backgroundImageKey: string;
  /** Raw DiceBear Adventurer SVG markup, exactly as fetched from the local
   * compositor - already pre-padded, same as UniformAvatar. */
  headSvgMarkup: string;
  hairVariant: string;
  skinColor: string;
  hairColor: string;
  serviceRibbons: Ribbon[];
  medals: CertificateMedal[];
}

export interface CertificateOptions {
  encoderName: string;
  commission: string | null;
  serviceSince: string;
  metrics: CertificateMetric[];
  unlockedCount: number;
  totalAchievements: number;
}

export const CERTIFICATE_WIDTH = 640;
export const CERTIFICATE_HEIGHT = 900;

// Rendered, then scaled to fit CERTIFICATE_WIDTH - the same UniformAvatar
// layout math (sceneWidth = size * BG_ASPECT) just needs a concrete pixel
// size to resolve against.
const PORTRAIT_RENDER_SIZE = 320;

const escapeXml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&apos;';
    }
  });

export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

/** Fetches a game asset (uniform/backdrop PNG, medal-disc SVG) and inlines
 * it as a data: URI, using whichever content-type gameAssets.ts served it
 * with - so the same helper works for both PNGs and the SVG medal art. */
const fetchAsDataUri = async (key: string): Promise<string> => {
  const response = await fetch(`${GAME_ASSET_PREFIX}${key}`);
  const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
  const buffer = await response.arrayBuffer();
  return `data:${contentType};base64,${arrayBufferToBase64(buffer)}`;
};

/** One ribbon or medal's placement within the decoration panel, mirroring
 * CSS grid's row-major auto-flow with justify-content: center. */
const layoutGridItems = <T,>(
  items: T[],
  cols: number,
  itemHeight: number,
  aspect: number,
  rackTop: number,
  rackLeft: number,
): Array<{ item: T; x: number; y: number; width: number; height: number }> => {
  const itemWidth = itemHeight * aspect;
  return items.map((item, index) => ({
    item,
    x: rackLeft + (index % cols) * itemWidth,
    y: rackTop + Math.floor(index / cols) * itemHeight,
    width: itemWidth,
    height: itemHeight,
  }));
};

const ribbonRectSvg = (ribbon: Ribbon, x: number, y: number, width: number, height: number): string => {
  const stripes = ribbon.length === 3 ? ribbon : [ribbon[0], ribbon[1], ribbon[0]];
  const stripeWidth = width / 3;
  const stripeRects = stripes
    .map((color, index) => `<rect x="${x + index * stripeWidth}" y="${y}" width="${stripeWidth}" height="${height}" fill="${color}" />`)
    .join('');
  return `${stripeRects}<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="rgba(24, 35, 52, .75)" stroke-width="1" />`;
};

/** Faithfully reproduces UniformAvatar's composite - background, uniform
 * (color-matched), head (color-matched, padded the same way), and the
 * ribbon/medal rack - as a self-contained SVG fragment sized `size` tall
 * (defaults to PORTRAIT_RENDER_SIZE, the certificate's size - pass a
 * smaller value for e.g. a leaderboard hover-preview thumbnail). Every
 * image is inlined as a base64 data: URI (fetched via the renderer's own
 * fetch, not an <img> load), so the result has no external references and
 * can't taint the canvas it's later drawn into. */
export const buildPortraitFragment = async (
  input: CertificatePortraitInput,
  size: number = PORTRAIT_RENDER_SIZE,
): Promise<{ svg: string; width: number; height: number }> => {
  const uniformIndex = Math.max(0, Math.min(UNIFORM_KEYS.length - 1, input.rankIndex));
  const uniformKey = UNIFORM_KEYS[uniformIndex]!;

  // Fetch each distinct medal key once even if the same medal appears
  // several times in input.medals (e.g. multiple ranks of the same metric).
  const medalKeys = Array.from(new Set(input.medals.map((medal) => medalAssetKey(medal.metric, medal.tier))));

  const [backgroundStats, uniformStats, backgroundDataUri, uniformDataUri, medalDataUriEntries] =
    await Promise.all([
      getCachedColorStats(input.backgroundImageKey),
      getCachedColorStats(uniformKey),
      fetchAsDataUri(input.backgroundImageKey),
      fetchAsDataUri(uniformKey),
      Promise.all(medalKeys.map(async (key) => [key, await fetchAsDataUri(key)] as const)),
    ]);
  const medalDataUris = new Map(medalDataUriEntries);
  const headStats = getHeadColorStats(input.hairVariant, input.skinColor, input.hairColor);
  const uniformFilter = colorMatchFilter(uniformStats, backgroundStats);
  const headFilter = colorMatchFilter(headStats, backgroundStats);
  // Already pre-padded by the local compositor (see SVG_PAD in
  // UniformAvatar.tsx) - no further viewBox surgery needed here.
  const paddedHeadMarkup = input.headSvgMarkup;

  const sceneWidth = size * BG_ASPECT;
  const coatHeight = size * COAT_FRACTION;
  const coatWidth = coatHeight * UNIFORM_ASPECT;
  const coatTop = size - coatHeight;
  const portraitLeft = (sceneWidth - coatWidth) / 2;

  const headBoxSize = HEAD_BOX_SIZE * size;
  const headBoxTop = HEAD_BOX_TOP * size;
  const headBoxLeft = portraitLeft + (coatWidth - headBoxSize) / 2;

  const ribbons = input.serviceRibbons.slice(0, 9);
  const panelWidth = coatWidth * DECORATION_PANEL.width;
  const panelHeight = coatHeight * DECORATION_PANEL.height;
  const panelLeft = portraitLeft + coatWidth * DECORATION_PANEL.left;
  const panelTop = coatTop + coatHeight * DECORATION_PANEL.top;
  const ribbonBoxHeight = ribbons.length > 0 ? panelHeight * RIBBON_BAND_FRACTION : 0;
  const medalBoxHeight = panelHeight - ribbonBoxHeight;
  const ribbonGrid = packGrid(
    ribbons.length > 0 ? Math.max(ribbons.length, RIBBON_COUNT_FLOOR) : 1,
    panelWidth,
    ribbonBoxHeight,
    RIBBON_ASPECT,
  );
  const medalGrid = packGrid(
    Math.max(input.medals.length, MEDAL_COUNT_FLOOR),
    panelWidth,
    medalBoxHeight,
    MEDAL_ASPECT,
  );
  const ribbonRackHeight = ribbons.length > 0 ? ribbonGrid.rows * ribbonGrid.itemHeight : 0;
  const medalRackHeight = medalGrid.rows * medalGrid.itemHeight;
  const contentTop = panelTop + (panelHeight - ribbonRackHeight - medalRackHeight) / 2;

  const ribbonRackWidth = ribbonGrid.cols * ribbonGrid.itemHeight * RIBBON_ASPECT;
  const ribbonPlacements = layoutGridItems(
    ribbons,
    ribbonGrid.cols,
    ribbonGrid.itemHeight,
    RIBBON_ASPECT,
    contentTop,
    panelLeft + (panelWidth - ribbonRackWidth) / 2,
  );
  const medalRackWidth = medalGrid.cols * medalGrid.itemHeight * MEDAL_ASPECT;
  const medalPlacements = layoutGridItems(
    input.medals,
    medalGrid.cols,
    medalGrid.itemHeight,
    MEDAL_ASPECT,
    contentTop + ribbonRackHeight,
    panelLeft + (panelWidth - medalRackWidth) / 2,
  );

  const ribbonMarkup = ribbonPlacements
    .map(({ item, x, y, width, height }) => ribbonRectSvg(item, x, y, width, height))
    .join('\n');
  const medalMarkup = medalPlacements
    .map(({ item, x, y, width, height }) => {
      const dataUri = medalDataUris.get(medalAssetKey(item.metric, item.tier));
      if (!dataUri) return '';
      return `<g transform="translate(${x}, ${y})"><title>${escapeXml(item.label)}</title><image width="${width}" height="${height}" href="${dataUri}" /></g>`;
    })
    .join('\n');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sceneWidth}" height="${size}" viewBox="0 0 ${sceneWidth} ${size}">
    <rect x="0" y="0" width="${sceneWidth}" height="${size}" fill="#b7c4c7" />
    <image x="0" y="0" width="${sceneWidth}" height="${size}" href="${backgroundDataUri}" preserveAspectRatio="xMidYMid slice" />
    <image x="${portraitLeft}" y="${coatTop}" width="${coatWidth}" height="${coatHeight}" href="${uniformDataUri}" filter="${uniformFilter}" />
    <svg x="${headBoxLeft}" y="${headBoxTop}" width="${headBoxSize}" height="${headBoxSize}" viewBox="0 0 ${PADDED_VIEWBOX_SIZE} ${PADDED_VIEWBOX_SIZE}" style="filter: ${headFilter}">
      ${paddedHeadMarkup}
    </svg>
    ${ribbonMarkup}
    ${medalMarkup}
    <rect x="0.5" y="0.5" width="${sceneWidth - 1}" height="${size - 1}" fill="none" stroke="#000" stroke-width="1" />
  </svg>`;

  return { svg, width: sceneWidth, height: size };
};

export interface CertificateAssembleOptions extends CertificateOptions {
  portraitFragment: { svg: string; width: number; height: number };
}

/** Baseball-card-style summary of a Service Record: the full composited
 * portrait (background, uniform, head, medal rack - identical to the one
 * shown in the dialog), a name/rank header, and a condensed stat line per
 * metric. Pure string-building so it can be rasterized via svgToPngBytes
 * without any further DOM dependency. */
export const buildCertificateSvg = (options: CertificateAssembleOptions): string => {
  const margin = 60;
  const portraitWidth = CERTIFICATE_WIDTH - margin * 2;
  const portraitScale = portraitWidth / options.portraitFragment.width;
  const portraitHeight = options.portraitFragment.height * portraitScale;
  const portraitTop = 80;
  const portraitBottom = portraitTop + portraitHeight;

  const nameY = portraitBottom + 50;
  const commissionY = nameY + 32;
  const serviceSinceY = commissionY + 26;
  const dividerY = serviceSinceY + 25;
  const statsStartY = dividerY + 34;
  const statsLineHeight = 30;
  const footerY = CERTIFICATE_HEIGHT - 30;

  const metricLines = options.metrics
    .map(
      (metric, index) =>
        `<text x="${CERTIFICATE_WIDTH / 2}" y="${statsStartY + index * statsLineHeight}" text-anchor="middle" font-family="Georgia, serif" font-size="19" fill="#d7dee8">${escapeXml(metric.label)}: ${metric.value.toLocaleString()}</text>`,
    )
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CERTIFICATE_WIDTH}" height="${CERTIFICATE_HEIGHT}" viewBox="0 0 ${CERTIFICATE_WIDTH} ${CERTIFICATE_HEIGHT}">
  <rect x="0" y="0" width="${CERTIFICATE_WIDTH}" height="${CERTIFICATE_HEIGHT}" rx="18" fill="#16233a" />
  <rect x="10" y="10" width="${CERTIFICATE_WIDTH - 20}" height="${CERTIFICATE_HEIGHT - 20}" rx="12" fill="none" stroke="#d4af37" stroke-width="3" />
  <text x="${CERTIFICATE_WIDTH / 2}" y="55" text-anchor="middle" font-family="Georgia, serif" font-size="22" letter-spacing="4" fill="#d4af37">LJB SERVICE RECORD</text>
  <g transform="translate(${margin}, ${portraitTop}) scale(${portraitScale})">
    ${options.portraitFragment.svg}
  </g>
  <text x="${CERTIFICATE_WIDTH / 2}" y="${nameY}" text-anchor="middle" font-family="Georgia, serif" font-size="32" font-weight="bold" fill="#f2ede2">${escapeXml(options.encoderName)}</text>
  <text x="${CERTIFICATE_WIDTH / 2}" y="${commissionY}" text-anchor="middle" font-family="Georgia, serif" font-size="19" fill="#c8b98a">${escapeXml(options.commission ?? 'Unranked. The corpus awaits.')}</text>
  <text x="${CERTIFICATE_WIDTH / 2}" y="${serviceSinceY}" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#8b93a6">In service since ${escapeXml(options.serviceSince)}</text>
  <line x1="60" y1="${dividerY}" x2="${CERTIFICATE_WIDTH - 60}" y2="${dividerY}" stroke="#3a4a63" stroke-width="1" />
  ${metricLines}
  <text x="${CERTIFICATE_WIDTH / 2}" y="${statsStartY + options.metrics.length * statsLineHeight + 20}" text-anchor="middle" font-family="Georgia, serif" font-size="15" fill="#8b93a6">${options.unlockedCount} / ${options.totalAchievements} achievements</text>
  <text x="${CERTIFICATE_WIDTH / 2}" y="${footerY}" text-anchor="middle" font-family="Georgia, serif" font-size="12" fill="#5b6579">Le Jean-Baptiste — printed ${escapeXml(new Date().toLocaleDateString())}</text>
</svg>`;
};

/** Rasterizes an SVG string to PNG bytes via a data: URI (same-origin, so
 * no canvas-tainting) - the only image references it resolves are the
 * base64 data: URIs already inlined by buildPortraitFragment. */
export const svgToPngBytes = (
  svgMarkup: string,
  width: number,
  height: number,
): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('2d canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('canvas.toBlob returned null'));
            return;
          }
          void blob
            .arrayBuffer()
            .then((buffer) => resolve(new Uint8Array(buffer)))
            .catch(reject);
        }, 'image/png');
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    img.onerror = () => reject(new Error('failed to rasterize certificate SVG'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
  });
