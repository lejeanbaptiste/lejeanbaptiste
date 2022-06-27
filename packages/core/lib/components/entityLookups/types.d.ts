import type { DialogLookupType } from '../../js/dialogs/types';
import Entity from '../../js/entities/Entity';
export declare type LookupsEntityType = 'person' | 'place' | 'organization' | 'title' | 'rs';
export declare type Authority = 'dbpedia' | 'cwrc' | 'geonames' | 'getty' | 'lgpn' | 'viaf' | 'wikidata';
export interface ILookupServiceEntity {
    enabled: boolean;
    name: LookupsEntityType;
}
export interface ILookupService {
    config?: {
        [x: string]: any;
        username?: string;
    };
    enabled: boolean;
    entities: {
        [key: string]: ILookupServiceEntity;
    };
    id: Authority;
    name?: string;
    priority: number;
}
export interface ILookupServiceConfig {
    config?: {
        [x: string]: any;
        username?: string;
    };
    enabled?: boolean;
    entities?: Array<LookupsEntityType | [LookupsEntityType, {
        enabled: boolean;
    }]>;
    id?: Authority;
    name?: string;
    priority?: number;
}
export interface ILookups {
    authorities: {
        [key: string]: ILookupService;
    };
    showNoLinkButton: boolean;
    showCreateNewButton: boolean;
    showEditButton: boolean;
    entityCollectionsUrl?: string;
    entityFormsRoot?: string;
    collectionsRoot?: string;
    serviceType: 'nssi' | 'custom';
}
export interface ILookupsConfig {
    authorities?: Array<Authority | [Authority, ILookupServiceConfig]>;
    showNoLinkButton: boolean;
    showCreateNewButton: boolean;
    showEditButton: boolean;
    entityCollectionsUrl?: string;
    entityFormsRoot?: string;
    collectionsRoot?: string;
    serviceType: 'nssi' | 'custom';
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
//# sourceMappingURL=types.d.ts.map