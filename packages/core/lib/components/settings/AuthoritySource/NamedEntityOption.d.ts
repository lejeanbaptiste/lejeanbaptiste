import { type FC } from 'react';
import { ILookupServiceEntity, LookupsEntityType } from '../../../components/entityLookups/types';
interface NamedEntityOptionProps {
    available: boolean;
    entity: ILookupServiceEntity;
    onClick: (name: LookupsEntityType) => void;
}
declare const NamedEntityOption: FC<NamedEntityOptionProps>;
export default NamedEntityOption;
//# sourceMappingURL=NamedEntityOption.d.ts.map