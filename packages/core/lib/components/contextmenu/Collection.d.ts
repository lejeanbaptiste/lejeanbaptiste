import { type FC } from 'react';
import type { Item as ItemType } from './types';
interface CollectionProps {
    handleQuery: (query: string) => void;
    collectionType?: string;
    fullLength?: number;
    isLoading?: boolean;
    list?: ItemType[];
    minWidth?: number;
}
declare const Collection: FC<CollectionProps>;
export default Collection;
//# sourceMappingURL=Collection.d.ts.map