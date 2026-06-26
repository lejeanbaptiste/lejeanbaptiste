import type { Types } from '@cwrc/leafwriter';
import { DEFAULT_TEI_CSS } from './defaultTeiCss';
import { joinProjectPath, type ProjectSchemaConfig } from './projectFile';
import { fromLocalFileUrl, isLocalFileUrl, toLocalFileUrl } from './localFileUrl';

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
  const existingLocal = fromLocalFileUrl(href);
  if (existingLocal) return [existingLocal];

  if (/^https?:\/\//i.test(href)) {
    // Remote schema declaration — only try project-local fallbacks below.
    const candidates: string[] = [];
    if (projectRoot) {
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
    }
    return prioritizeSchemaPaths(candidates);
  }

  const candidates: string[] = [resolveRelativePath(filePath, href)];

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
    if (cssHref) {
      const existingCss = fromLocalFileUrl(cssHref);
      if (existingCss) {
        try {
          await window.electronAPI!.readFile(existingCss);
          return cssHref;
        } catch {
          // fall through
        }
      } else if (!/^https?:\/\//i.test(cssHref)) {
        try {
          const cssPath = resolveRelativePath(filePath, cssHref);
          await window.electronAPI!.readFile(cssPath);
          return toLocalFileUrl(cssPath);
        } catch {
          // fall through
        }
      } else {
        return cssHref;
      }
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

const makeProjectSchema = async (
  schemaPath: string,
  content: string,
  filePath: string,
  projectRoot?: string | null,
): Promise<Types.Schema> => {
  await window.electronAPI!.readFile(schemaPath);
  const rngUrl = toLocalFileUrl(schemaPath);
  const cssUrl = await findLocalCssUrl(projectRoot, filePath, content, schemaPath);

  const schemaName =
    schemaPath
      .split(/[/\\]/)
      .pop()
      ?.replace(/\.(rng|rnc|xsd)$/i, '') ?? 'Project schema';

  return {
    id: toSchemaId(schemaPath),
    name: schemaName.slice(0, 20),
    mapping: 'tei',
    rng: [rngUrl],
    css: [cssUrl],
    editable: true,
  };
};

const buildSchemaFromFile = async (
  schemaPath: string,
  content: string,
  filePath: string,
  href: string,
  modelMatch: RegExpMatchArray,
  projectRoot?: string | null,
) => {
  const schema = await makeProjectSchema(schemaPath, content, filePath, projectRoot);
  const rngUrl = schema.rng[0];
  const cssUrl = schema.css[0];

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

const discoverProjectSchema = async (
  projectRoot: string,
  content: string,
  filePath: string,
): Promise<{ content: string; schemas: Types.Schema[] } | null> => {
  const schemaDir = joinPath(projectRoot, 'schema');

  try {
    const entries = await window.electronAPI!.readDirectory(schemaDir, { allFiles: true });
    const rngFiles = prioritizeSchemaPaths(
      entries
        .filter((entry) => !entry.isDirectory && /\.(rng|rnc)$/i.test(entry.name))
        .map((entry) => entry.path),
    );

    for (const schemaPath of rngFiles) {
      try {
        const schema = await makeProjectSchema(schemaPath, content, filePath, projectRoot);
        const pi = `<?xml-model href="${schema.rng[0]}" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>`;
        const xmlDecl = content.match(/<\?xml[^?]*\?>/i);
        const updated = xmlDecl
          ? content.replace(xmlDecl[0], `${xmlDecl[0]}\n${pi}`)
          : `${pi}\n${content}`;
        const modelMatch = updated.match(/<\?xml-model\s+([^?]+)\?>/i);
        if (!modelMatch) continue;

        return buildSchemaFromFile(
          schemaPath,
          updated,
          filePath,
          schema.rng[0],
          modelMatch,
          projectRoot,
        );
      } catch {
        // try next schema file
      }
    }
  } catch {
    return null;
  }

  return null;
};

const applyProjectSchemaConfig = async (
  projectRoot: string,
  projectSchema: ProjectSchemaConfig,
  content: string,
  filePath: string,
): Promise<{ content: string; schemas: Types.Schema[] } | null> => {
  const schemaPath = joinProjectPath(projectRoot, projectSchema.rng);

  try {
    await window.electronAPI!.readFile(schemaPath);
  } catch {
    return null;
  }

  const schema = await makeProjectSchema(schemaPath, content, filePath, projectRoot);
  const rngUrl = schema.rng[0];
  let updated = content;
  let modelMatch = content.match(/<\?xml-model\s+([^?]+)\?>/i);

  if (!modelMatch) {
    const pi = `<?xml-model href="${rngUrl}" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>`;
    const xmlDecl = content.match(/<\?xml[^?]*\?>/i);
    updated = xmlDecl
      ? content.replace(xmlDecl[0], `${xmlDecl[0]}\n${pi}`)
      : `${pi}\n${content}`;
    modelMatch = updated.match(/<\?xml-model\s+([^?]+)\?>/i);
  }

  if (modelMatch) {
    const href = parsePiAttributes(modelMatch[1]).href ?? '';
    if (href !== rngUrl) {
      updated = updated.replace(modelMatch[0], replacePiHref(modelMatch[0], href, rngUrl));
    }
    updated = ensureStylesheetPi(updated, schema.css[0] ?? DEFAULT_TEI_CSS);
  }

  return { content: updated, schemas: [schema] };
};

/** Resolve xml-model / xml-stylesheet paths against the open file and register local schemas. */
export const prepareDesktopDocument = async (
  filePath: string,
  content: string,
  projectRoot?: string | null,
  projectSchema?: ProjectSchemaConfig | null,
): Promise<{ content: string; schemas: Types.Schema[] }> => {
  if (!window.electronAPI) return { content, schemas: [] };

  if (projectRoot && projectSchema?.rng) {
    const fromProject = await applyProjectSchemaConfig(
      projectRoot,
      projectSchema,
      content,
      filePath,
    );
    if (fromProject) return fromProject;
  }

  const modelMatch = content.match(/<\?xml-model\s+([^?]+)\?>/i);
  if (!modelMatch) {
    if (projectRoot) {
      const discovered = await discoverProjectSchema(projectRoot, content, filePath);
      if (discovered) return discovered;
    }
    return { content, schemas: [] };
  }

  const modelAttrs = parsePiAttributes(modelMatch[1]);
  const href = modelAttrs.href;
  if (!href) return { content, schemas: [] };

  if (isLocalFileUrl(href)) {
    const localPath = fromLocalFileUrl(href);
    if (localPath) {
      try {
        await window.electronAPI.readFile(localPath);
        const schema = await makeProjectSchema(localPath, content, filePath, projectRoot);
        return { content, schemas: [schema] };
      } catch {
        // Fall through and try to re-resolve if the file moved.
      }
    }
  }

  const candidates = getLocalSchemaCandidates(filePath, href, projectRoot);

  for (const schemaPath of candidates) {
    try {
      return await buildSchemaFromFile(schemaPath, content, filePath, href, modelMatch, projectRoot);
    } catch {
      // try next candidate
    }
  }

  if (projectRoot) {
    const discovered = await discoverProjectSchema(projectRoot, content, filePath);
    if (discovered) return discovered;
  }

  return { content, schemas: [] };
};
