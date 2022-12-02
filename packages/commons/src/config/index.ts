export { schemas } from './schemas';

// export const SupportedProviderIds = ['github', 'gitlab', 'orcid'] as const;
export const SupportedProviderIds = ['github', 'orcid'] as const;

export const SupportedStorageProviders = ['github'];

export const RECENT_DOCUMENTS_LIMIT = 8;

export const AUTOSAVE_TIMEOUT = 60_000;
export const AUTOSAVE_TIMEOUT_RETRY = 10_000;
