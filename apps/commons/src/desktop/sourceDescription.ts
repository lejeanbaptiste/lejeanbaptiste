import { findTeiHeader, TEI_NS } from './teiHeaderXml';

/**
 * Structured TEI source description for the per-file metadata panel.
 *
 * Mapping (TEI P5 standard practice):
 * - Book title      → fileDesc/titleStmt/title AND sourceDesc/biblStruct/monogr/title
 * - Authors         → fileDesc/titleStmt/author[@ref] AND monogr/author[@ref]
 * - Year (work)     → profileDesc/creation/date[@when | @notBefore/@notAfter]
 * - Edition         → sourceDesc/biblStruct/monogr/edition
 * - Year of edition → sourceDesc/biblStruct/monogr/imprint/date[@when]
 * - Transcription source (free text) → sourceDesc/biblStruct/note
 *
 * Legacy files store free-text source in sourceDesc/p; it is read as the
 * transcription source and migrated into biblStruct/note on the next apply.
 */

export interface SourceAuthor {
  name: string;
  /** Authority URI (Wikidata/VIAF/…) carried on author/@ref. */
  ref?: string;
  /** Local-only entities.xml id (bare, e.g. "person-000100"), carried on author/@key. */
  key?: string;
}

export interface SourceWorkDate {
  /** Exact year — mutually exclusive with notBefore/notAfter. */
  when?: string;
  notBefore?: string;
  notAfter?: string;
}

export interface SourceDescription {
  title: string;
  /** Authority URI (Wikidata/VIAF/…) carried on title/@ref. */
  titleRef?: string;
  /** Local-only entities.xml id (bare, e.g. "work-000010"), carried on title/@key. */
  titleKey?: string;
  authors: SourceAuthor[];
  workDate: SourceWorkDate;
  edition: string;
  editionDate: string;
  sourceNote: string;
}

export const emptySourceDescription = (): SourceDescription => ({
  title: '',
  titleRef: undefined,
  titleKey: undefined,
  authors: [],
  workDate: {},
  edition: '',
  editionDate: '',
  sourceNote: '',
});

const childNS = (parent: Element, localName: string): Element | null => {
  for (const child of Array.from(parent.children)) {
    if (child.localName === localName) return child;
  }
  return null;
};

const childrenNS = (parent: Element, localName: string): Element[] =>
  Array.from(parent.children).filter((child) => child.localName === localName);

const descendantNS = (root: Element, localName: string): Element | null =>
  root.getElementsByTagNameNS(TEI_NS, localName)[0] ??
  root.getElementsByTagName(localName)[0] ??
  null;

const readAuthors = (parent: Element): SourceAuthor[] =>
  childrenNS(parent, 'author')
    .map((el) => {
      const name = el.textContent?.trim() ?? '';
      let ref = el.getAttribute('ref') ?? undefined;
      const key = el.getAttribute('key') ?? undefined;
      if (!ref && !key) {
        const legacyN = (el.getAttribute('n') ?? '').trim();
        if (/^\d+$/.test(legacyN)) {
          ref = `NORBERT:person-${legacyN}`;
        } else {
          const wikidataRef = legacyN.match(/^(?:Q\d+|https?:\/\/.*)$/i) ? legacyN : '';
          if (wikidataRef.startsWith('http')) ref = wikidataRef;
          else if (/^Q\d+$/i.test(wikidataRef)) {
            ref = `https://www.wikidata.org/entity/${wikidataRef.toUpperCase()}`;
          }
        }
      }
      return { name, ref, key };
    })
    .filter((author) => author.name);

