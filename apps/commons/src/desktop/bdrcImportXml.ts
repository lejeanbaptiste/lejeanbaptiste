import { buildSkeletonForCatalog } from './schemaTemplates';
import { cbetaFamilyBodyFragment, cbetaFamilyTitleStmt } from './cbetaFamilyMarkup';
import type { ProjectFileConfig } from './projectTypes';

/** Shape returned by `apps/desktop/src/bdrc/etextToTei.mjs#etextHeaderFields`. */
export interface BdrcHeaderFields {
  title: string;
  altTitles: { text: string; lang?: string }[];
  lang: string;
  creators: { name: string; ref?: string; role: string; lang?: string }[];
  idno: { type: string; value: string }[];
  sourceUri: string;
  /** BUDA reader URL the import was launched from, when the user pasted one. */
  readerUrl?: string;
  /** BDRC edition statement (often Tibetan), verbatim. */
  edition?: string;
  editionLang?: string;
  /** Publication year, ISO — only present when BDRC carries a clean 4-digit year. */
  editionDate?: { when?: string; notBefore?: string; notAfter?: string } | null;
  publisher?: string;
  pubPlace?: string;
  availabilityStatus: string;
  accessTier: string | null;
  attribution: string | null;
  transcriptionMethod: string;
  reviewNeeded: boolean;
  provenance: Record<string, string>;
}

