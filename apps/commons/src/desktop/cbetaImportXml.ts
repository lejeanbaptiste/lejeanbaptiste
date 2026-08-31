import { buildSkeletonForCatalog } from './schemaTemplates';
import { norbertPersonRef, wikidataEntityRef } from './kanripoImportXml';
import type { ProjectFileConfig } from './projectTypes';

/** DILA Buddhist Studies Authority person id (``A012345``) → TEI ``@ref`` token. */
export const dilaPersonRef = (value?: string | null): string | undefined => {
  const id = (value ?? '').trim();
  return /^[A-Z]\d{4,}$/.test(id) ? `DILA:${id}` : undefined;
};

export const cbetaAuthorAuthorityRef = (row: {
  wikidata_qid?: string | null;
  norbert_id?: string | null;
  dila_id?: string | null;
}): string | undefined =>
  wikidataEntityRef(row.wikidata_qid) ??
  norbertPersonRef(row.norbert_id) ??
  dilaPersonRef(row.dila_id);

export interface CbetaAuthorshipMeta {
  person_name?: string;
  /** CBETA ``cb:type``: Author | Translator | Editor | Collector … */
  role?: string;
  dila_id?: string;
  norbert_id?: string;
  wikidata_qid?: string;
  dates?: string;
}

export interface CbetaTeiMeta {
  title: string;
  /** CBETA work id, e.g. ``T01n0001`` (also ``T0001``). */
  work_id: string;
  canon: string;
  taisho_vol?: string;
  taisho_no?: string;
  dynasty?: string;
  /** 部類 classification. */
  category?: string;
  /** Set when this file is one juan of a multi-juan work. */
  juan_n?: string;
  juan_title?: string;
  stem: string;
  source: string;
  /** Pinned CBETA data-version tag (provenance). */
  data_version?: string;
  git_commit?: string;
  authorship?: CbetaAuthorshipMeta[];
  work_qid?: string;
}

