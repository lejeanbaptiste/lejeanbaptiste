import type { IResult, LookupsEntityType } from '../../../components/entityLookups/types';

export interface IFindParams {
  query: string;
  type: LookupsEntityType;
}

export default interface ILookupServiceApi {
  find: (params: IFindParams) => Promise<IResult[]>;
}