const escapeXmlText = (value: string): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const escapeXmlAttr = (value: string): string => escapeXmlText(value).replace(/"/g, '&quot;');

const isoDate = (d = new Date()): string => d.toISOString().slice(0, 10);

const titleStmtBlock = (fields: BdrcHeaderFields): string => {
  const lines: string[] = [
    `      <title xml:lang="${escapeXmlAttr(fields.lang)}">${escapeXmlText(fields.title || 'Untitled')}</title>`,
  ];
  for (const alt of fields.altTitles ?? []) {
    if (!alt?.text) continue;
    const lang = alt.lang ? ` xml:lang="${escapeXmlAttr(alt.lang)}"` : '';
    lines.push(`      <title type="alt"${lang}>${escapeXmlText(alt.text)}</title>`);
  }
  for (const c of fields.creators ?? []) {
    if (!c?.name) continue;
    const ref = c.ref ? ` ref="${escapeXmlAttr(c.ref)}"` : '';
    if (c.role === 'author') {
      lines.push(`      <author${ref}>${escapeXmlText(c.name)}</author>`);
    } else {
      lines.push(
        `      <respStmt><resp>${escapeXmlText(c.role || 'contributor')}</resp>` +
          `<name${ref}>${escapeXmlText(c.name)}</name></respStmt>`,
      );
    }
  }
  return `<titleStmt>\n${lines.join('\n')}\n    </titleStmt>`;
};

const publicationStmtBlock = (fields: BdrcHeaderFields): string => {
  const status = escapeXmlAttr(fields.availabilityStatus || 'unknown');
  const tier = fields.accessTier ? ` n="${escapeXmlAttr(fields.accessTier)}"` : '';
  const credit = fields.attribution
    ? `<p>${escapeXmlText(fields.attribution)}</p>`
    : '<p>Buddhist Digital Resource Center (BDRC)</p>';
  return (
    `<publicationStmt>\n` +
    `      <distributor>Buddhist Digital Resource Center</distributor>\n` +
    `      <availability status="${status}"${tier}>${credit}</availability>\n` +
    `    </publicationStmt>`
  );
};

const editionDateEl = (date: BdrcHeaderFields['editionDate']): string => {
  if (!date) return '';
  if (date.when) {
    return `        <date when="${escapeXmlAttr(date.when)}">${escapeXmlText(date.when)}</date>`;
  }
  const { notBefore, notAfter } = date;
  if (!notBefore && !notAfter) return '';
  const attrs =
    (notBefore ? ` notBefore="${escapeXmlAttr(notBefore)}"` : '') +
    (notAfter ? ` notAfter="${escapeXmlAttr(notAfter)}"` : '');
  const label = [notBefore, notAfter].filter(Boolean).join('–');
  return `        <date${attrs}>${escapeXmlText(label)}</date>`;
};

const sourceDescBlock = (fields: BdrcHeaderFields): string => {
  const rows: string[] = [
    `        <title xml:lang="${escapeXmlAttr(fields.lang)}">${escapeXmlText(fields.title || 'Untitled')}</title>`,
  ];

  if (fields.edition?.trim()) {
    const lang = fields.editionLang ? ` xml:lang="${escapeXmlAttr(fields.editionLang)}"` : '';
    rows.push(`        <edition${lang}>${escapeXmlText(fields.edition.trim())}</edition>`);
  }
  if (fields.pubPlace?.trim()) {
    rows.push(`        <pubPlace>${escapeXmlText(fields.pubPlace.trim())}</pubPlace>`);
  }
  if (fields.publisher?.trim()) {
    rows.push(`        <publisher>${escapeXmlText(fields.publisher.trim())}</publisher>`);
  }
  const dateEl = editionDateEl(fields.editionDate ?? null);
  if (dateEl) rows.push(dateEl);

  for (const i of fields.idno ?? []) {
    if (!i?.value) continue;
    rows.push(`        <idno type="${escapeXmlAttr(i.type)}">${escapeXmlText(i.value)}</idno>`);
  }

  // The transcription source: name BDRC explicitly and cite the URL it came
  // from (the reader URL the user opened, or the canonical resource purl).
  const srcUrl = (fields.readerUrl || fields.sourceUri || '').trim();
  const srcRef = srcUrl
    ? ` <ref target="${escapeXmlAttr(srcUrl)}">${escapeXmlText(srcUrl)}</ref>`
    : '';
  rows.push(
    `        <note type="source">Transcription from the Buddhist Digital Resource Center (BDRC).` +
      `${srcRef} Transcription method: ${escapeXmlText(fields.transcriptionMethod || 'unknown')}.</note>`,
  );

  return (
    `<sourceDesc>\n` +
    `      <bibl>\n` +
    `${rows.join('\n')}\n` +
    `      </bibl>\n` +
    `    </sourceDesc>`
  );
};

const revisionDescBlock = (fields: BdrcHeaderFields, when: string): string => {
  const p = fields.provenance ?? {};
  const bits = [
    `Imported BDRC etext volume ${p.utId ?? ''}`,
    p.instanceId ? `instance ${p.instanceId}` : '',
    p.volumeId ? `image group ${p.volumeId}` : '',
    `plugin bdrc-import ${p.importerVersion ?? ''}`,
    p.queryNames ? `PDI queries ${p.queryNames}` : '',
    p.fetchedAt ? `fetched ${p.fetchedAt}` : '',
    `transcription ${fields.transcriptionMethod}`,
  ].filter(Boolean);
  const review = fields.reviewNeeded ? ' OCR source — review recommended.' : '';
  return (
    `<revisionDesc>\n` +
    `    <change when="${escapeXmlAttr(when)}">${escapeXmlText(bits.join('; '))}.${review}</change>\n` +
    `  </revisionDesc>`
  );
};

/** Wrap a BDRC etext body fragment in the project TEI skeleton with provenance. */
export const wrapBdrcTeiDocument = ({
  config,
  headerFields,
  bodyXml,
  titleSuffix,
  importedAt,
}: {
  config: ProjectFileConfig;
  headerFields: BdrcHeaderFields;
  bodyXml: string;
  /** Appended to `<title>` for a split file, e.g. " — bam po 3". */
  titleSuffix?: string;
  importedAt?: Date;
}): string => {
  const catalogId = config.schema?.catalogId ?? '';
  if (catalogId === 'orlando' || catalogId === 'jTei') {
    throw new Error('BDRC import currently supports TEI projects (not Orlando or jTEI).');
  }
  // CBETA P5's `<div>` has no `<ab>` in its content model and its divisions
  // reject a CJK `@n`: map the folio `<ab>` blocks to `<p>` and drop any `@n`.
  // The TEI-ALL / TEI-Lite path keeps `<ab>` (a folio is a page, not a paragraph).
  const isCbetaFamily = catalogId === 'cbeta';

  const fields: BdrcHeaderFields = titleSuffix
    ? { ...headerFields, title: `${headerFields.title || 'Untitled'}${titleSuffix}` }
    : headerFields;

  const when = isoDate(importedAt);
  let xml = buildSkeletonForCatalog(config);

  xml = xml.replace(
    /<titleStmt>\s*<title>[\s\S]*?<\/title>\s*<\/titleStmt>/,
    // CBETA P5 `<author>` takes no `@role` and `<title>` no `@type`.
    isCbetaFamily ? cbetaFamilyTitleStmt(titleStmtBlock(fields)) : titleStmtBlock(fields),
  );
  xml = xml.replace(
    /<publicationStmt>[\s\S]*?<\/publicationStmt>/,
    publicationStmtBlock(headerFields),
  );
  xml = xml.replace(/<sourceDesc>[\s\S]*?<\/sourceDesc>/, sourceDescBlock(headerFields));
  xml = xml.replace(/<\/teiHeader>/, `${revisionDescBlock(headerFields, when)}\n</teiHeader>`);

  const lang = escapeXmlAttr(headerFields.lang || 'bo');
  xml = xml.replace(/<text>/, `<text xml:lang="${lang}">`);

  const body = bodyXml.trim();
  let bodyContent = /^<div[\s>]/.test(body) ? body : `<div type="text">${body || '<p></p>'}</div>`;
  // CBETA P5: TEI `<div>` → `<cb:div>`, `<ab>` folios → `<p>`, drop division `@n`.
  if (isCbetaFamily) bodyContent = cbetaFamilyBodyFragment(bodyContent);
  xml = xml.replace(/<div type="text">[\s\S]*?<\/div>/, bodyContent);

  return xml;
};

const joinPath = (...parts: string[]): string =>
  parts.filter(Boolean).join('/').replace(/\/+/g, '/');

/** Unique `imported/bdrc/<instance>/<UT>.xml` path, `-2` suffixes like document import. */
export const uniqueBdrcXmlPath = (
  destinationDir: string,
  stem: string,
  used: Set<string>,
): string => {
  const safeStem = String(stem || 'etext').replace(/[\\/]/g, '_');
  let outputPath = joinPath(destinationDir, `${safeStem}.xml`);
  let suffix = 2;
  while (used.has(outputPath.replace(/\\/g, '/'))) {
    outputPath = joinPath(destinationDir, `${safeStem}-${suffix}.xml`);
    suffix += 1;
  }
  used.add(outputPath.replace(/\\/g, '/'));
  return outputPath;
};
