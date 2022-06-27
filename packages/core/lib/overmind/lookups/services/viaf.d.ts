import type { IResult } from '../../../components/entityLookups/types';
import ILookupServiceApi, { type IFindParams } from './type';
export default class Viaf implements ILookupServiceApi {
    private readonly axiosInstance;
    private readonly baseURL;
    private readonly FORMAT;
    private readonly timeout;
    constructor();
    find({ query, type }: IFindParams): Promise<IResult[]>;
    private callVIAF;
}
//# sourceMappingURL=viaf.d.ts.map