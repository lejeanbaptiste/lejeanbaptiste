/**
 * CBETA canon letter → source edition, for the per-file metadata header.
 *
 * A CBETA work id (`T01n0001`, `X01n0001`, `JB122n…`) begins with a canon code
 * that fully identifies the printed edition the text was collated from; the
 * CBETA file itself carries nothing more specific than a "Taisho Vol. N, No. N"
 * bibl line. The importer maps that code here to fill `<edition>` and
 * `<imprint><date>` in the working file.
 *
 * `editionDate` is the human display form — a single year or a `YYYY–YYYY`
 * span — passed through `editionDateAttrs` so the emitted `<date>` carries
 * machine-readable `@when` or `@from`/`@to` years, matching what the metadata
 * panel would write for the same text.
 *
 * Names follow DILA's `canons.json` (cbeta-org/xml-p5); dates are the
 * conventional printing spans. Codes absent here — modern compilations and
 * reprints such as A (中華大藏經), C, D, F (房山石經, a stone corpus), G, GA,
 * GB, I, ZS — get no auto-filled edition and can be added as their dates are
 * pinned down.
 */
export interface CbetaCanonEdition {
  /** `<edition>` text: canon name, Chinese followed by a romanisation. */
  edition: string;
  /** Display form for `<imprint><date>`: `"1924–1934"` or `"1735"`. */
  editionDate: string;
}

export const CBETA_CANON_EDITIONS: Record<string, CbetaCanonEdition> = {
  T: { edition: '大正新脩大藏經 (Taishō Shinshū Daizōkyō)', editionDate: '1924–1934' },
  // Shinsan reprint of the 卍續藏 (originally Kyoto, 1905–1912).
  X: { edition: '卍新纂大日本續藏經 (Manji Shinsan Dai Nihon Zokuzōkyō)', editionDate: '1975–1989' },
  // Jiaxing / Jingshan Canon 徑山藏; compilation begun 1589, printing into the Qing.
  J: { edition: '明版嘉興大藏經 (Jiaxing Canon)', editionDate: '1589–1712' },
  L: { edition: '乾隆大藏經 (Qianlong Canon / 龍藏)', editionDate: '1733–1738' },
  // Second carving of the Tripiṭaka Koreana.
  K: { edition: '高麗大藏經 (Tripiṭaka Koreana)', editionDate: '1236–1251' },
  M: { edition: '卍正藏經 (Manji Zōkyō)', editionDate: '1902–1905' },
  P: { edition: '永樂北藏 (Yongle Northern Canon)', editionDate: '1419–1440' },
  S: { edition: '宋藏遺珍 (Song Canon Fragments)', editionDate: '1935' },
  U: { edition: '洪武南藏 (Hongwu Southern Canon)', editionDate: '1372–1398' },
  N: { edition: '漢譯南傳大藏經 (元亨寺版) (Chinese Translation of the Pāli Canon)', editionDate: '1990–1998' },
  B: { edition: '大藏經補編 (Supplement to the Canon)', editionDate: '1985' },
};

/** Canon code (any case) → edition, or `undefined` when it has no entry. */
export const cbetaCanonEdition = (canon?: string | null): CbetaCanonEdition | undefined => {
  const key = (canon ?? '').trim().toUpperCase();
  return key ? CBETA_CANON_EDITIONS[key] : undefined;
};
