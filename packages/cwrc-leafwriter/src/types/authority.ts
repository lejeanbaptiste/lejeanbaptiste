import { z } from 'zod';
import Entity from '../js/entities/Entity';

export const namedEntityTypes = [
  'person',
  'place',
  'organization',
  'work',
  'thing',
  'concept',
  'citation',
] as const;
export const namedEntityTypesSchema = z.enum(namedEntityTypes);
export type NamedEntityType = z.infer<typeof namedEntityTypesSchema>;

export const authorities = [
  'dbpedia',
  'geonames',
  'getty',
  'lincs',
  'viaf',
  'wikidata',
  'gnd',
] as const;
export const authoritySchema = z.enum(authorities);
export type Authority = z.infer<typeof authoritySchema>;

export type LookupService = 'LINCS' | 'custom';
export type LookupServiceType = 'API' | 'TEI-FILE';

export interface AuthorityLookupParams {
  query: string;
  type: NamedEntityType;
}

export interface AuthorityLookupResult {
  authority: Authority | (string & {});
  description?: string;
  entityType: NamedEntityType;
  label: string;
  query: string;
  uri: string;
}

export interface AuthorityServiceBase {
  readonly id: string;
  name: string;
  entities: Partial<Record<NamedEntityType, boolean>>;
  serviceSource: LookupService;
  serviceType: LookupServiceType;
  priority?: number;
  disabled?: boolean;
}

export interface LincsAuthorityService extends AuthorityServiceBase {
  readonly id: Authority;
  serviceSource: 'LINCS';
  serviceType: 'API';
}

export interface AuthorityServiceCustom extends AuthorityServiceBase {
  find: (params: AuthorityLookupParams) => Promise<AuthorityLookupResult[]>;
  serviceSource: 'custom';
}

export type AuthorityService = LincsAuthorityService | AuthorityServiceCustom;

export type AuthorityServices = Record<string, AuthorityService>;

export type AuthorityServiceConfig = AuthorityServiceBase['id'] | AuthorityService;

export interface EntityLookupDialogProps {
  onClose?: (response?: EntityLink | Pick<EntityLink, 'query' | 'type'>) => void;
  entry?: Entity;
  open: boolean;
  query?: string;
  type?: NamedEntityType;
}

export interface EntryLink {
  authority: Authority | (string & {});
  entityType: NamedEntityType;
  label: string;
  uri: string;
}

export interface EntityLink {
  id: string;
  name: string;
  properties: {
    lemma: string;
    uri: string;
  };
  query: string;
  repository: string;
  type: string;
  uri: string;
}
