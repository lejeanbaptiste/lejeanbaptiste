import Writer from '../Writer';
export declare type DialogLookupType = 'citation' | 'organization' | 'person' | 'place' | 'rs' | 'title';
export interface ILWDialogConfigParams {
    parentEl: JQuery<HTMLElement>;
    type?: DialogLookupType;
    writer: Writer;
}
export interface ILWDialog {
    show: (config?: any) => void;
    destroy: () => void;
    confirm?: (config: any) => void;
    getOpenDialogs?: () => JQuery<HTMLElement>[];
    setText?: (value: string) => void;
    setValue?: (value: number | boolean) => void;
    hide?: () => void;
}
//# sourceMappingURL=types.d.ts.map