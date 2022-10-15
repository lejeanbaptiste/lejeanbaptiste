import type { IResult, NamedEntityType } from '../../../dialogs/entityLookups/types';

export interface IFindParams {
  query: string;
  type: NamedEntityType;
}

export default interface ILookupServiceApi {
  find: (params: IFindParams) => Promise<IResult[]>;
}
