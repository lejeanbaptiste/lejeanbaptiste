import type { ProjectFileConfig } from './projectFile';
import { buildSkeletonForCatalog } from './schemaTemplates';
import { resolvePageBreakMarkers, tagPageBreaks } from '@cwrc/leafwriter/pageBreakDetection';

export type ImportableDocumentFormat = 'txt' | 'md' | 'rtf' | 'docx' | 'odt';

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
  if (format === 'md') return stripMarkdownToPlainText(content);
  if (format === 'rtf') return stripRtfToPlainText(content);
  return content;
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
  format: ImportableDocumentFormat;
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
