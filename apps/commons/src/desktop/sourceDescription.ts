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
    .map((el) => ({
      name: el.textContent?.trim() ?? '',
      ref: el.getAttribute('ref') ?? undefined,
      key: el.getAttribute('key') ?? undefined,
    }))
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
    const imprintDate = childNS(monogr, 'imprint')
      ? childNS(childNS(monogr, 'imprint')!, 'date')
      : null;
    result.editionDate =
      imprintDate?.getAttribute('when') ?? imprintDate?.textContent?.trim() ?? '';
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
  if (date.when?.trim()) {
    dateEl.setAttribute('when', normalizeTeiDateValue(date.when));
  } else {
    if (date.notBefore?.trim()) dateEl.setAttribute('notBefore', normalizeTeiDateValue(date.notBefore));
    if (date.notAfter?.trim()) dateEl.setAttribute('notAfter', normalizeTeiDateValue(date.notAfter));
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
    imprintDate.setAttribute('when', normalizeTeiDateValue(editionYear));
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
