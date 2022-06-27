import type { IEditSourceDialogProps } from '../../components/editSource';
import type { EntityLookupDialogProps } from '../../components/entityLookups/types';
import type { PopupProps } from '../../components/popup';
import type { ContextMenuState, Language } from '../../types';
declare type State = {
    contextMenu: ContextMenuState;
    darkMode: boolean;
    editSourceProps: IEditSourceDialogProps;
    entityLookupDialogProps: EntityLookupDialogProps;
    language: Language;
    popupProps: PopupProps;
    settingsDialogOpen: boolean;
    themeAppearance: 'light' | 'auto' | 'dark';
    title: string;
};
export declare const state: State;
export {};
//# sourceMappingURL=state.d.ts.map