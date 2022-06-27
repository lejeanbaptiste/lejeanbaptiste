import type { IResult } from '../../../components/entityLookups/types';
import ILookupServiceApi, { type IFindParams } from './type';
export default class Dbpedia implements ILookupServiceApi {
    private readonly axiosInstance;
    private readonly baseURL;
    private readonly FORMAT;
    private readonly MAX_HITS;
    private readonly timeout;
    constructor();
    find({ query, type }: IFindParams): Promise<IResult[]>;
    private callDBPedia;
}
//# sourceMappingURL=dbpedia.d.ts.map