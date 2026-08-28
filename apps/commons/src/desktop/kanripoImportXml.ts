import { buildSkeletonForCatalog } from './schemaTemplates';
import type { ProjectFileConfig } from './projectTypes';

export type KanripoNormalizeMode = 'off' | 'dpm' | 'hard_replacements';

export interface KanripoTeiMeta {
  title: string;
  kanripo_id: string;
  juan: string;
  source: string;
  dzid: string;
  normalize: KanripoNormalizeMode;
  stem: string;
}

const escapeXmlText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const isoDate = (d = new Date()): string => d.toISOString().slice(0, 10);

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
  githubUrl,
  importedAt,
  punctNote,
}: {
  config: ProjectFileConfig;
  meta: KanripoTeiMeta;
  bodyXml: string;
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

  let xml = buildSkeletonForCatalog(config);

  xml = xml.replace(
    /<titleStmt>\s*<title>[\s\S]*?<\/title>\s*<\/titleStmt>/,
    `<titleStmt><title>${title}</title></titleStmt>`,
  );

  const sourceBits = ['Kanseki Repository (Kanripo)'];
  if (krId) sourceBits.push(krId);
  if (juan) sourceBits.push(`juan ${juan}`);
  if (meta.source) sourceBits.push(`edition ${escapeXmlText(meta.source)}`);
  const sourcePara = escapeXmlText(sourceBits.join(', '));
  const urlPara = url ? `<p>${escapeXmlText(url)}</p>` : '';
  const idnoBlock = krId ? `\n      <bibl><idno type="Kanripo">${krId}</idno></bibl>` : '';
  xml = xml.replace(
    /<sourceDesc>[\s\S]*?<\/sourceDesc>/,
    `<sourceDesc>\n      <p>${sourcePara}.</p>\n      ${urlPara}${idnoBlock}\n    </sourceDesc>`,
  );

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
  xml = xml.replace(/<div type="text">[\s\S]*?<\/div>/, trimmedBody);

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
