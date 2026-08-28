import { buildSkeletonForCatalog } from './schemaTemplates';
import type { ProjectFileConfig } from './projectTypes';

export interface DaozangTeiMeta {
  title: string;
  dz_no: string;
  variant: string;
  rel_path: string;
  stem: string;
  source: string;
}

const escapeXmlText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const isoDate = (d = new Date()): string => d.toISOString().slice(0, 10);

/** Wrap a Daozang body ``div`` in the project TEI skeleton with provenance. */
export const wrapDaozangTeiDocument = ({
  config,
  meta,
  bodyXml,
  importedAt,
}: {
  config: ProjectFileConfig;
  meta: DaozangTeiMeta;
  bodyXml: string;
  importedAt?: Date;
}): string => {
  const catalogId = config.schema?.catalogId ?? '';
  if (catalogId === 'orlando' || catalogId === 'jTei') {
    throw new Error('Daozang import currently supports TEI projects (not Orlando or jTEI).');
  }

  const title = escapeXmlText(meta.title || meta.stem || 'Untitled');
  const dzNo = escapeXmlText(meta.dz_no);
  const variant = escapeXmlText(meta.variant);
  const sourceNote = escapeXmlText(meta.source);
  const relPath = escapeXmlText(meta.rel_path);
  const when = isoDate(importedAt);

  let xml = buildSkeletonForCatalog(config);
  xml = xml.replace(
    /<titleStmt>\s*<title>[\s\S]*?<\/title>\s*<\/titleStmt>/,
    `<titleStmt><title>${title}</title></titleStmt>`,
  );

  const idnoBlock = dzNo ? `\n      <idno type="Daozang">${dzNo}</idno>` : '';
  const sourcePara = `${sourceNote}; local path ${relPath} (${variant})`;
  xml = xml.replace(
    /<sourceDesc>[\s\S]*?<\/sourceDesc>/,
    `<sourceDesc>\n      <p>${sourcePara}.</p>${idnoBlock}\n    </sourceDesc>`,
  );

  const change = `Imported from Fang Tongzi Daozang corpus with plugin daozang-import.`;
  xml = xml.replace(
    /<\/teiHeader>/,
    `<revisionDesc>\n    <change when="${when}">${escapeXmlText(change)}</change>\n  </revisionDesc>\n</teiHeader>`,
  );

  const trimmedBody = bodyXml.trim();
  if (!/<div[\s>]/.test(trimmedBody)) {
    throw new Error('Daozang conversion did not return a TEI div.');
  }
  xml = xml.replace(/<div type="text">[\s\S]*?<\/div>/, trimmedBody);

  return xml;
};

const joinPath = (...parts: string[]): string =>
  parts.filter(Boolean).join('/').replace(/\/+/g, '/');

/** Unique ``imported/daozang/<stem>.xml`` path, with ``-2`` suffixes like document import. */
export const uniqueDaozangXmlPath = (
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
