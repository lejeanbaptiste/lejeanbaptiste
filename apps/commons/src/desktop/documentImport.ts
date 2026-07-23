import type { ProjectFileConfig } from './projectFile';
import { buildSkeletonForCatalog } from './schemaTemplates';
import { resolvePageBreakMarkers, tagPageBreaks } from '@cwrc/leafwriter/pageBreakDetection';
import { isOrlandoCatalog } from './schemaMetadataFields';

export type ImportableDocumentFormat = 'txt' | 'md' | 'rtf' | 'docx' | 'odt' | 'xml';

export type XmlDocumentFamily = 'tei' | 'orlando' | 'unknown';

export interface DocumentImportSource {
  format: ImportableDocumentFormat;
  relativePath: string;
  sourcePath: string;
}

export interface DocumentImportPlanItem extends DocumentImportSource {
  outputPath: string;
}

export interface DocumentImportProblem {
  message: string;
  outputPath?: string;
  sourcePath: string;
}

export interface ImportedXmlInspection {
  error?: {
    column?: number;
    line?: number;
    message: string;
    snippet: string;
  };
  ok: boolean;
}

export interface DemoteEntityKeysResult {
  count: number;
  xml: string;
}

export interface BuildImportedXmlDocumentResult {
  keysDemoted: number;
  xml: string;
}

/** Token stored in `@ana` when a foreign `@key` is demoted on XML import. */
export const FORMER_KEY_ANA_PREFIX = 'ljb-former-key:';

/** Comments and CDATA sections are opaque: never rewrite inside them. */
const OPAQUE_SECTION = /(<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>)/g;

/** Matches an element open tag (not comments, PIs, CDATA, or closing tags). */
const OPEN_TAG = /<[A-Za-z_][^<>]*>/g;