export const readSourceDescription = (header: Element): SourceDescription => {
  const result = emptySourceDescription();

  const fileDesc = descendantNS(header, 'fileDesc');
  const titleStmt = fileDesc ? childNS(fileDesc, 'titleStmt') : null;
  const sourceDesc = fileDesc ? childNS(fileDesc, 'sourceDesc') : null;
  const biblStruct = sourceDesc ? childNS(sourceDesc, 'biblStruct') : null;
  const monogr = biblStruct ? childNS(biblStruct, 'monogr') : null;

  const titleStmtTitle = titleStmt?.getElementsByTagNameNS(TEI_NS, 'title')[0];
  const monogrTitle = monogr ? childNS(monogr, 'title') : null;
  const titleEl = titleStmtTitle ?? monogrTitle;

  result.title = titleEl?.textContent?.trim() ?? '';
  result.titleRef = titleEl?.getAttribute('ref') ?? undefined;
  result.titleKey = titleEl?.getAttribute('key') ?? undefined;

  const titleAuthors = titleStmt ? readAuthors(titleStmt) : [];
  result.authors = titleAuthors.length > 0 ? titleAuthors : monogr ? readAuthors(monogr) : [];

  const profileDesc = descendantNS(header, 'profileDesc');
  const creation = profileDesc ? childNS(profileDesc, 'creation') : null;
  const creationDate = creation ? childNS(creation, 'date') : null;
  if (creationDate) {
    const when = creationDate.getAttribute('when') ?? '';
    const notBefore = creationDate.getAttribute('notBefore') ?? '';
    const notAfter = creationDate.getAttribute('notAfter') ?? '';
    if (notBefore || notAfter) {
      result.workDate = { notBefore: notBefore || undefined, notAfter: notAfter || undefined };
    } else if (when || creationDate.textContent?.trim()) {
      result.workDate = { when: when || creationDate.textContent?.trim() };
    }
  }

  if (monogr) {
    result.edition = childNS(monogr, 'edition')?.textContent?.trim() ?? '';
    const imprint = childNS(monogr, 'imprint');
    const imprintDate = imprint ? childNS(imprint, 'date') : null;
    result.editionDate = imprintDate ? readEditionDate(imprintDate) : '';
  }

  if (biblStruct) {
    result.sourceNote = childNS(biblStruct, 'note')?.textContent?.trim() ?? '';
  } else if (sourceDesc) {
    // Legacy free-text source in sourceDesc/p.
    result.sourceNote = childNS(sourceDesc, 'p')?.textContent?.trim() ?? '';
  }

  return result;
};

const removeChildrenNS = (parent: Element, localName: string) => {
  for (const el of childrenNS(parent, localName)) {
    parent.removeChild(el);
  }
};

const makeAuthorElement = (doc: Document, author: SourceAuthor): Element => {
  const el = doc.createElementNS(TEI_NS, 'author');
  el.textContent = author.name;
  if (author.ref?.trim()) el.setAttribute('ref', author.ref.trim());
  else if (author.key?.trim()) el.setAttribute('key', author.key.trim());
  return el;
};

/**
 * TEI date attributes (@when/@notBefore/@notAfter) use W3C datatypes: years
 * must be zero-padded to 4 digits ("526" → "0526", "-52-03" → "-0052-03").
 * Values that aren't year-led dates are returned untouched.
 */
export const normalizeTeiDateValue = (value: string): string => {
  const match = value.trim().match(/^(-?)(\d{1,4})((?:-\d{2}){0,2})$/);
  if (!match) return value.trim();
  const [, sign, year, rest] = match;
  return `${sign}${year.padStart(4, '0')}${rest}`;
};

/**
 * TEI `@when` / `@notBefore` / `@notAfter` must be a W3C date literal. Return the
 * normalised value only when it qualifies; a human label like `乾隆47年` or
 * `唐` yields `''` so the caller can omit the attribute rather than emit an
 * invalid one.
 */
export const teiDateLiteral = (raw?: string | null): string => {
  const v = normalizeTeiDateValue((raw ?? '').trim());
  return /^-?\d{4}(-\d{2}){0,2}$/.test(v) ? v : '';
};

/** Unambiguous range separators: en/em dash, slash, or the word "to". */
const EDITION_RANGE_SEP = /^(.+?)\s*(?:–|—|\/|\bto\b)\s*(.+?)$/i;
/** Bare "YYYY-YYYY" — a hyphen only splits when both sides are plain years. */
const EDITION_RANGE_HYPHEN = /^(\d{3,4})\s*-\s*(\d{3,4})$/;

/**
 * Derive W3C-literal attributes for `imprint/date` from a free-text "year of
 * edition" field. A range ("1924–1934", "1924-1934", "1924/1934", "1924 to
 * 1934") yields `from`/`to` — the span an edition was printed over — a single
 * year yields `when`, and an unparseable label ("乾隆年間") yields nothing, so
 * the caller keeps the text as a human label without emitting an invalid date.
 * Endpoints are zero-padded to 4 digits like every other TEI date here.
 */
export const editionDateAttrs = (raw: string): { when?: string; from?: string; to?: string } => {
  const text = (raw ?? '').trim();
  if (!text) return {};

  const hyphen = text.match(EDITION_RANGE_HYPHEN);
  const parts = hyphen ?? text.match(EDITION_RANGE_SEP);
  if (parts) {
    const from = teiDateLiteral(parts[1]);
    const to = teiDateLiteral(parts[2]);
    if (from || to) return { from: from || undefined, to: to || undefined };
    return {};
  }

  const when = teiDateLiteral(text);
  return when ? { when } : {};
};

