export { schemas } from './schemas';

// export const SupportedProviderIds = ['github', 'gitlab', 'orcid'] as const;
export const SupportedProviderIds = ['github', 'orcid'] as const;

export const supportedIdentityProviders = ['github', 'orcid'];
export const supportedStorageProviders = ['github'];

export const RECENT_DOCUMENTS_LIMIT = 8;

export const SAVE_CONFLICT_RETRY_DELAY = 10_000;
