/**
 * GitLab-published authority pack registry (ljb-authorities CI artifacts).
 */

/** Latest successful build-packs job on main (public project). */
export const AUTHORITY_PACK_REGISTRY = {
  gitlabHost: 'https://gitlab.huma-num.fr',
  projectPath: 'dmorgan1/ljb-authorities',
  branch: 'main',
  jobName: 'build-packs',
  distPrefix: 'dist',
} as const;

export const PACKS_INDEX_FILENAME = 'packs-index.json';
export const PACKS_MANIFEST_FILENAME = 'packs.manifest.json';

export interface AuthorityPacksIndexFile {
  path: string;
  bytes: number;
  sha256: string;
}

export interface AuthorityPacksIndex {
  schemaVersion: number;
  bundleVersion: string;
  compilePolicyVersion: string;
  builtAt: string;
  tarball: {
    fileName: string;
    bytes: number;
    sha256: string;
  };
  files: AuthorityPacksIndexFile[];
  licenses?: { cbdb?: string; dila?: string };
  attribution?: { cbdb?: string; dila?: string };
  upstream?: {
    cbdb?: { version: string; sqliteSha256?: string };
    dila?: { commit: string; versionLabel?: string };
  };
}

export interface AuthorityPacksManifest {
  bundleVersion: string;
  compilePolicyVersion: string;
  tarballSha256: string;
  installedAt: string;
}

export const artifactRawUrl = (
  registry: typeof AUTHORITY_PACK_REGISTRY,
  relativePath: string,
): string => {
  const encoded = registry.projectPath.split('/').map(encodeURIComponent).join('/');
  const filePath = `${registry.distPrefix}/${relativePath}`.replace(/^\//, '');
  return `${registry.gitlabHost}/${encoded}/-/jobs/artifacts/${encodeURIComponent(registry.branch)}/raw/${filePath}?job=${encodeURIComponent(registry.jobName)}`;
};

export const packsIndexUrl = (registry = AUTHORITY_PACK_REGISTRY): string =>
  artifactRawUrl(registry, PACKS_INDEX_FILENAME);

export const tarballArtifactUrl = (
  fileName: string,
  registry = AUTHORITY_PACK_REGISTRY,
): string => artifactRawUrl(registry, fileName);

export const parsePacksIndex = (raw: string): AuthorityPacksIndex | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<AuthorityPacksIndex>;
    if (parsed.schemaVersion !== 1) return null;
    if (typeof parsed.bundleVersion !== 'string' || !parsed.bundleVersion) return null;
    if (typeof parsed.compilePolicyVersion !== 'string') return null;
    if (!parsed.tarball?.fileName || !parsed.tarball?.sha256) return null;
    if (!Array.isArray(parsed.files) || parsed.files.length === 0) return null;
    for (const file of parsed.files) {
      if (typeof file?.path !== 'string' || typeof file?.sha256 !== 'string') return null;
    }
    return parsed as AuthorityPacksIndex;
  } catch {
    return null;
  }
};

export const parsePacksManifest = (raw: string): AuthorityPacksManifest | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<AuthorityPacksManifest>;
    if (typeof parsed.bundleVersion !== 'string' || !parsed.bundleVersion) return null;
    if (typeof parsed.compilePolicyVersion !== 'string') return null;
    if (typeof parsed.tarballSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(parsed.tarballSha256)) {
      return null;
    }
    if (typeof parsed.installedAt !== 'string') return null;
    return parsed as AuthorityPacksManifest;
  } catch {
    return null;
  }
};
