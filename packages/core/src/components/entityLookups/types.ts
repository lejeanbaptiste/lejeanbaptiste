import type { DialogLookupType } from '../../js/dialogs/types';
import Entity from '../../js/entities/Entity';

export type NamedEntityType = 'person' | 'place' | 'organization' | 'title' | 'rs';
export type Authority = 'dbpedia' | 'geonames' | 'getty' | 'lgpn' | 'viaf' | 'wikidata';
export type ServiceType = 'nssi' | 'custom';

export interface IAuthorityService {
  config?: {
    [x: string]: any;
    username?: string;
  };
  enabled: boolean;
  entities: { [key: string]: boolean };
  id: Authority;
  name?: string;
  priority: number;
  readonly requireAuth?: boolean;
}

export interface ILookups {
  authorities: { [key: string]: IAuthorityService };
  serviceType: 'nssi' | 'custom';
}

export interface ILookupsConfig {
  authorities: Array<
    | Authority
    | [
        Authority,
        {
          config?: {
            [x: string]: any;
            username?: string;
          };
          enabled?: boolean;
          entities?: Array<[NamedEntityType, boolean]>;
        }
      ]
  >;
  serviceType?: ServiceType;
}

export interface IResult {
  description?: string;
  id: string;
  name: string;
  repository: Authority;
  logo?: string;
  query: string;
  type: string;
  uri: string;
}

export interface EntityLookupDialogProps {
  onClose?: (response?: EntityLink | Pick<EntityLink, 'query' | 'type'>) => void;
  entry?: Entity;
  open: boolean;
  query?: string;
  type?: DialogLookupType;
}

export interface EntryLink {
  id: string;
  uri: string;
  name: string;
  repository: string;
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
