import { buildSkeletonForCatalog } from './schemaTemplates';
import type { ProjectFileConfig } from './projectTypes';

export interface DaozangAuthorshipMeta {
  author_index?: string;
  person_name?: string;
  person_id?: string;
  function?: string;
  time_dynasty?: string;
  author_dates?: string;
  date_not_before?: string;
  date_not_after?: string;
}

export interface DaozangTeiMeta {
  title: string;
  dz_no: string;
  variant: string;
  rel_path: string;
  stem: string;
  source: string;
  dzid?: string;
  kr_id?: string;
  krp_title?: string;
  vols?: string;
  edition?: string;
  variant_class?: string;
  time_dynasty?: string;
  date_not_before?: string;
  date_not_after?: string;
  author_dates?: string;
  authorship?: DaozangAuthorshipMeta[];
}

const escapeXmlText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeXmlAttr = (value: string): string =>
  escapeXmlText(value).replace(/"/g, '&quot;');

const isoDate = (d = new Date()): string => d.toISOString().slice(0, 10);

const authorBlocks = (meta: DaozangTeiMeta): string => {
  const rows = meta.authorship ?? [];
  if (!rows.length) return '';
  return rows
    .map((row) => {
      const name = escapeXmlText(row.person_name ?? '');
      const pid = (row.person_id ?? '').trim();
      const fn = (row.function ?? '').trim();
      const attrs = [
        pid ? ` n="${escapeXmlAttr(pid)}"` : '',
        fn ? ` role="${escapeXmlAttr(fn)}"` : '',
      ].join('');
      return name ? `      <author${attrs}>${name}</author>` : '';
    })
    .filter(Boolean)
    .join('\n');
};

/** Wrap a Daozang body ``div`` in the project TEI skeleton with provenance. */
export const wrapDaozangTeiDocument = ({
  config,
  meta,
  bodyXml,
  metadataXml,
  importedAt,
}: {
  config: ProjectFileConfig;
  meta: DaozangTeiMeta;
  bodyXml: string;
  metadataXml?: string;
  importedAt?: Date;
}): string => {
  const catalogId = config.schema?.catalogId ?? '';
  if (catalogId === 'orlando' || catalogId === 'jTei') {
    throw new Error('Daozang import currently supports TEI projects (not Orlando or jTEI).');
  }

  const title = escapeXmlText(meta.title || meta.stem || 'Untitled');
  const dzNo = escapeXmlText(meta.dz_no);
  const dzid = escapeXmlText(meta.dzid ?? '');
  const krId = escapeXmlText(meta.kr_id ?? '');
  const variant = escapeXmlText(meta.variant);
  const sourceNote = escapeXmlText(meta.source);
  const relPath = escapeXmlText(meta.rel_path);
  const when = isoDate(importedAt);
  const authors = authorBlocks(meta);

  let xml = buildSkeletonForCatalog(config);
  xml = xml.replace(
    /<titleStmt>\s*<title>[\s\S]*?<\/title>\s*<\/titleStmt>/,
    `<titleStmt>\n      <title>${title}</title>\n${authors}\n    </titleStmt>`,
  );

  const idnos = [
    dzNo ? `\n      <idno type="Daozang">${dzNo}</idno>` : '',
    dzid ? `\n      <idno type="DZID">${dzid}</idno>` : '',
    krId ? `\n      <idno type="Kanripo">${krId}</idno>` : '',
  ].join('');
  const sourcePara = `${sourceNote}; local path ${relPath} (${variant})`;
  xml = xml.replace(
    /<sourceDesc>[\s\S]*?<\/sourceDesc>/,
    `<sourceDesc>\n      <p>${sourcePara}.</p>${idnos}\n    </sourceDesc>`,
  );

  const profileBits: string[] = [];
  if (meta.vols) {
    profileBits.push(`      <extent>${escapeXmlText(meta.vols)} 卷</extent>`);
  }
  if (meta.time_dynasty || meta.author_dates) {
    const whenParts = [
      meta.time_dynasty ? `<origDate>${escapeXmlText(meta.time_dynasty)}</origDate>` : '',
      meta.author_dates ? `<note type="authorDates">${escapeXmlText(meta.author_dates)}</note>` : '',
    ].filter(Boolean);
    if (whenParts.length) {
      profileBits.push(`      <creation>\n        ${whenParts.join('\n        ')}\n      </creation>`);
    }
  }
  if (profileBits.length) {
    xml = xml.replace(
      /<\/fileDesc>/,
      `  </fileDesc>\n  <profileDesc>\n${profileBits.join('\n')}\n  </profileDesc>`,
    );
  }

  const change = `Imported from Fang Tongzi Daozang corpus with plugin daozang-import.`;
  xml = xml.replace(
    /<\/teiHeader>/,
    `<revisionDesc>\n    <change when="${when}">${escapeXmlText(change)}</change>\n  </revisionDesc>\n</teiHeader>`,
  );

  const trimmedBody = bodyXml.trim();
  if (!/<div[\s>]/.test(trimmedBody)) {
    throw new Error('Daozang conversion did not return a TEI div.');
  }

  const metadataBlock = (metadataXml ?? '').trim();
  const bodyContent = metadataBlock
    ? `${metadataBlock}\n    ${trimmedBody}`
    : trimmedBody;
  xml = xml.replace(/<div type="(?:text|juan)"[^>]*>[\s\S]*?<\/div>/, bodyContent);

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
