import { Button, DialogActions, Stack } from '@mui/material';
import { useAtomValue } from 'jotai';
import { PointerEventHandler } from 'react';
import { useTranslation } from 'react-i18next';
import { useDialog } from '../hooks/useDialog';
import { useValidation } from '../hooks/useValidation';
import { currentContentAtom, originalContentAtom } from '../store';
import { Validator } from './validator';

interface FooterProps {
  onCancel: PointerEventHandler<HTMLButtonElement>;
  onDone: PointerEventHandler<HTMLButtonElement>;
}

export const Footer = ({ onCancel, onDone }: FooterProps) => {
  const { t } = useTranslation('leafwriter');
  const currentContent = useAtomValue(currentContentAtom);
  const originalContent = useAtomValue(originalContentAtom);
  const { updateContent } = useDialog();
  const { checkValidity, handleValidationWarning } = useValidation();

  const handlClickChange: PointerEventHandler<HTMLButtonElement> = async (event) => {
    if (currentContent === originalContent) {
      onDone(event);
      return;
    }

    const validity = checkValidity();
    if (validity.valid) {
      updateContent();
      onDone(event);
      return;
    }

    const shouldCloseDialog = await handleValidationWarning(validity.error.message);
    if (shouldCloseDialog) onCancel(event);
  };

  return (
    <DialogActions sx={{ justifyContent: 'space-between' }}>
      <Button onClick={onCancel}>{t('leafwriter:commons.cancel')}</Button>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Validator />
        <Button autoFocus onClick={handlClickChange} variant="outlined">
          {t('leafwriter:commons.change')}
        </Button>
      </Stack>
    </DialogActions>
  );
};
