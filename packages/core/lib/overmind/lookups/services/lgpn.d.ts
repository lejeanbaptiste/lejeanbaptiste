import type { IResult } from '../../../components/entityLookups/types';
import ILookupServiceApi, { type IFindParams } from './type';
export default class Lgpn implements ILookupServiceApi {
    private readonly axiosInstance;
    private readonly baseURL;
    private readonly FORMAT;
    private readonly timeout;
    constructor();
    find({ query, type }: IFindParams): Promise<IResult[]>;
    private callLGPN;
}
//# sourceMappingURL=lgpn.d.ts.map