/**
 * Human-readable "year of edition" from an `imprint/date` element. Prefer the
 * element text the editor wrote; fall back to reconstructing it from the
 * attributes so importer output (`<date from="1924" to="1934"/>`) still reads
 * back cleanly. `@from`/`@to` and the legacy `@notBefore`/`@notAfter` are both
 * accepted for the range.
 */
const readEditionDate = (dateEl: Element): string => {
  const text = dateEl.textContent?.trim();
  if (text) return text;
  const when = dateEl.getAttribute('when')?.trim();
  if (when) return when;
  const from = (dateEl.getAttribute('from') ?? dateEl.getAttribute('notBefore'))?.trim();
  const to = (dateEl.getAttribute('to') ?? dateEl.getAttribute('notAfter'))?.trim();
  if (from && to) return `${from}–${to}`;
  return from || to || '';
};

const workDateLabel = (date: SourceWorkDate): string => {
  if (date.when?.trim()) return date.when.trim();
  const notBefore = date.notBefore?.trim() ?? '';
  const notAfter = date.notAfter?.trim() ?? '';
  if (notBefore && notAfter) return `${notBefore}–${notAfter}`;
  if (notBefore) return `after ${notBefore}`;
  if (notAfter) return `before ${notAfter}`;
  return '';
};

const hasWorkDate = (date: SourceWorkDate): boolean => Boolean(workDateLabel(date));

const ensureChild = (parent: Element, localName: string): Element => {
  const existing = childNS(parent, localName);
  if (existing) return existing;
  const el = parent.ownerDocument!.createElementNS(TEI_NS, localName);
  parent.appendChild(el);
  return el;
};

/** teiHeader child order per TEI P5 content model. */
const HEADER_CHILD_ORDER = ['fileDesc', 'encodingDesc', 'profileDesc', 'xenoData', 'revisionDesc'];

const ensureHeaderChild = (header: Element, localName: string): Element => {
  const existing = childNS(header, localName);
  if (existing) return existing;
  const el = header.ownerDocument!.createElementNS(TEI_NS, localName);
  const selfIndex = HEADER_CHILD_ORDER.indexOf(localName);
  let before: Element | null = null;
  for (const child of Array.from(header.children)) {
    const index = HEADER_CHILD_ORDER.indexOf(child.localName);
    if (index > selfIndex) {
      before = child;
      break;
    }
  }
  header.insertBefore(el, before);
  return el;
};

const applyTitleRefKey = (title: Element, data: SourceDescription) => {
  title.removeAttribute('ref');
  title.removeAttribute('key');
  if (data.titleRef?.trim()) title.setAttribute('ref', data.titleRef.trim());
  else if (data.titleKey?.trim()) title.setAttribute('key', data.titleKey.trim());
};

const applyTitleStmt = (fileDesc: Element, data: SourceDescription) => {
  const doc = fileDesc.ownerDocument!;
  const titleStmt = ensureChild(fileDesc, 'titleStmt');

  let title = childNS(titleStmt, 'title');
  if (!title) {
    title = doc.createElementNS(TEI_NS, 'title');
    titleStmt.insertBefore(title, titleStmt.firstChild);
  }
  title.textContent = data.title;
  applyTitleRefKey(title, data);

  removeChildrenNS(titleStmt, 'author');
  const anchor: Node | null = title.nextSibling;
  for (const author of data.authors) {
    titleStmt.insertBefore(makeAuthorElement(doc, author), anchor);
  }
};