const escapeXmlText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeXmlAttr = (value: string): string => escapeXmlText(value).replace(/"/g, '&quot;');
const isoDate = (d = new Date()): string => d.toISOString().slice(0, 10);

const authorBlocks = (meta: CbetaTeiMeta, indent = '      '): string =>
  (meta.authorship ?? [])
    .map((row) => {
      const name = escapeXmlText(row.person_name ?? '');
      if (!name) return '';
      const ref = cbetaAuthorAuthorityRef(row);
      const attrs = [
        ref ? ` ref="${escapeXmlAttr(ref)}"` : '',
        row.role ? ` role="${escapeXmlAttr(row.role.trim())}"` : '',
      ].join('');
      return `${indent}<author${attrs}>${name}</author>`;
    })
    .filter(Boolean)
    .join('\n');

const titleBlock = (title: string, workQid?: string, indent = '      '): string => {
  const ref = wikidataEntityRef(workQid);
  return `${indent}<title${ref ? ` ref="${escapeXmlAttr(ref)}"` : ''}>${title}</title>`;
};

const idnoBlocks = (meta: CbetaTeiMeta): string => {
  const rows = [
    meta.work_id ? `<idno type="CBETA">${escapeXmlText(meta.work_id)}</idno>` : '',
    meta.taisho_vol && meta.taisho_no
      ? `<idno type="Taisho">${escapeXmlText(`${meta.taisho_vol}.${meta.taisho_no}`)}</idno>`
      : '',
    meta.work_qid
      ? `<idno type="URI">https://www.wikidata.org/entity/${escapeXmlText(meta.work_qid)}</idno>`
      : '',
  ].filter(Boolean);
  return rows.length ? `        ${rows.join('\n        ')}\n` : '';
};

/**
 * Wrap one juan of CBETA-converted TEI in the project skeleton with provenance.
 *
 * ``bodyXml`` is the ``<text><body>…</body></text>`` fragment from the Python
 * ``convert`` op (juan_split.serialize_juan_body). Its ``<body>`` children are
 * spliced into the skeleton wrapped in ``<div type="juan" n="…">``.
 *
 * TODO(cbeta-import-planning §4, §5.8): most of the header fill still comes from
 * the (stubbed) Python ``metadata_xml`` — this only handles what ``meta`` carries.
 */
export const wrapCbetaTeiDocument = ({
  config,
  meta,
  bodyXml,
  importedAt,
}: {
  config: ProjectFileConfig;
  meta: CbetaTeiMeta;
  bodyXml: string;
  importedAt?: Date;
}): string => {
  const catalogId = config.schema?.catalogId ?? '';
  if (catalogId === 'orlando' || catalogId === 'jTei') {
    throw new Error('CBETA import currently supports TEI projects (not Orlando or jTEI).');
  }

  const title = escapeXmlText(meta.juan_title || meta.title || meta.stem || 'Untitled');
  const when = isoDate(importedAt);

  let xml = buildSkeletonForCatalog(config);

  xml = xml.replace(
    /<titleStmt>\s*<title>[\s\S]*?<\/title>\s*<\/titleStmt>/,
    `<titleStmt>\n${titleBlock(title, meta.work_qid)}\n${authorBlocks(meta)}\n    </titleStmt>`,
  );

  const sourcePara = `${escapeXmlText(meta.source)}; CBETA work ${escapeXmlText(meta.work_id)}${
    meta.juan_n ? ` 卷${escapeXmlText(meta.juan_n)}` : ''
  }${meta.data_version ? `; data ${escapeXmlText(meta.data_version)}` : ''}${
    meta.git_commit ? ` (${escapeXmlText(meta.git_commit.slice(0, 12))})` : ''
  }`;
  xml = xml.replace(
    /<sourceDesc>[\s\S]*?<\/sourceDesc>/,
    `<sourceDesc>
      <biblStruct>
        <monogr>
${authorBlocks(meta, '          ')}
${titleBlock(title, meta.work_qid, '          ')}
${idnoBlocks(meta)}          <imprint><date/></imprint>
        </monogr>
      <note>${sourcePara}.</note>
      </biblStruct>
    </sourceDesc>`,
  );

  const creation: string[] = [];
  if (meta.dynasty) creation.push(`<origDate>${escapeXmlText(meta.dynasty)}</origDate>`);
  if (meta.category) creation.push(`<note type="category">${escapeXmlText(meta.category)}</note>`);
  if (creation.length) {
    xml = xml.replace(
      /<\/fileDesc>/,
      `  </fileDesc>\n  <profileDesc>\n      <creation>\n        ${creation.join(
        '\n        ',
      )}\n      </creation>\n  </profileDesc>`,
    );
  }

  const change = `Imported from CBETA (${escapeXmlText(meta.work_id)}) with plugin cbeta-import.`;
  xml = xml.replace(
    /<\/teiHeader>/,
    `<revisionDesc>\n    <change when="${when}">${change}</change>\n  </revisionDesc>\n</teiHeader>`,
  );

  const doc = new DOMParser().parseFromString(bodyXml, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('CBETA conversion returned malformed juan XML.');
  }
  const body = doc.getElementsByTagName('body')[0];
  const inner = body ? Array.from(body.childNodes).map(nodeToString).join('') : '';
  if (!inner.trim()) throw new Error('CBETA conversion returned an empty juan body.');
  const juanAttrs = meta.juan_n ? ` n="${escapeXmlAttr(meta.juan_n)}"` : '';
  const juanDiv = `<div type="juan"${juanAttrs}>${
    meta.juan_title ? `<head>${escapeXmlText(meta.juan_title)}</head>` : ''
  }${inner}</div>`;

  xml = xml.replace(/<div type="(?:text|juan)"[^>]*>[\s\S]*?<\/div>/, juanDiv);

  // Carry the per-juan apparatus (planning §5.5) into <text><back>.
  const back = doc.getElementsByTagName('back')[0];
  const backXml = back ? nodeToString(back) : '';
  if (backXml.trim()) {
    xml = xml.replace(/([ \t]*)<\/body>\s*<\/text>/, `$1</body>\n$1${backXml}\n</text>`);
  }
  return xml;
};

const nodeToString = (node: Node): string => new XMLSerializer().serializeToString(node);

const joinPath = (...parts: string[]): string =>
  parts.filter(Boolean).join('/').replace(/\/+/g, '/');

/** Unique ``imported/cbeta/<canon>/<vol>/<stem>_<juan>.xml`` path. */
export const uniqueCbetaXmlPath = (
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
