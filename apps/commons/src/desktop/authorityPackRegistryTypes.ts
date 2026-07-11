/**
 * GitHub-published authority pack registry (authoritypacks release assets).
 */

/** Latest published authoritypacks release assets. */
export const AUTHORITY_PACK_REGISTRY = {
  releaseDownloadBaseUrl: 'https://github.com/lejeanbaptiste/authoritypacks/releases/latest/download',
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
  defaultBundleId?: 'chinese' | 'japanese' | 'tibetan';
  bundles?: AuthorityPacksIndexBundle[];
  licenses?: { cbdb?: string; dila?: string };
  attribution?: { cbdb?: string; dila?: string };
  upstream?: {
    cbdb?: { version: string; sqliteSha256?: string };
    dila?: { commit: string; versionLabel?: string };
  };
}

export interface AuthorityPacksIndexBundle {
  id: 'chinese' | 'japanese' | 'tibetan';
  fileName: string;
  bytes: number;
  sha256: string;
  pathPrefix?: string;
  fileCount?: number;
  files: AuthorityPacksIndexFile[];
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
  return `${registry.releaseDownloadBaseUrl}/${relativePath.replace(/^\//, '')}`;
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
    if (!Array.isArray(parsed.bundles) || parsed.bundles.length === 0) return null;
    for (const bundle of parsed.bundles) {
      if (
        !bundle ||
        (bundle.id !== 'chinese' && bundle.id !== 'japanese' && bundle.id !== 'tibetan')
      ) {
        return null;
      }
      if (typeof bundle.fileName !== 'string' || typeof bundle.sha256 !== 'string') return null;
      if (!Array.isArray(bundle.files) || bundle.files.length === 0) return null;
      for (const file of bundle.files) {
        if (typeof file?.path !== 'string' || typeof file?.sha256 !== 'string') return null;
      }
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
