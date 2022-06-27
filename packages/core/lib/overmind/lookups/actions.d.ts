import { Context } from '..';
import type { EntityLink, EntryLink } from '../../components/entityLookups/types';
import type { DialogLookupType } from '../../js/dialogs/types';
import Entity from '../../js/entities/Entity';
import type { EntityTypes } from '../../js/schema/types';
export declare const initiate: ({ state: { lookups }, actions }: Context, { entry, type }: {
    entry?: Entity;
    type: DialogLookupType;
}) => void;
export declare const setType: ({ state: { lookups } }: Context, type: EntityTypes) => void;
export declare const search: ({ state: { lookups }, effects }: Context, query: string) => Promise<any[] | Map<import("../../components/entityLookups/types").Authority, import("../../components/entityLookups/types").IResult[]>>;
export declare const processSelected: ({ state: { lookups } }: Context) => EntityLink;
export declare const setSelected: ({ state: { lookups } }: Context, link?: EntryLink) => void;
export declare const setQuery: ({ state: { lookups } }: Context, value: string) => void;
export declare const setManualInput: ({ state: { lookups } }: Context, value: string) => void;
export declare const reset: ({ state: { lookups } }: Context) => void;
//# sourceMappingURL=actions.d.ts.map