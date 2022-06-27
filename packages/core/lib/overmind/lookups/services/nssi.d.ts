import ILookupServiceApi, { type IFindParams } from './type';
export default class Nssi implements ILookupServiceApi {
    private readonly axiosInstance;
    private readonly baseURL;
    private readonly timeout;
    private readonly token;
    constructor(config: any);
    find({ query, type }: IFindParams): Promise<any[]>;
}
//# sourceMappingURL=nssi.d.ts.map