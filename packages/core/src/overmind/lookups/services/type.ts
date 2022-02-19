import { IResult, LookupsEntityType } from '@src/components/entityLookups/types';

export interface IFindParams {
  config?: {[x: string]: any};
  query: string,
  type: LookupsEntityType
}

export default interface ILookupServiceApi {
  find: (params: IFindParams) => Promise<IResult[]>;
  getEntityRoot?: () => string;
  setEntityRoot?: (url: string) => void;
  getSearchRoot?: () => string;
  setSearchRoot?: (url: string) => void;

  setProjectLookupConfig?: ({
    cwrcProjectId,
    projectLogoRoot,
    projectLookupUrl,
  }: {
    cwrcProjectId: string;
    projectLogoRoot: string;
    projectLookupUrl: string;
  }) => Promise<{ [x: string]: any }>;
}
