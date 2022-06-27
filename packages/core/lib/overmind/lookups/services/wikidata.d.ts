import type { IResult } from '../../../components/entityLookups/types';
import ILookupServiceApi, { type IFindParams } from './type';
export default class Wikidata implements ILookupServiceApi {
    private readonly axiosInstance;
    private readonly baseURL;
    private readonly FORMAT;
    private readonly LANGUAGE;
    private readonly timeout;
    constructor();
    find({ query, type }: IFindParams): Promise<IResult[]>;
    private callWikidata;
}
//# sourceMappingURL=wikidata.d.ts.map