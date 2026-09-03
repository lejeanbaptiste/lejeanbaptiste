import { buildSkeletonForCatalog } from './schemaTemplates';
import { cbetaFamilyBodyFragment } from './cbetaFamilyMarkup';
import type { ProjectFileConfig } from './projectTypes';

export interface WikisourceAuthorMeta {
  qid?: string;
  name: string;
}

export interface WikisourceTeiMeta {
  title: string;
  workTitle: string;
  pageTitle: string;
  url: string;
  qid?: string | null;
  ctextWorkId?: string | null;
  publicationDate?: string | null;
  authors: WikisourceAuthorMeta[];
  headerCredit?: string | null;
  extractionNote?: string | null;
}

const escapeXmlText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeXmlAttr = (value: string): string => escapeXmlText(value).replace(/"/g, '&quot;');

const isoDate = (d = new Date()): string => d.toISOString().slice(0, 10);

const authorBlocks = (meta: WikisourceTeiMeta, cbetaFamily = false): string => {
  if (!meta.authors.length) return '';
  return meta.authors
    .map((row) => {
      const name = escapeXmlText(row.name);
      const qid = (row.qid ?? '').trim();
      // CBETA P5 carries the Wikidata id as a full `@ref` URI (as the CBETA /
      // Kanripo / Daozang importers do); TEI-ALL keeps the bare `@n` id.
      const attr = qid
        ? cbetaFamily
          ? ` ref="https://www.wikidata.org/entity/${escapeXmlAttr(qid)}"`
          : ` n="${escapeXmlAttr(qid)}"`
        : '';
      return name ? `      <author${attr}>${name}</author>` : '';
    })
    .filter(Boolean)
    .join('\n');
};

export const wrapWikisourceTeiDocument = ({
  config,
  meta,
  bodyXml,
  importedAt,
}: {
  config: ProjectFileConfig;
  meta: WikisourceTeiMeta;
  bodyXml: string;
  importedAt?: Date;
}): string => {
  const catalogId = config.schema?.catalogId ?? '';
  if (catalogId === 'orlando' || catalogId === 'jTei') {
    throw new Error('Wikisource import currently supports TEI projects (not Orlando or jTEI).');
  }
  // CBETA P5's divisions reject a CJK `@n` and its authors want `@ref` rather
  // than `@n` — those stay catalog-specific below. `<sourceDesc>` itself does
  // not: every catalog here (like every other importer's sourceDesc — see
  // bdrcImportXml.ts) wraps its bibliographic facts in a single `<bibl>`.
  // `sourceDesc/p` mixed with bare `<idno>`/`<note>` siblings, which this
  // used to emit for non-CBETA targets, is not a valid `sourceDesc` — and
  // this app's own Source Description sync (sourceDescription.ts) only
  // recognizes bibliographic notes nested inside `<bibl>`/`<biblStruct>`
  // anyway, so a bare sibling `<note>` was also getting orphaned on the next
  // metadata edit (confirmed 2026-09-03: a real import left a stray
  // `<note type="wikisource-header">` sibling after the Source Description
  // panel rewrote `<p>` into `<biblStruct>`).
  const isCbetaFamily = catalogId === 'cbeta';

  const title = escapeXmlText(meta.title || meta.pageTitle || meta.workTitle || 'Untitled');
  const when = isoDate(importedAt);
  const authors = authorBlocks(meta, isCbetaFamily);
  let xml = buildSkeletonForCatalog(config);

  xml = xml.replace(
    /<titleStmt>\s*<title>[\s\S]*?<\/title>\s*<\/titleStmt>/,
    `<titleStmt>\n      <title>${title}</title>\n${authors}\n    </titleStmt>`,
  );

  const biblKids = [
    meta.url ? `<ptr target="${escapeXmlAttr(meta.url)}"/>` : '',
    meta.qid
      ? `<idno type="URI">https://www.wikidata.org/entity/${escapeXmlText(meta.qid)}</idno>`
      : '',
    meta.ctextWorkId ? `<idno type="CTP">${escapeXmlText(meta.ctextWorkId)}</idno>` : '',
    meta.publicationDate
      ? `<note type="pubDate">Wikidata P577: ${escapeXmlText(meta.publicationDate)}</note>`
      : '',
    meta.headerCredit
      ? `<note type="wikisource-header">${escapeXmlText(meta.headerCredit)}</note>`
      : '',
    meta.extractionNote
      ? `<note type="extraction">${escapeXmlText(meta.extractionNote)}</note>`
      : '',
  ].filter(Boolean);
  xml = xml.replace(
    /<sourceDesc>[\s\S]*?<\/sourceDesc>/,
    `<sourceDesc>\n      <bibl>Imported from Wikisource (${escapeXmlText(meta.workTitle)}).${
      biblKids.length ? `\n      ${biblKids.join('\n      ')}\n      ` : ' '
    }</bibl>\n    </sourceDesc>`,
  );

  xml = xml.replace(
    /<\/teiHeader>/,
    `<revisionDesc>\n    <change when="${when}">Imported from Wikisource.</change>\n  </revisionDesc>\n</teiHeader>`,
  );

  const rawBody = bodyXml.trim() || '<p></p>';
  const inner = /<p[\s>]/.test(rawBody) ? rawBody : `<p>${rawBody}</p>`;
  // CBETA P5 wants a `<cb:div>` (not TEI `<div>`) with no `@n`; TEI keeps `<div>`.
  const division = isCbetaFamily
    ? cbetaFamilyBodyFragment(
        `<div type="text"><head>${escapeXmlText(meta.pageTitle)}</head>${inner}</div>`,
      )
    : `<div type="text">\n      <head>${escapeXmlText(meta.pageTitle)}</head>\n      ${inner}\n    </div>`;
  xml = xml.replace(/<div type="text">[\s\S]*?<\/div>/, division);

  return xml;
};

const joinPath = (...parts: string[]): string =>
  parts.filter(Boolean).join('/').replace(/\/+/g, '/');

export const uniqueWikisourceXmlPath = (
  destinationDir: string,
  stem: string,
  used: Set<string>,
): string => {
  const safeStem = stem.replace(/[\\/]/g, '_') || 'untitled';
  let outputPath = joinPath(destinationDir, `${safeStem}.xml`);
  let suffix = 2;
  while (used.has(outputPath.replace(/\\/g, '/'))) {
    outputPath = joinPath(destinationDir, `${safeStem}-${suffix}.xml`);
    suffix += 1;
  }
  used.add(outputPath.replace(/\\/g, '/'));
  return outputPath;
};
