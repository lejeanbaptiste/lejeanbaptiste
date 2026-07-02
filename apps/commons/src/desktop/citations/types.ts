/** A CSL-JSON item as returned by Zotero. Kept intentionally loose: we store the
 * snapshot verbatim so a future export tool can reconstitute the citation; only the
 * fields we read for display are typed. */
export interface CslJsonItem {
  id: string | number;
  type: string;
  title?: string;
  author?: { family?: string; given?: string; literal?: string }[];
  issued?: { 'date-parts'?: (string | number)[][]; literal?: string };
  [key: string]: unknown;
}

/** A bibliography entry stored in the companion file's standOff listBibl. */
export interface BiblEntry {
  /** xml:id of the <bibl> entry, e.g. `zbib-ABCD1234`. */
  id: string;
  /** Canonical Zotero item URI (stored on @corresp). */
  uri: string;
  /** The CSL-JSON snapshot taken from Zotero at insertion time. */
  csl: CslJsonItem;
}

/** A citation reference found inside footnote content (<bibl type="zotero-ref">). */
export interface CitationRef {
  /** The standOff entry id this reference points to (without the leading `#`). */
  biblId: string;
  locator?: string;
  locatorType?: string;
  prefix?: string;
  suffix?: string;
  element: Element;
}
