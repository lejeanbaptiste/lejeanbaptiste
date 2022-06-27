import type { Authority, EntryLink, IResult, LookupsEntityType } from '../../components/entityLookups/types';
import type { EntityTypes } from '../../js/schema/types';
declare type State = {
    isUriValid: boolean;
    manualInput: string;
    query: string;
    results?: Map<Authority, IResult[]>;
    selected?: EntryLink;
    typeEntity: EntityTypes;
    typeLookup: LookupsEntityType;
};
export declare const state: State;
export {};
//# sourceMappingURL=state.d.ts.map