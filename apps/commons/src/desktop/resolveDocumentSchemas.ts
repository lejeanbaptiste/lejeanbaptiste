import type { Types } from '@cwrc/leafwriter';
import { DEFAULT_TEI_CSS } from './defaultTeiCss';
import { toLocalFileUrl } from './localFileUrl';

const parsePiAttributes = (data: string): Record<string, string> => {
  const attrs: Record<string, string> = {};
  const re = /(\w+)=["']([^"']*)["']/g;
  let match = re.exec(data);
  while (match) {
    attrs[match[1]] = match[2];
    match = re.exec(data);
  }
  return attrs;
};

const resolveRelativePath = (filePath: string, href: string): string => {
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('/') || /^[A-Za-z]:[\\/]/.test(href)) return href;

  const separator = filePath.includes('\\') ? '\\' : '/';
  const dir = filePath.slice(0, Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')));
  const segments = [...dir.split(/[/\\]/), ...href.split(/[/\\]/)];
  const resolved: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') resolved.pop();
    else resolved.push(segment);
  }

  return resolved.join(separator);
};

const toSchemaId = (schemaPath: string) => {
  const base =
    schemaPath
      .split(/[/\\]/)
      .pop()
      ?.replace(/\.(rng|rnc|xsd)$/i, '') ?? 'project';
  return `project-${base.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
};

const replacePiHref = (pi: string, href: string, nextHref: string) =>
  pi.replace(`href="${href}"`, `href="${nextHref}"`).replace(`href='${href}'`, `href='${nextHref}'`);

const joinPath = (root: string, ...parts: string[]) => {
  const separator = root.includes('\\') ? '\\' : '/';
  return [root, ...parts].join(separator);
};

const prioritizeSchemaPaths = (paths: string[]) => {
  const rng = paths.filter((p) => /\.rng$/i.test(p));
  const rnc = paths.filter((p) => /\.rnc$/i.test(p));
  const rest = paths.filter((p) => !/\.rng$/i.test(p) && !/\.rnc$/i.test(p));
  return [...new Set([...rng, ...rnc, ...rest])];
};

const getLocalSchemaCandidates = (filePath: string, href: string, projectRoot?: string | null) => {
  const candidates: string[] = [];

  if (!/^https?:\/\//i.test(href)) {
    candidates.push(resolveRelativePath(filePath, href));
  }

  if (!projectRoot) return prioritizeSchemaPaths(candidates);

  const filename = href.split('/').pop();
  if (filename) {
    if (/\.rnc$/i.test(filename)) {
      candidates.push(joinPath(projectRoot, 'schema', filename.replace(/\.rnc$/i, '.rng')));
    }
    candidates.push(joinPath(projectRoot, 'schema', filename));
    candidates.push(joinPath(projectRoot, 'schemas', filename));
  }

  if (href.includes('cbeta-org/xml-p5') || href.includes('cbeta-p5')) {
    candidates.push(joinPath(projectRoot, 'schema', 'cbeta-p5.rng'));
    candidates.push(joinPath(projectRoot, 'schema', 'cbeta-p5.rnc'));
  }

  return prioritizeSchemaPaths(candidates);
};

const findCssFilesInProject = async (projectRoot: string): Promise<string[]> => {
  const schemaDir = joinPath(projectRoot, 'schema');

  try {
    const entries = await window.electronAPI!.readDirectory(schemaDir, { allFiles: true });
    const fromDir = entries
      .filter((e) => !e.isDirectory && /\.css$/i.test(e.name))
      .map((e) => e.path);
    if (fromDir.length > 0) return fromDir;
  } catch {
    // fall through
  }

  const found: string[] = [];
  for (const name of ['cbeta-p5.css', 'cbeta.css', 'tei.css']) {
    const cssPath = joinPath(schemaDir, name);
    try {
      await window.electronAPI!.readFile(cssPath);
      found.push(cssPath);
    } catch {
      // try next
    }
  }
  return found;
};

const pickProjectCss = (cssFiles: string[], schemaPath?: string): string | null => {
  if (cssFiles.length === 0) return null;

  const schemaBase = schemaPath
    ?.split(/[/\\]/)
    .pop()
    ?.replace(/\.(rng|rnc|xsd)$/i, '');

  if (schemaBase) {
    const exact = cssFiles.find((p) => p.endsWith(`${schemaBase}.css`));
    if (exact) return exact;
  }

  for (const preferred of ['cbeta.css', 'tei.css', 'cbeta-p5.css']) {
    const match = cssFiles.find((p) => p.endsWith(`/${preferred}`) || p.endsWith(`\\${preferred}`));
    if (match) return match;
  }

  return cssFiles[0];
};

const findLocalCssUrl = async (
  projectRoot: string | null | undefined,
  filePath: string,
  content: string,
  schemaPath?: string,
): Promise<string> => {
  if (projectRoot) {
    const projectCss = await findCssFilesInProject(projectRoot);
    const picked = pickProjectCss(projectCss, schemaPath);
    if (picked) return toLocalFileUrl(picked);
  }

  const cssMatch = content.match(/<\?xml-stylesheet\s+([^?]+)\?>/i);
  if (cssMatch) {
    const cssHref = parsePiAttributes(cssMatch[1]).href;
    if (cssHref && !/^https?:\/\//i.test(cssHref)) {
      try {
        const cssPath = resolveRelativePath(filePath, cssHref);
        await window.electronAPI!.readFile(cssPath);
        return toLocalFileUrl(cssPath);
      } catch {
        // fall through
      }
    } else if (cssHref) {
      return cssHref;
    }
  }

  return DEFAULT_TEI_CSS;
};

const ensureStylesheetPi = (content: string, cssUrl: string) => {
  if (/<\?xml-stylesheet/i.test(content)) return content;

  const pi = `<?xml-stylesheet href="${cssUrl}" type="text/css"?>`;
  const modelMatch = content.match(/<\?xml-model\s+[^?]+\?>/i);
  if (modelMatch) {
    return content.replace(modelMatch[0], `${modelMatch[0]}\n${pi}`);
  }
  return `${pi}\n${content}`;
};

const buildSchemaFromFile = async (
  schemaPath: string,
  content: string,
  filePath: string,
  href: string,
  modelMatch: RegExpMatchArray,
  projectRoot?: string | null,
) => {
  await window.electronAPI!.readFile(schemaPath);
  const rngUrl = toLocalFileUrl(schemaPath);
  const cssUrl = await findLocalCssUrl(projectRoot, filePath, content, schemaPath);

  const schemaName =
    schemaPath
      .split(/[/\\]/)
      .pop()
      ?.replace(/\.(rng|rnc|xsd)$/i, '') ?? 'Project schema';

  const schema: Types.Schema = {
    id: toSchemaId(schemaPath),
    name: schemaName.slice(0, 20),
    mapping: 'tei',
    rng: [rngUrl],
    css: [cssUrl],
    editable: true,
  };

  let updated = content.replace(modelMatch[0], replacePiHref(modelMatch[0], href, rngUrl));

  const cssMatch = content.match(/<\?xml-stylesheet\s+([^?]+)\?>/i);
  if (cssMatch) {
    const cssHref = parsePiAttributes(cssMatch[1]).href;
    if (cssHref && cssUrl.startsWith('crcao://')) {
      updated = updated.replace(cssMatch[0], replacePiHref(cssMatch[0], cssHref, cssUrl));
    } else if (cssHref && cssHref !== cssUrl && cssUrl.startsWith('https://')) {
      updated = updated.replace(cssMatch[0], replacePiHref(cssMatch[0], cssHref, cssUrl));
    }
  }

  updated = ensureStylesheetPi(updated, cssUrl);

  return { content: updated, schemas: [schema] };
};

/** Resolve xml-model / xml-stylesheet paths against the open file and register local schemas. */
export const prepareDesktopDocument = async (
  filePath: string,
  content: string,
  projectRoot?: string | null,
): Promise<{ content: string; schemas: Types.Schema[] }> => {
  if (!window.electronAPI) return { content, schemas: [] };

  const modelMatch = content.match(/<\?xml-model\s+([^?]+)\?>/i);
  if (!modelMatch) return { content, schemas: [] };

  const modelAttrs = parsePiAttributes(modelMatch[1]);
  const href = modelAttrs.href;
  if (!href) return { content, schemas: [] };

  const candidates = getLocalSchemaCandidates(filePath, href, projectRoot);

  for (const schemaPath of candidates) {
    try {
      return await buildSchemaFromFile(schemaPath, content, filePath, href, modelMatch, projectRoot);
    } catch {
      // try next candidate
    }
  }

  return { content, schemas: [] };
};