const applyCreationDate = (header: Element, date: SourceWorkDate) => {
  const doc = header.ownerDocument!;
  const existingProfileDesc = childNS(header, 'profileDesc');

  if (!hasWorkDate(date)) {
    const creation = existingProfileDesc ? childNS(existingProfileDesc, 'creation') : null;
    if (creation) {
      const dateEl = childNS(creation, 'date');
      if (dateEl) creation.removeChild(dateEl);
      if (creation.children.length === 0 && !creation.textContent?.trim()) {
        existingProfileDesc!.removeChild(creation);
      }
      if (existingProfileDesc!.children.length === 0) {
        header.removeChild(existingProfileDesc!);
      }
    }
    return;
  }

  const profileDesc = ensureHeaderChild(header, 'profileDesc');
  // creation must precede langUsage in profileDesc.
  let creation = childNS(profileDesc, 'creation');
  if (!creation) {
    creation = doc.createElementNS(TEI_NS, 'creation');
    profileDesc.insertBefore(creation, profileDesc.firstChild);
  }
  const dateEl = ensureChild(creation, 'date');
  dateEl.removeAttribute('when');
  dateEl.removeAttribute('notBefore');
  dateEl.removeAttribute('notAfter');
  const whenLit = teiDateLiteral(date.when);
  if (whenLit) {
    dateEl.setAttribute('when', whenLit);
  } else {
    const nbLit = teiDateLiteral(date.notBefore);
    const naLit = teiDateLiteral(date.notAfter);
    if (nbLit) dateEl.setAttribute('notBefore', nbLit);
    if (naLit) dateEl.setAttribute('notAfter', naLit);
  }
  dateEl.textContent = workDateLabel(date);
};

const hasBiblContent = (data: SourceDescription): boolean =>
  Boolean(
    data.title.trim() ||
    data.authors.length > 0 ||
    data.edition.trim() ||
    data.editionDate.trim() ||
    data.sourceNote.trim(),
  );

const applySourceDesc = (fileDesc: Element, data: SourceDescription) => {
  const doc = fileDesc.ownerDocument!;
  const sourceDesc = ensureChild(fileDesc, 'sourceDesc');

  if (!hasBiblContent(data)) {
    removeChildrenNS(sourceDesc, 'biblStruct');
    if (sourceDesc.children.length === 0) {
      // sourceDesc cannot be empty — keep a valid empty <p/>.
      sourceDesc.appendChild(doc.createElementNS(TEI_NS, 'p'));
    }
    return;
  }

  // biblStruct and p cannot coexist in sourceDesc; legacy p text moves to the note.
  removeChildrenNS(sourceDesc, 'p');

  let biblStruct = childNS(sourceDesc, 'biblStruct');
  if (!biblStruct) {
    biblStruct = doc.createElementNS(TEI_NS, 'biblStruct');
    sourceDesc.insertBefore(biblStruct, sourceDesc.firstChild);
  }
  while (biblStruct.firstChild) biblStruct.removeChild(biblStruct.firstChild);

  const monogr = doc.createElementNS(TEI_NS, 'monogr');
  biblStruct.appendChild(monogr);

  for (const author of data.authors) {
    monogr.appendChild(makeAuthorElement(doc, author));
  }

  const title = doc.createElementNS(TEI_NS, 'title');
  title.textContent = data.title.trim();
  applyTitleRefKey(title, data);
  monogr.appendChild(title);

  if (data.edition.trim()) {
    const edition = doc.createElementNS(TEI_NS, 'edition');
    edition.textContent = data.edition.trim();
    monogr.appendChild(edition);
  }

  // imprint is required inside monogr; an empty <date/> keeps it valid.
  const imprint = doc.createElementNS(TEI_NS, 'imprint');
  const imprintDate = doc.createElementNS(TEI_NS, 'date');
  const editionYear = data.editionDate.trim();
  if (editionYear) {
    const attrs = editionDateAttrs(editionYear);
    if (attrs.when) imprintDate.setAttribute('when', attrs.when);
    if (attrs.from) imprintDate.setAttribute('from', attrs.from);
    if (attrs.to) imprintDate.setAttribute('to', attrs.to);
    imprintDate.textContent = editionYear;
  }
  imprint.appendChild(imprintDate);
  monogr.appendChild(imprint);

  if (data.sourceNote.trim()) {
    const note = doc.createElementNS(TEI_NS, 'note');
    note.textContent = data.sourceNote.trim();
    biblStruct.appendChild(note);
  }
};

export const applySourceDescription = (header: Element, data: SourceDescription) => {
  const fileDesc = ensureHeaderChild(header, 'fileDesc');
  applyTitleStmt(fileDesc, data);
  applySourceDesc(fileDesc, data);
  applyCreationDate(header, data.workDate);
};

export const readSourceDescriptionFromXml = (xml: string): SourceDescription => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) return emptySourceDescription();
  const header = findTeiHeader(doc);
  if (!header) return emptySourceDescription();
  return readSourceDescription(header);
};

export const applySourceDescriptionToXml = (xml: string, data: SourceDescription): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) return xml;
  const header = findTeiHeader(doc);
  if (!header) return xml;
  applySourceDescription(header, data);
  return new XMLSerializer().serializeToString(doc);
};
