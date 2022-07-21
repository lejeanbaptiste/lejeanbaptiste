import { type FC } from 'react';
import { NamedEntityType } from '../../../components/entityLookups/types';
interface NamedEntityOptionProps {
    available: boolean;
    enabled: boolean;
    onClick: (name: NamedEntityType) => void;
    name: NamedEntityType;
}
declare const NamedEntityOption: FC<NamedEntityOptionProps>;
export default NamedEntityOption;
//# sourceMappingURL=NamedEntityOption.d.ts.map