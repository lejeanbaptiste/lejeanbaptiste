import { type IResult } from '../../../components/entityLookups/types';
import ILookupServiceApi, { type IFindParams } from './type';
export default class Cwrc implements ILookupServiceApi {
    private readonly axiosInstance;
    private readonly baseURL;
    private readonly LIMIT;
    private readonly timeout;
    cwrcProjectId: string;
    entityRoot: string;
    page: number;
    projects: {
        [x: string]: any;
    };
    projectLogoRoot: string;
    searchRoot: string;
    constructor();
    setEntityRoot(url: string): void;
    getEntityRoot(): string;
    setSearchRoot(url: string): void;
    getSearchRoot(): string;
    find({ query, type }: IFindParams): Promise<IResult[]>;
    private callCWRC;
    /**
     * Set all the properties necessary for the project lookup, then perform the lookup
     * @param {Object} config
     * @param {String} projectLogoRoot The root directory that project logos are located in
     * @param {String} projectLookupUrl The actual url for the lookup
     * @param {String} cwrcProjectId The ID assigned to the CWRC Commons project
     * @returns {Object} The projects (namespace and logo)
     */
    setProjectLookupConfig(config: {
        cwrcProjectId: string;
        projectLogoRoot: string;
        projectLookupUrl: string;
    }): Promise<{
        [x: string]: any;
    }>;
    doProjectLookup: (url: string) => Promise<{
        [x: string]: any;
    }>;
    private parseProjectsData;
}
//# sourceMappingURL=cwrc.d.ts.map