import type { LookUpResult, NamedEntityType } from '../../../dialogs/entityLookups/types';

export interface LookUpFindProps {
  query: string;
  type: NamedEntityType;
}

export default interface LookupServiceApi {
  find: (params: LookUpFindProps) => Promise<LookUpResult[]>;
}
