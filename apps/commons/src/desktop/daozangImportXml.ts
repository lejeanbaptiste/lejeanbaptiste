import { buildSkeletonForCatalog } from './schemaTemplates';
import { authorAuthorityRef, wikidataEntityRef } from './kanripoImportXml';
import type { ProjectFileConfig } from './projectTypes';

export interface DaozangAuthorshipMeta {
  author_index?: string;
  person_name?: string;
  person_id?: string;
  wikidata_qid?: string;
  cbdb_id?: string;
  norbert_id?: string;
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
  work_qid?: string;
  edition_qid?: string;
  ws_page?: string;
  ws_url?: string;
  match_tier?: string;
}

const escapeXmlText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeXmlAttr = (value: string): string => escapeXmlText(value).replace(/"/g, '&quot;');

const isoDate = (d = new Date()): string => d.toISOString().slice(0, 10);

const authorBlocks = (meta: DaozangTeiMeta, indent = '      '): string => {
  const rows = meta.authorship ?? [];
  if (!rows.length) return '';
  return rows
    .map((row) => {
      const name = escapeXmlText(row.person_name ?? '');
      const authorityRef = authorAuthorityRef(row);
      const fn = (row.function ?? '').trim();
      const attrs = [
        authorityRef ? ` ref="${escapeXmlAttr(authorityRef)}"` : '',
        fn ? ` role="${escapeXmlAttr(fn)}"` : '',
      ].join('');
      return name ? `${indent}<author${attrs}>${name}</author>` : '';
    })
    .filter(Boolean)
    .join('\n');
};

const titleBlock = (title: string, workQid?: string, indent = '      '): string => {
  const authorityRef = wikidataEntityRef(workQid);
  const attrs = authorityRef ? ` ref="${escapeXmlAttr(authorityRef)}"` : '';
  return `${indent}<title${attrs}>${title}</title>`;
};

const monogrIdnoBlocks = (meta: DaozangTeiMeta): string => {
  const rows = [
    meta.dz_no ? `<idno type="Daozang">${escapeXmlText(meta.dz_no)}</idno>` : '',
    meta.dzid ? `<idno type="DZID">${escapeXmlText(meta.dzid)}</idno>` : '',
    meta.kr_id ? `<idno type="Kanripo">${escapeXmlText(meta.kr_id)}</idno>` : '',
    meta.work_qid
      ? `<idno type="URI">https://www.wikidata.org/entity/${escapeXmlText(meta.work_qid)}</idno>`
      : '',
    meta.edition_qid && meta.edition_qid !== meta.work_qid
      ? `<idno type="URI" subtype="edition">https://www.wikidata.org/entity/${escapeXmlText(meta.edition_qid)}</idno>`
      : '',
    meta.ws_url ? `<idno type="URI" subtype="wikisource">${escapeXmlText(meta.ws_url)}</idno>` : '',
  ].filter(Boolean);
  return rows.length ? `        ${rows.join('\n        ')}\n` : '';
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
  const variant = escapeXmlText(meta.variant);
  const sourceNote = escapeXmlText(meta.source);
  const relPath = escapeXmlText(meta.rel_path);
  const when = isoDate(importedAt);
  const authors = authorBlocks(meta);

  let xml = buildSkeletonForCatalog(config);
  xml = xml.replace(
    /<titleStmt>\s*<title>[\s\S]*?<\/title>\s*<\/titleStmt>/,
    `<titleStmt>\n${titleBlock(title, meta.work_qid)}\n${authors}\n    </titleStmt>`,
  );

  const sourcePara = `${sourceNote}; local path ${relPath} (${variant})`;
  const monogrAuthors = authorBlocks(meta, '        ');
  xml = xml.replace(
    /<sourceDesc>[\s\S]*?<\/sourceDesc>/,
    `<sourceDesc>
      <biblStruct>
        <monogr>
${monogrAuthors ? `${monogrAuthors}\n` : ''}${titleBlock(title, meta.work_qid, '          ')}
${monogrIdnoBlocks(meta)}          <imprint><date/></imprint>
        </monogr>
      <note>${sourcePara}.</note>
      </biblStruct>
    </sourceDesc>`,
  );

  if (meta.vols) {
    xml = xml.replace(
      /<publicationStmt>/,
      `<extent>${escapeXmlText(meta.vols)} 卷</extent>\n    <publicationStmt>`,
    );
  }

  const creationParts: string[] = [];
  if (meta.time_dynasty) {
    creationParts.push(`<origDate>${escapeXmlText(meta.time_dynasty)}</origDate>`);
  }
  if (meta.author_dates) {
    creationParts.push(`<note type="authorDates">${escapeXmlText(meta.author_dates)}</note>`);
  }
  if (creationParts.length) {
    xml = xml.replace(
      /<\/fileDesc>/,
      `  </fileDesc>\n  <profileDesc>\n      <creation>\n        ${creationParts.join('\n        ')}\n      </creation>\n  </profileDesc>`,
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

  // DPM <metadata> fragments belong in the header, not the body (they are not valid TEI body content).
  void metadataXml;
  xml = xml.replace(/<div type="(?:text|juan)"[^>]*>[\s\S]*?<\/div>/, trimmedBody);

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
