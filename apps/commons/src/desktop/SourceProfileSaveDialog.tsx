import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface SourceProfileSaveDialogProps {
  defaultLabel: string;
  onClose: () => void;
  onSave: (label: string) => void;
  open: boolean;
}

export const SourceProfileSaveDialog = ({
  defaultLabel,
  onClose,
  onSave,
  open,
}: SourceProfileSaveDialogProps) => {
  const { t } = useTranslation();
  const [label, setLabel] = useState(defaultLabel);

  useEffect(() => {
    if (open) setLabel(defaultLabel);
  }, [defaultLabel, open]);

  return (
    <Dialog fullWidth maxWidth="xs" onClose={onClose} open={open}>
      <DialogTitle>{t('LWC.desktop.file_metadata.save_profile_title')}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label={t('LWC.desktop.file_metadata.profile_label')}
          margin="dense"
          onChange={(event) => setLabel(event.target.value)}
          size="small"
          value={label}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('LWC.commons.cancel')}</Button>
        <Button disabled={!label.trim()} onClick={() => onSave(label.trim())} variant="contained">
          {t('LWC.commons.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
