import { type IResult } from '../../../components/entityLookups/types';
import ILookupServiceApi, { type IFindParams } from './type';
export default class Getty implements ILookupServiceApi {
    private readonly axiosInstance;
    private readonly baseURL;
    private readonly FORMAT;
    private readonly MAX_HITS;
    private readonly timeout;
    constructor();
    find({ query, type }: IFindParams): Promise<IResult[]>;
    private getEntitySourceURI;
    private callGetty;
}
//# sourceMappingURL=getty.d.ts.map