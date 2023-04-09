import type { AuthorityLookupResult, NamedEntityType } from '../../../dialogs/entityLookups/types';

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
    settings?: AuthorityLookupSettings
  ) => Promise<AuthorityLookupResult[]>;
}
