import 'jquery-ui/ui/widgets/dialog';
import 'jquery-ui/ui/widgets/progressbar';
import type { ILWDialog, ILWDialogConfigParams } from '../types';
declare class LoadingIndicator implements ILWDialog {
    readonly $loadingIndicator: JQuery<HTMLElement>;
    readonly $progressBar: JQuery<HTMLElement>;
    readonly $progressLabel: JQuery<HTMLElement>;
    constructor({ writer, parentEl }: ILWDialogConfigParams);
    setText(text: string): void;
    setValue(percent: number | boolean): void;
    show(): void;
    hide(): void;
    destroy(): void;
}
export default LoadingIndicator;
//# sourceMappingURL=loadingIndicator.d.ts.map