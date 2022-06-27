import type { IResult } from '../../../components/entityLookups/types';
import ILookupServiceApi, { type IFindParams } from './type';
export default class Geonames implements ILookupServiceApi {
    private readonly axiosInstance;
    private readonly baseURL;
    private readonly MAX_HITS;
    private readonly timeout;
    private readonly username;
    constructor(config: any);
    find({ query }: IFindParams): Promise<IResult[]>;
    private callGeonames;
}
//# sourceMappingURL=geonames.d.ts.map