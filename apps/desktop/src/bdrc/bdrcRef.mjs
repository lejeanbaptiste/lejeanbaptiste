/**
 * Parse whatever the user (or the browser extension) hands us into a BDRC
 * *paginated* etext id (`UT<n>_I<imagegroup>_0000`).
 *
 * Accepts:
 *   UT4CZ5369_I1KG9127_0000
 *   bdr:UT4CZ5369_I1KG9127_0000
 *   VE4CZ5369_I1KG9127                       (volume id — derive UT…_0000)
 *   http(s)://purl.bdrc.io/resource/UT4CZ5369_I1KG9127_0000(.ttl)
 *   https://library.bdrc.io/show/bdr:IE4CZ5369?openEtext=bdr:VE4CZ5369_I1KG9127&startChar=…
 *
 * The BUDA reader URL carries `openEtext=bdr:VE<n>_I<ig>`; the retrievable
 * transcription is `UT<n>_I<ig>_0000` (`EtextPaginated`, has content + a git
 * revision). The `VE…volumeHasEtext…` targets are empty structural nodes and
 * are ignored. Confirmed live 2026-08-31 — docs/bdrc-import-planning.md §2.2.
 *
 * A work/instance ref (`MW…`, `W…`, `WA…`) or an `IE…` with no `openEtext` is
 * rejected with guidance — the import unit is one volume.
 */

const UT_RE = /\bUT[0-9A-Za-z_]+/;
const VE_RE = /\bVE([0-9A-Za-z]+_I[0-9A-Za-z]+)/;
const OPEN_ETEXT_RE = /[?&]openEtext=(?:bdr:)?(VE[0-9A-Za-z_]+|UT[0-9A-Za-z_]+)/i;
const OTHER_RE = /\bbdr:((?:MW|WA|W|IE)[0-9A-Za-z_]+)/;

/** `VE<n>_I<ig>` (or its tail) → `UT<n>_I<ig>_0000`. */
const veToUt = (veTail) => `UT${veTail}_0000`;

/**
 * @param {string} input
 * @returns {{ utId: string, from: 'ut' | 've', sourceId: string }}
 *   `utId` is the paginated etext to fetch; `sourceId` is the raw id matched
 *   (a `VE…` when `from === 've'`), kept so a caller can fall back to it if the
 *   `_0000` derivation turns out to have no content.
 */
export function parseBdrcRef(input) {
  const raw = String(input ?? '').trim();
  if (!raw) throw new Error('Paste a BDRC etext id or a purl.bdrc.io / library.bdrc.io URL.');

  // Reader URL: pull the openEtext param first (it names the volume being read).
  const open = raw.match(OPEN_ETEXT_RE);
  if (open) {
    const id = open[1];
    if (/^UT/i.test(id)) return { utId: id, from: 'ut', sourceId: id };
    const ve = id.match(/^VE([0-9A-Za-z_]+)/i);
    if (ve) return { utId: veToUt(ve[1]), from: 've', sourceId: id };
  }

  const ut = raw.match(UT_RE);
  if (ut) return { utId: ut[0], from: 'ut', sourceId: ut[0] };

  const ve = raw.match(VE_RE);
  if (ve) return { utId: veToUt(ve[1]), from: 've', sourceId: `VE${ve[1]}` };

  const other = raw.match(OTHER_RE);
  if (other) {
    throw new Error(
      `${other[1]} is a work/instance, not an etext volume. Open its etext reader on ` +
        `library.bdrc.io and copy the URL (or use the browser extension).`,
    );
  }

  throw new Error(`Not a recognisable BDRC etext reference: ${raw.slice(0, 80)}`);
}

/** Best-effort: is this string plausibly a BDRC ref at all? (for enabling the button) */
export function looksLikeBdrcRef(input) {
  const raw = String(input ?? '');
  return UT_RE.test(raw) || VE_RE.test(raw) || OPEN_ETEXT_RE.test(raw) || /bdrc\.io/.test(raw);
}
