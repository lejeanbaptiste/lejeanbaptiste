import type { AuthorityLookupResult, NamedEntityType } from '../../../dialogs/entityLookups/types';
import { z } from 'zod';

export interface AuthorityLookupParams {
  query: string;
  type: NamedEntityType;
}

export interface AuthorityLookupSettings {
  [key: string]: any;
  username?: string;
}

export default interface LookupServiceApi {
  find: (
    params: AuthorityLookupParams,
    settings?: AuthorityLookupSettings,
  ) => Promise<AuthorityLookupResult[]>;
}

export const LINCS_API_ReconcileResultSchema = z.array(
  z.object({
    authority: z.string(),
    matches: z.array(
      z.object({
        description: z.string().optional(),
        label: z.string(),
        uri: z.string().url(),
      }),
    ),
  }),
);
