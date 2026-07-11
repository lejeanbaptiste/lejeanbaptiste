/**
 * GitHub-published authority pack registry (authoritypacks release assets).
 */

export type { AuthorityLifecycleProfile } from './authorityLifecycleTypes';

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

export interface AuthorityPacksManifestBundle {
  sha256: string;
  installedAt: string;
}

export interface AuthorityPacksManifest {
  bundleVersion: string;
  compilePolicyVersion: string;
  /** Installed bundle tarballs keyed by bundle id, so per-profile bundles coexist. */
  bundles: Record<string, AuthorityPacksManifestBundle>;
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

const SHA256_RE = /^[0-9a-f]{64}$/;

export const parsePacksManifest = (raw: string): AuthorityPacksManifest | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<AuthorityPacksManifest> & { tarballSha256?: string };
    if (typeof parsed.bundleVersion !== 'string' || !parsed.bundleVersion) return null;
    if (typeof parsed.compilePolicyVersion !== 'string') return null;
    if (typeof parsed.installedAt !== 'string') return null;

    // Legacy single-bundle manifests recorded one tarballSha256; those predate
    // multi-profile support, when only the chinese bundle existed.
    if (typeof parsed.tarballSha256 === 'string') {
      if (!SHA256_RE.test(parsed.tarballSha256)) return null;
      return {
        bundleVersion: parsed.bundleVersion,
        compilePolicyVersion: parsed.compilePolicyVersion,
        bundles: { chinese: { sha256: parsed.tarballSha256, installedAt: parsed.installedAt } },
        installedAt: parsed.installedAt,
      };
    }

    if (!parsed.bundles || typeof parsed.bundles !== 'object') return null;
    for (const bundle of Object.values(parsed.bundles)) {
      if (typeof bundle?.sha256 !== 'string' || !SHA256_RE.test(bundle.sha256)) return null;
      if (typeof bundle.installedAt !== 'string') return null;
    }
    return parsed as AuthorityPacksManifest;
  } catch {
    return null;
  }
};
