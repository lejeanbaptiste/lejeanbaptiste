import fs from 'fs/promises';
import path from 'path';

export const PROJECT_FILE_NAME = 'jean-baptiste.project.json';

export interface ProjectSchemaConfig {
  rng: string;
  css?: string;
}

export interface ProjectFileConfig {
  version: 1;
  name: string;
  schema?: ProjectSchemaConfig;
}

export interface ProjectBundle {
  config: ProjectFileConfig;
  projectFilePath: string;
  rootPath: string;
}

const normalizeConfig = (raw: Partial<ProjectFileConfig>, rootPath: string): ProjectFileConfig => ({
  version: 1,
  name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : path.basename(rootPath),
  schema:
    raw.schema && typeof raw.schema.rng === 'string' && raw.schema.rng.trim()
      ? {
          rng: raw.schema.rng,
          css: typeof raw.schema.css === 'string' ? raw.schema.css : undefined,
        }
      : undefined,
});

const detectSchema = async (rootPath: string): Promise<ProjectSchemaConfig | undefined> => {
  const schemaDir = path.join(rootPath, 'schema');

  try {
    const entries = await fs.readdir(schemaDir, { withFileTypes: true });
    const rng = entries.find((entry) => !entry.isDirectory() && /\.rng$/i.test(entry.name));
    if (rng) {
      const css = entries.find(
        (entry) =>
          !entry.isDirectory() &&
          /\.css$/i.test(entry.name) &&
          entry.name.startsWith(rng.name.replace(/\.rng$/i, '')),
      );
      return {
        rng: `schema/${rng.name}`,
        css: css ? `schema/${css.name}` : undefined,
      };
    }

    const rnc = entries.find((entry) => !entry.isDirectory() && /\.rnc$/i.test(entry.name));
    if (rnc) {
      const rngName = rnc.name.replace(/\.rnc$/i, '.rng');
      const hasRng = entries.some((entry) => entry.name === rngName);
      return {
        rng: `schema/${hasRng ? rngName : rnc.name}`,
        css: entries.find((e) => e.name === 'cbeta.css') ? 'schema/cbeta.css' : undefined,
      };
    }
  } catch {
    // no schema directory
  }

  return undefined;
};

export const loadOrCreateProject = async (rootPath: string): Promise<ProjectBundle> => {
  const projectFilePath = path.join(rootPath, PROJECT_FILE_NAME);

  try {
    const raw = await fs.readFile(projectFilePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ProjectFileConfig>;
    const config = normalizeConfig(parsed, rootPath);

    if (!config.schema) {
      config.schema = await detectSchema(rootPath);
      await fs.writeFile(projectFilePath, JSON.stringify(config, null, 2), 'utf-8');
    }

    return { rootPath, projectFilePath, config };
  } catch {
    const config: ProjectFileConfig = {
      version: 1,
      name: path.basename(rootPath),
      schema: await detectSchema(rootPath),
    };
    await fs.writeFile(projectFilePath, JSON.stringify(config, null, 2), 'utf-8');
    return { rootPath, projectFilePath, config };
  }
};

export const loadProjectFile = async (projectFilePath: string): Promise<ProjectBundle | null> => {
  try {
    const stat = await fs.stat(projectFilePath);
    if (!stat.isFile()) return null;

    const rootPath = path.dirname(projectFilePath);
    const raw = await fs.readFile(projectFilePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ProjectFileConfig>;
    const config = normalizeConfig(parsed, rootPath);

    if (config.schema?.rng) {
      try {
        await fs.stat(path.join(rootPath, config.schema.rng));
      } catch {
        config.schema = await detectSchema(rootPath);
        await fs.writeFile(projectFilePath, JSON.stringify(config, null, 2), 'utf-8');
      }
    } else {
      config.schema = await detectSchema(rootPath);
      await fs.writeFile(projectFilePath, JSON.stringify(config, null, 2), 'utf-8');
    }

    return { rootPath, projectFilePath, config };
  } catch {
    return null;
  }
};
