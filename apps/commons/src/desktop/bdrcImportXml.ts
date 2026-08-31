import { buildSkeletonForCatalog } from './schemaTemplates';
import type { ProjectFileConfig } from './projectTypes';

/** Shape returned by `apps/desktop/src/bdrc/etextToTei.mjs#etextHeaderFields`. */
export interface BdrcHeaderFields {
  title: string;
  altTitles: { text: string; lang?: string }[];
  lang: string;
  creators: { name: string; ref?: string; role: string; lang?: string }[];
  idno: { type: string; value: string }[];
  sourceUri: string;
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

const sourceDescBlock = (fields: BdrcHeaderFields): string => {
  const idnos = (fields.idno ?? [])
    .filter((i) => i?.value)
    .map((i) => `        <idno type="${escapeXmlAttr(i.type)}">${escapeXmlText(i.value)}</idno>`)
    .join('\n');
  const ref = fields.sourceUri
    ? `\n        <ref target="${escapeXmlAttr(fields.sourceUri)}">${escapeXmlText(fields.sourceUri)}</ref>`
    : '';
  return (
    `<sourceDesc>\n` +
    `      <bibl>\n` +
    `        <title xml:lang="${escapeXmlAttr(fields.lang)}">${escapeXmlText(fields.title || 'Untitled')}</title>\n` +
    `${idnos}${idnos ? '\n' : ''}` +
    `        <note>Transcription method: ${escapeXmlText(fields.transcriptionMethod)}.</note>${ref}\n` +
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
  importedAt,
}: {
  config: ProjectFileConfig;
  headerFields: BdrcHeaderFields;
  bodyXml: string;
  importedAt?: Date;
}): string => {
  const catalogId = config.schema?.catalogId ?? '';
  if (catalogId === 'orlando' || catalogId === 'jTei') {
    throw new Error('BDRC import currently supports TEI projects (not Orlando or jTEI).');
  }

  const when = isoDate(importedAt);
  let xml = buildSkeletonForCatalog(config);

  xml = xml.replace(
    /<titleStmt>\s*<title>[\s\S]*?<\/title>\s*<\/titleStmt>/,
    titleStmtBlock(headerFields),
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
  const bodyContent = /^<div[\s>]/.test(body)
    ? body
    : `<div type="text">${body || '<p></p>'}</div>`;
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
