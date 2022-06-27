import { type FC } from 'react';
import type { Schema } from '../../types/index';
interface AddSchemaDialogProps {
    handleClose: (schema?: SchemaEssentials) => void;
    open: boolean;
}
declare type SchemaEssentials = Pick<Schema, 'name' | 'cssUrl' | 'xmlUrl'>;
declare const AddSchemaDialog: FC<AddSchemaDialogProps>;
export default AddSchemaDialog;
//# sourceMappingURL=AddSchemaDialog.d.ts.map