/** Matches a key attribute inside a tag: key="…" or key='…' (case-insensitive). */
const KEY_ATTR = /(\s+)key=(["'])([^"']*)\2/gi;

const ANA_ATTR = /(\s+)ana=(["'])([^"']*)\2/i;

const sanitizeXmlText = (value: string): string =>
  Array.from(value)
    .filter((char) => {
      const codePoint = char.codePointAt(0);
      if (codePoint === undefined) return false;
      return (
        codePoint === 0x09 ||
        codePoint === 0x0a ||
        codePoint === 0x0d ||
        (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
        (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
        (codePoint >= 0x10000 && codePoint <= 0x10ffff)
      );
    })
    .join('');

const escapeXmlText = (value: string): string =>
  sanitizeXmlText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const basenameWithoutExtension = (filePath: string): string => {
  const name = filePath.split(/[\\/]/).pop() ?? filePath;
  return name.replace(/\.[^.]+$/, '') || 'Untitled';
};

const splitPath = (filePath: string): string[] => filePath.split(/[\\/]/).filter(Boolean);

const dirname = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index === -1 ? '' : normalized.slice(0, index);
};

const joinPath = (...parts: string[]): string =>
  parts
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/');

const replaceExtension = (filePath: string, extension: string): string => {
  const dir = dirname(filePath);
  const name = basenameWithoutExtension(filePath);
  return joinPath(dir, `${name}.${extension.replace(/^\./, '')}`);
};

const outputPathWithSuffix = (filePath: string, suffix: number): string => {
  const dir = dirname(filePath);
  const name = basenameWithoutExtension(filePath);
  return joinPath(dir, `${name}-${suffix}.xml`);
};

const lineSnippet = (content: string, line?: number, radius = 2): string => {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const center = Math.max(1, line ?? 1);
  const start = Math.max(1, center - radius);
  const end = Math.min(lines.length, center + radius);

  return lines
    .slice(start - 1, end)
    .map((text, index) => {
      const lineNumber = start + index;
      const marker = lineNumber === center ? '>' : ' ';
      return `${marker} ${String(lineNumber).padStart(4, ' ')} | ${text}`;
    })
    .join('\n');
};

const parseDomParserLocation = (message: string): { column?: number; line?: number } => {
  const line = message.match(/line\s+(\d+)/i);
  const column = message.match(/column\s+(\d+)/i);
  return {
    column: column?.[1] ? Number(column[1]) : undefined,
    line: line?.[1] ? Number(line[1]) : undefined,
  };
};

export const inspectImportedXml = (content: string): ImportedXmlInspection => {
  if (typeof DOMParser === 'undefined') {
    return { ok: true };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'application/xml');
  const errorNode = doc.querySelector('parsererror');
  if (!errorNode) return { ok: true };

  const message =
    errorNode.querySelector('div')?.textContent?.trim() ??
    errorNode.textContent?.trim() ??
    'Invalid XML';
  const location = parseDomParserLocation(message);

  return {
    error: {
      ...location,
      message,
      snippet: lineSnippet(content, location.line),
    },
    ok: false,
  };
};

export const assertImportedXmlWellFormed = (content: string, context: string): void => {
  const inspection = inspectImportedXml(content);
  if (inspection.ok) return;

  const location = inspection.error?.line
    ? ` at line ${inspection.error.line}, column ${inspection.error.column ?? 1}`
    : '';
  const message = inspection.error?.message ?? 'Invalid XML';
  throw new Error(`${context}${location}: ${message}`);
};

export const logImportedXmlInspection = ({
  content,
  outputPath,
  sourcePath,
  stage,
}: {
  content: string;
  outputPath?: string;
  sourcePath: string;
  stage: string;
}): ImportedXmlInspection => {
  const inspection = inspectImportedXml(content);
  const label = `[document-import] ${inspection.ok ? 'valid' : 'invalid'} XML after ${stage}`;

  if (inspection.ok) {
    return inspection;
  }

  console.group(label);
  console.error(inspection.error?.message ?? 'Invalid XML');
  console.error({ outputPath, sourcePath, stage, length: content.length });
  if (inspection.error?.snippet) console.error(`Snippet:\n${inspection.error.snippet}`);
  console.groupEnd();

  return inspection;
};

export const stripMarkdownToPlainText = (content: string): string => {
  return content
    .replace(/^---[\s\S]*?\n---\s*/m, '')
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```[^\n]*\n?|```/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[ \t]{0,3}([-*+]|\d+\.)[ \t]+/gm, '')
    .replace(/[*_~]{1,3}/g, '')
    .replace(/<[^>]+>/g, '');
};

export const stripRtfToPlainText = (content: string): string => {
  let text = content
    .replace(/\\par[d]? ?/g, '\n\n')
    .replace(/\\line ?/g, '\n')
    .replace(/\\tab ?/g, '\t')
    .replace(/\\'[0-9a-fA-F]{2}/g, (match) => {
      const code = Number.parseInt(match.slice(2), 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    })
    .replace(/\\u(-?\d+)\??/g, (_match, code: string) => {
      const value = Number.parseInt(code, 10);
      return Number.isFinite(value) ? String.fromCharCode(value < 0 ? value + 65536 : value) : '';
    });

  text = text
    .replace(/\{\\\*[^{}]*\}/g, '')
    .replace(/[{}]/g, '')
    .replace(/\\[a-zA-Z]+-?\d* ?/g, '')
    .replace(/\\[^a-zA-Z]/g, '');

  return text;
};

export const normalizeImportedParagraphs = (content: string): string[] => {
  const normalized = content
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n');

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n+/g, ' ').replace(/[ \t]{2,}/g, ' ').trim())
    .filter(Boolean);
};

export const extractPlainTextForImport = (
  content: string,
  format: ImportableDocumentFormat,
): string => {
  if (format === 'xml') {
    throw new Error('XML import does not use plain-text extraction.');
  }
  if (format === 'md') return stripMarkdownToPlainText(content);
  if (format === 'rtf') return stripRtfToPlainText(content);
  return content;
};

export const isEntityDatabaseFilename = (filePath: string): boolean =>
  basenameWithoutExtension(filePath).toLowerCase() === 'entities' &&
  /\.xml$/i.test(filePath);

export const detectXmlDocumentFamily = (xml: string): XmlDocumentFamily => {
  const stripped = xml
    .replace(/<\?[\s\S]*?\?>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, ' ');
  const match = stripped.match(/<([A-Za-z_][\w:.-]*)/);
  const localName = (match?.[1] ?? '').replace(/^.*:/, '');
  if (/^TEI$/i.test(localName) || /^teiCorpus$/i.test(localName)) return 'tei';
  if (/^ORLANDO$/i.test(localName)) return 'orlando';
  return 'unknown';
};

export const catalogXmlFamily = (catalogId?: string | null): XmlDocumentFamily => {
  if (isOrlandoCatalog(catalogId)) return 'orlando';
  // Bundled TEI catalogs (and local TEI) share the TEI family for import.
  if (
    !catalogId ||
    catalogId === 'teiAll' ||
    catalogId === 'teiLite' ||
    catalogId === 'teiSimplePrint' ||
    catalogId === 'jTei' ||
    catalogId === 'local-tei'
  ) {
    return 'tei';
  }
  return 'unknown';
};

/**
 * Move live `@key` values onto `@ana` as `ljb-former-key:…` tokens so imported
 * mentions keep a breadcrumb without pointing at this project's entity catalogue.
 */
export const demoteEntityKeys = (xml: string): DemoteEntityKeysResult => {
  let count = 0;

  const rewriteTag = (tag: string): string => {
    if (!/key=/i.test(tag)) return tag;

    const keys: string[] = [];
    KEY_ATTR.lastIndex = 0;
    let keyMatch: RegExpExecArray | null;
    while ((keyMatch = KEY_ATTR.exec(tag)) !== null) {
      if (keyMatch[3]) keys.push(keyMatch[3]);
    }
    if (keys.length === 0) {
      // Empty key=""/key='' — strip only.
      count += 1;
      return tag.replace(KEY_ATTR, '');
    }

    count += keys.length;
    let next = tag.replace(KEY_ATTR, '');
    const tokens = keys.map((key) => `${FORMER_KEY_ANA_PREFIX}${key}`);

    const anaMatch = next.match(ANA_ATTR);
    if (anaMatch) {
      const existing = new Set(anaMatch[3].trim().split(/\s+/).filter(Boolean));
      for (const token of tokens) existing.add(token);
      const merged = [...existing].join(' ');
      return next.replace(anaMatch[0], `${anaMatch[1]}ana=${anaMatch[2]}${merged}${anaMatch[2]}`);
    }

    const insertion = ` ana="${tokens.join(' ')}"`;
    if (/\/>\s*$/.test(next)) return next.replace(/\/>\s*$/, `${insertion}/>`);
    return next.replace(/>\s*$/, `${insertion}>`);
  };

  const rewritten = xml
    .split(OPAQUE_SECTION)
    .map((part, index) =>
      index % 2 === 1 ? part : part.replace(OPEN_TAG, (tag) => rewriteTag(tag)),
    )
    .join('');

  return { xml: rewritten, count };
};

const replaceOrInsertProcessingInstruction = (
  xml: string,
  target: 'xml-model' | 'xml-stylesheet',
  pi: string,
): string => {
  const pattern =
    target === 'xml-model'
      ? /<\?xml-model\s+[^?]*\?>/i
      : /<\?xml-stylesheet\s+[^?]*\?>/i;

  if (pattern.test(xml)) {
    return xml.replace(pattern, pi);
  }

  const xmlDecl = xml.match(/<\?xml\b[^?]*\?>/i);
  if (xmlDecl) {
    return xml.replace(xmlDecl[0], `${xmlDecl[0]}\n${pi}`);
  }

  return `${pi}\n${xml}`;
};

/** Point the document at this project's RNG/CSS (relative paths from project config). */
export const applyProjectSchemaProcessingInstructions = (
  xml: string,
  config: ProjectFileConfig,
): string => {
  const rng = config.schema?.rng?.trim();
  const css = config.schema?.css?.trim();
  let updated = xml;

  if (rng) {
    updated = replaceOrInsertProcessingInstruction(
      updated,
      'xml-model',
      `<?xml-model href="${rng}" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>`,
    );
  }

  if (css) {
    updated = replaceOrInsertProcessingInstruction(
      updated,
      'xml-stylesheet',
      `<?xml-stylesheet type="text/css" href="${css}"?>`,
    );
  }

  return updated;
};

const appendImportProvenanceNote = ({
  xml,
  family,
  keysDemoted,
  sourcePath,
}: {
  family: XmlDocumentFamily;
  keysDemoted: number;
  sourcePath: string;
  xml: string;
}): string => {
  const sourceName = basenameWithoutExtension(sourcePath);
  const date = new Date().toISOString().slice(0, 10);
  const keyNote =
    keysDemoted > 0
      ? ` Moved ${keysDemoted} entity key${keysDemoted === 1 ? '' : 's'} to @ana (${FORMER_KEY_ANA_PREFIX}…).`
      : '';
  const note = `Imported into this project from ${sourceName} on ${date}.${keyNote}`;

  if (family === 'orlando') {
    if (/<SOURCEDESC\b[^>]*>[\s\S]*?<\/SOURCEDESC>/i.test(xml)) {
      return xml.replace(
        /<\/SOURCEDESC>/i,
        `\n${escapeXmlText(note)}\n  </SOURCEDESC>`,
      );
    }
    return xml;
  }

  if (/<sourceDesc\b[^>]*>[\s\S]*?<\/sourceDesc>/i.test(xml)) {
    return xml.replace(
      /<\/sourceDesc>/i,
      `    <p>${escapeXmlText(note)}</p>\n  </sourceDesc>`,
    );
  }

  return xml;
};

/**
 * XML import (v1): keep the document body, attach the project schema PIs,
 * demote foreign `@key`s, and leave compatible header content in place.
 * Cross-family conversion (TEI ↔ Orlando) and element remapping are out of scope.
 */
export const buildImportedXmlDocument = ({
  config,
  sourcePath,
  xml,
}: {
  config: ProjectFileConfig;
  sourcePath: string;
  xml: string;
}): BuildImportedXmlDocumentResult => {
  if (isEntityDatabaseFilename(sourcePath)) {
    throw new Error(
      'entities.xml is the entity database, not a document. Copy it via Project settings instead of Import Documents.',
    );
  }

  assertImportedXmlWellFormed(xml, 'Source XML is not well formed');

  const sourceFamily = detectXmlDocumentFamily(xml);
  const targetFamily = catalogXmlFamily(config.schema?.catalogId);

  if (sourceFamily === 'unknown') {
    throw new Error(
      'Could not recognize the root element. XML import currently supports TEI (or teiCorpus) and Orlando documents.',
    );
  }

  if (targetFamily === 'unknown') {
    throw new Error(
      'This project uses a custom schema; automatic XML import is only available for bundled TEI and Orlando catalogs.',
    );
  }

  if (sourceFamily !== targetFamily) {
    throw new Error(
      `This file looks like ${sourceFamily.toUpperCase()}, but the project schema is ${targetFamily.toUpperCase()}. Cross-family XML conversion is not available yet.`,
    );
  }

  const demoted = demoteEntityKeys(xml);
  let next = applyProjectSchemaProcessingInstructions(demoted.xml, config);
  next = appendImportProvenanceNote({
    xml: next,
    family: sourceFamily,
    keysDemoted: demoted.count,
    sourcePath,
  });
  assertImportedXmlWellFormed(next, 'Imported XML is not well formed after key demotion');

  return { xml: next, keysDemoted: demoted.count };
};

const replaceTeiTitle = (xml: string, title: string): string =>
  xml.replace(/<title(\s[^>]*)?>[\s\S]*?<\/title>/, `<title$1>${escapeXmlText(title)}</title>`);

const renderImportedParagraph = (paragraph: string, tag: string): string => {
  const resolved = resolvePageBreakMarkers(
    paragraph,
    escapeXmlText,
    (n) => `<pb n="${n}"/>`,
  );
  if ('soleMarker' in resolved) return resolved.soleMarker;
  return `<${tag}>${resolved.text}</${tag}>`;
};

const replaceTeiBody = (xml: string, paragraphs: string[]): string => {
  const body = [
    '<body>',
    '    <div type="text">',
    ...paragraphs.map((paragraph) => `      ${renderImportedParagraph(paragraph, 'p')}`),
    '    </div>',
    '  </body>',
  ].join('\n  ');

  if (/<body\b[^>]*>[\s\S]*?<\/body>/.test(xml)) {
    return xml.replace(/<body\b[^>]*>[\s\S]*?<\/body>/, body);
  }

  return xml;
};

const replaceOrlandoTitle = (xml: string, title: string): string =>
  xml
    .replace(/<DOCTITLE>[\s\S]*?<\/DOCTITLE>/, `<DOCTITLE>${escapeXmlText(title)}</DOCTITLE>`)
    .replace(/<STANDARD>[\s\S]*?<\/STANDARD>/, `<STANDARD>${escapeXmlText(title)}</STANDARD>`);

const replaceOrlandoBody = (xml: string, paragraphs: string[]): string => {
  const prose = paragraphs.map((paragraph) => renderImportedParagraph(paragraph, 'P')).join('\n      ');
  return xml.replace(
    /<AUTHORSUMMARY>[\s\S]*?<\/AUTHORSUMMARY>/,
    `<AUTHORSUMMARY>\n      ${prose}\n  </AUTHORSUMMARY>`,
  );
};

export const buildImportedDocumentXml = ({
  config,
  format,
  sourcePath,
  text,
}: {
  config: ProjectFileConfig;
  format: Exclude<ImportableDocumentFormat, 'xml'>;
  sourcePath: string;
  text: string;
}): string => {
  const title = basenameWithoutExtension(sourcePath);
  const paragraphs = normalizeImportedParagraphs(
    tagPageBreaks(extractPlainTextForImport(text, format)),
  );
  const fallbackParagraphs = paragraphs.length > 0 ? paragraphs : [''];
  const skeleton = buildSkeletonForCatalog(config);

  if (config.schema?.catalogId === 'orlando') {
    return replaceOrlandoBody(replaceOrlandoTitle(skeleton, title), fallbackParagraphs);
  }

  return replaceTeiBody(replaceTeiTitle(skeleton, title), fallbackParagraphs);
};

export const buildDocumentImportPlan = ({
  destinationRoot,
  existingOutputPaths,
  sources,
}: {
  destinationRoot: string;
  existingOutputPaths?: string[];
  sources: DocumentImportSource[];
}): DocumentImportPlanItem[] => {
  const used = new Set((existingOutputPaths ?? []).map((item) => item.replace(/\\/g, '/')));

  return sources.map((source) => {
    const baseOutputPath = joinPath(destinationRoot, replaceExtension(source.relativePath, 'xml'));
    let outputPath = baseOutputPath;
    let suffix = 2;

    while (used.has(outputPath.replace(/\\/g, '/'))) {
      outputPath = joinPath(destinationRoot, outputPathWithSuffix(source.relativePath, suffix));
      suffix += 1;
    }

    used.add(outputPath.replace(/\\/g, '/'));
    return { ...source, outputPath };
  });
};

export const getImportPlanDirectories = (items: DocumentImportPlanItem[]): string[] => {
  const directories = new Set<string>();
  for (const item of items) {
    const dir = dirname(item.outputPath);
    if (dir) directories.add(dir);
  }
  return [...directories].sort((a, b) => splitPath(a).length - splitPath(b).length);
};
