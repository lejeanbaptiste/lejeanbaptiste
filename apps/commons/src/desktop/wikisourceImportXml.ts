import { buildSkeletonForCatalog } from './schemaTemplates';
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

const authorBlocks = (meta: WikisourceTeiMeta): string => {
  if (!meta.authors.length) return '';
  return meta.authors
    .map((row) => {
      const name = escapeXmlText(row.name);
      const qid = (row.qid ?? '').trim();
      const attr = qid ? ` n="${escapeXmlAttr(qid)}"` : '';
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

  const title = escapeXmlText(meta.title || meta.pageTitle || meta.workTitle || 'Untitled');
  const when = isoDate(importedAt);
  const authors = authorBlocks(meta);
  let xml = buildSkeletonForCatalog(config);

  xml = xml.replace(
    /<titleStmt>\s*<title>[\s\S]*?<\/title>\s*<\/titleStmt>/,
    `<titleStmt>\n      <title>${title}</title>\n${authors}\n    </titleStmt>`,
  );

  const idnos = [
    meta.qid
      ? `\n      <idno type="URI">https://www.wikidata.org/entity/${escapeXmlText(meta.qid)}</idno>`
      : '',
    meta.ctextWorkId ? `\n      <idno type="CTP">${escapeXmlText(meta.ctextWorkId)}</idno>` : '',
  ].join('');
  const urlPara = meta.url ? `<p>${escapeXmlText(meta.url)}</p>` : '';
  const credit = meta.headerCredit
    ? `\n      <note type="wikisource-header">${escapeXmlText(meta.headerCredit)}</note>`
    : '';
  const extraction = meta.extractionNote
    ? `\n      <note type="extraction">${escapeXmlText(meta.extractionNote)}</note>`
    : '';
  const dateNote = meta.publicationDate
    ? `\n      <p>Wikidata P577: ${escapeXmlText(meta.publicationDate)}</p>`
    : '';

  xml = xml.replace(
    /<sourceDesc>[\s\S]*?<\/sourceDesc>/,
    `<sourceDesc>\n      <p>Imported from Wikisource (${escapeXmlText(meta.workTitle)}).</p>\n      ${urlPara}${dateNote}${idnos}${credit}${extraction}\n    </sourceDesc>`,
  );

  xml = xml.replace(
    /<\/teiHeader>/,
    `<revisionDesc>\n    <change when="${when}">Imported from Wikisource.</change>\n  </revisionDesc>\n</teiHeader>`,
  );

  const trimmedBody = bodyXml.trim() || '<p></p>';
  const inner = /<p[\s>]/.test(trimmedBody) ? trimmedBody : `<p>${trimmedBody}</p>`;
  xml = xml.replace(
    /<div type="text">[\s\S]*?<\/div>/,
    `<div type="text">\n      <head>${escapeXmlText(meta.pageTitle)}</head>\n      ${inner}\n    </div>`,
  );

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
