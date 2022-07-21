import type { Authority, IAuthorityService, IResult } from '../../components/entityLookups/types';
import { type IFindParams } from './services/type';
declare class Api {
    private readonly services;
    private currentState;
    private nssi;
    initialize(authorities: {
        [key: string]: IAuthorityService;
    }, { token }: {
        token?: string;
    }): Promise<void>;
    find({ query, type }: IFindParams): Promise<Map<Authority, IResult[]>>;
    useNssi({ query, type }: IFindParams): Promise<void>;
}
export declare const api: Api;
export {};
//# sourceMappingURL=effects.d.ts.map