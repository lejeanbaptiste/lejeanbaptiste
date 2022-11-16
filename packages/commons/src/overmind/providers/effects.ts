import { SupportedProviderIds } from '@src/config';
import type { ProviderId, ProviderService } from '../../services/types';

export const loadModule = async (providerId: ProviderId): Promise<ProviderService | null> => {
  if (!SupportedProviderIds.includes(providerId)) return null;

  if (providerId === 'github') return (await import('../../services/github')).provider;
  if (providerId === 'gitlab') return (await import('../../services/gitlab')).provider;
  if (providerId === 'orcid') return (await import('../../services/orcid')).provider;

  return null;
};
