import type { IResult, NamedEntityType } from '../../../components/entityLookups/types';
export interface IFindParams {
    query: string;
    type: NamedEntityType;
}
export default interface ILookupServiceApi {
    find: (params: IFindParams) => Promise<IResult[]>;
}
//# sourceMappingURL=type.d.ts.map