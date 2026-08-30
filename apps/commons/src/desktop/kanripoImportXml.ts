import { buildSkeletonForCatalog } from './schemaTemplates';
import type { ProjectFileConfig } from './projectTypes';

export type KanripoNormalizeMode = 'off' | 'dpm' | 'hard_replacements';

export interface KanripoAuthorshipMeta {
  author_index?: string;
  person_name?: string;
  person_id?: string;
  function?: string;
  time_dynasty?: string;
  author_dates?: string;
  date_not_before?: string;
  date_not_after?: string;
}

export interface KanripoTeiMeta {
  title: string;
  kanripo_id: string;
  juan: string;
  source: string;
  dzid: string;
  normalize: KanripoNormalizeMode;
  stem: string;
  vols?: string;
  juan_count?: string;
  catalog_source?: string;
  cbeta_id?: string;
  time_dynasty?: string;
  date_not_before?: string;
  date_not_after?: string;
  author_dates?: string;
  authorship?: KanripoAuthorshipMeta[];
  work_qid?: string;
  edition_qid?: string;
  ws_page?: string;
  ws_url?: string;
  wikidata_primary_name?: string;
  wikidata_aliases?: string[];
}

const escapeXmlText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeXmlAttr = (value: string): string =>
  escapeXmlText(value).replace(/"/g, '&quot;');

const isoDate = (d = new Date()): string => d.toISOString().slice(0, 10);

const authorBlocks = (meta: KanripoTeiMeta): string => {
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

export interface ParallelProvenanceSource {
  label: string;
  url?: string;
  kind?: string;
}

/** Human-readable note for ``revisionDesc`` when parallel punctuation was applied. */
export const formatParallelProvenance = (
  sources: ParallelProvenanceSource[],
  alignMode: 'tape' | 'segmented',
): string => {
  const used = sources.filter((source) => source.label.trim());
  const sourceBits = used.map((source) => {
    if (source.url) return `${source.label} (${source.url})`;
    return source.label;
  });
  const sourceNote = sourceBits.length ? sourceBits.join('; ') : 'paste/file';
  return `parallel punctuation (${alignMode}); sources: ${sourceNote}`;
};

/** Append a ``revisionDesc/change`` entry, creating ``revisionDesc`` if needed. */
export const appendTeiRevisionChange = (xml: string, change: string, importedAt?: Date): string => {
  const when = isoDate(importedAt);
  const escaped = escapeXmlText(change);
  if (/<revisionDesc\b/.test(xml)) {
    return xml.replace(
      /<\/revisionDesc>/,
      `    <change when="${when}">${escaped}</change>\n  </revisionDesc>`,
    );
  }
  return xml.replace(
    /<\/teiHeader>/,
    `<revisionDesc>\n    <change when="${when}">${escaped}</change>\n  </revisionDesc>\n</teiHeader>`,
  );
};

/** Wrap a Kanripo body ``div`` in the project TEI skeleton with provenance. */
export const wrapKanripoTeiDocument = ({
  config,
  meta,
  bodyXml,
  metadataXml,
  githubUrl,
  importedAt,
  punctNote,
}: {
  config: ProjectFileConfig;
  meta: KanripoTeiMeta;
  bodyXml: string;
  metadataXml?: string;
  githubUrl?: string;
  importedAt?: Date;
  punctNote?: string;
}): string => {
  const catalogId = config.schema?.catalogId ?? '';
  if (catalogId === 'orlando' || catalogId === 'jTei') {
    throw new Error('Kanripo import currently supports TEI projects (not Orlando or jTEI).');
  }

  const title = escapeXmlText(meta.title || meta.kanripo_id || meta.stem || 'Untitled');
  const krId = escapeXmlText(meta.kanripo_id);
  const juan = escapeXmlText(meta.juan);
  const when = isoDate(importedAt);
  const url = githubUrl ?? (meta.kanripo_id ? `https://github.com/kanripo/${meta.kanripo_id}` : '');
  const authors = authorBlocks(meta);

  let xml = buildSkeletonForCatalog(config);

  xml = xml.replace(
    /<titleStmt>\s*<title>[\s\S]*?<\/title>\s*<\/titleStmt>/,
    `<titleStmt>\n      <title>${title}</title>\n${authors}\n    </titleStmt>`,
  );

  const sourceBits = ['Kanseki Repository (Kanripo)'];
  if (krId) sourceBits.push(krId);
  if (juan) sourceBits.push(`juan ${juan}`);
  if (meta.source) sourceBits.push(`witness ${escapeXmlText(meta.source)}`);
  if (meta.catalog_source) sourceBits.push(`catalog ${escapeXmlText(meta.catalog_source)}`);
  const sourcePara = escapeXmlText(sourceBits.join(', '));
  const urlPara = url ? `<p>${escapeXmlText(url)}</p>` : '';
  const idnos = [
    krId ? `\n      <idno type="Kanripo">${krId}</idno>` : '',
    meta.cbeta_id ? `\n      <idno type="CBETA">${escapeXmlText(meta.cbeta_id)}</idno>` : '',
    meta.dzid ? `\n      <idno type="DZID">${escapeXmlText(meta.dzid)}</idno>` : '',
    meta.work_qid
      ? `\n      <idno type="URI">https://www.wikidata.org/entity/${escapeXmlText(meta.work_qid)}</idno>`
      : '',
    meta.edition_qid && meta.edition_qid !== meta.work_qid
      ? `\n      <idno type="URI" subtype="edition">https://www.wikidata.org/entity/${escapeXmlText(meta.edition_qid)}</idno>`
      : '',
    meta.ws_url ? `\n      <idno type="URI" subtype="wikisource">${escapeXmlText(meta.ws_url)}</idno>` : '',
  ].join('');
  xml = xml.replace(
    /<sourceDesc>[\s\S]*?<\/sourceDesc>/,
    `<sourceDesc>\n      <p>${sourcePara}.</p>\n      ${urlPara}${idnos}\n    </sourceDesc>`,
  );

  const profileBits: string[] = [];
  const volLabel = meta.vols ?? meta.juan_count;
  if (volLabel) {
    profileBits.push(`      <extent>${escapeXmlText(volLabel)} 卷</extent>`);
  }
  if (meta.time_dynasty || meta.author_dates) {
    const whenParts = [
      meta.time_dynasty ? `<origDate>${escapeXmlText(meta.time_dynasty)}</origDate>` : '',
      meta.author_dates
        ? `<note type="authorDates">${escapeXmlText(meta.author_dates)}</note>`
        : '',
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

  const change = `Imported from Kanripo with plugin kanripo-import; normalisation=${escapeXmlText(
    meta.normalize,
  )}${punctNote ? `; ${escapeXmlText(punctNote)}` : ''}.`;
  xml = xml.replace(
    /<\/teiHeader>/,
    `<revisionDesc>\n    <change when="${when}">${change}</change>\n  </revisionDesc>\n</teiHeader>`,
  );

  const trimmedBody = bodyXml.trim();
  if (!/<div[\s>]/.test(trimmedBody)) {
    throw new Error('Kanripo conversion did not return a TEI div.');
  }

  const metadataBlock = (metadataXml ?? '').trim();
  const bodyContent = metadataBlock
    ? `${metadataBlock}\n    ${trimmedBody}`
    : trimmedBody;
  xml = xml.replace(/<div type="text">[\s\S]*?<\/div>/, bodyContent);

  return xml;
};

const joinPath = (...parts: string[]): string =>
  parts.filter(Boolean).join('/').replace(/\/+/g, '/');

/** Unique ``imported/kanripo/<KR_ID>/<stem>.xml`` path, with ``-2`` suffixes like document import. */
export const uniqueKanripoXmlPath = (
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
