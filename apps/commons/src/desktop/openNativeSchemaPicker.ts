import { nanoid } from 'nanoid';

import { registerSchemaPickerSession } from '@src/desktop/schemaPickerSession';
import type { SchemaPickerOpenerOptions } from '@src/types/desktop';
import { isDesktop } from '@src/types/desktop';

export const openNativeSchemaPicker = async (
  options: SchemaPickerOpenerOptions,
): Promise<void> => {
  if (!isDesktop() || !window.electronAPI?.openNativeDialog) return;

  const dialogId = nanoid();
  registerSchemaPickerSession(dialogId, options);

  await window.electronAPI.openNativeDialog({
    id: dialogId,
    type: 'schemaPicker',
    title: 'Select Schema',
  });
};
