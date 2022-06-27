import Writer from '../Writer';
import type { ILWDialog, ILWDialogConfigParams } from './types';
interface IConfig {
    callback?: Function;
    dialogType: string;
    height?: number;
    modal?: boolean;
    msg: string;
    noText?: string;
    showConfirmKey?: string;
    title?: string;
    type: string;
    width?: number;
    yesText?: string;
}
declare class Message implements ILWDialog {
    readonly writer: Writer;
    readonly $parentEl: JQuery<HTMLElement>;
    openDialogs: JQuery<HTMLElement>[];
    constructor({ writer, parentEl }: ILWDialogConfigParams);
    private createMessageDialog;
    show(config: IConfig): void;
    confirm(config: IConfig): void;
    destroy(): void;
    getOpenDialogs(): JQuery<HTMLElement>[];
}
export default Message;
//# sourceMappingURL=message.d.ts.map