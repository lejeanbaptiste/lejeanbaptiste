import type { ValidationResponse } from '@cwrc/leafwriter-validator';
import 'jquery-ui/ui/widgets/button';
import 'jquery-ui/ui/widgets/tooltip';
import Circle from 'progressbar.js/circle';
import Writer from '../../../Writer';
interface ValidationProps {
    parentId: string;
    writer: Writer;
}
declare class Validation {
    readonly id: string;
    readonly writer: Writer;
    readonly AUTO_VALIDATE_ONCHANGE_TIMER = 10000;
    autoValidateTimerActive: boolean;
    autoValidateTimer: ReturnType<typeof setTimeout>;
    progressBar?: Circle;
    constructor({ parentId, writer }: ValidationProps);
    validate(): Promise<void>;
    /**
     * Processes a validation response from the server.
     * @param result {object} The actual response
     * @param result.valid {boolean} Whether the document is valid or not
     * @param result.errors {array} List of errors
     */
    showValidationResult({ valid, errors }: ValidationResponse): void;
    private collapseAll;
    private createSucessMessageComponent;
    private getElementPathOnEditor;
    private createErrorMessage;
    private createErrorMessageComponent;
    private createDocumentationComponent;
    private getPossible;
    clearResult: () => void;
    destroy: () => void;
}
export default Validation;
//# sourceMappingURL=index.d.ts.map