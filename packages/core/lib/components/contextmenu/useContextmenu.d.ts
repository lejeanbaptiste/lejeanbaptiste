import type { ElementDetail } from '@cwrc/leafwriter-validator';
import Writer from '../../js/Writer';
import type { ContextMenuState } from '../../types';
import type { Item as ItemType } from './types';
export declare const useContextmenu: (writer?: Writer, contextMenuState?: ContextMenuState) => {
    collectionType: string;
    MIN_WIDTH: number;
    xpath: string;
    tagName: string;
    tagMeta: ElementDetail;
    query: (list: ItemType[], searchQuery: string) => ItemType[];
    initialize: () => Promise<boolean>;
    getItems: () => Promise<false | ItemType[] | {
        id: string;
        displayName: string;
        icon: string;
        onClick: () => void;
    }[]>;
};
export default useContextmenu;
//# sourceMappingURL=useContextmenu.d.ts.map