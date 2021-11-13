import {
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  Popover,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useAppState, useActions } from '../overmind';
import React, { ChangeEvent, FC, FocusEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface SettingsDialogProps {
  anchor?: HTMLDivElement | null;
  onDone: () => void;
  open: boolean;
}

const SettingsDialog: FC<SettingsDialogProps> = ({ anchor, onDone, open }) => {
  const { t } = useTranslation();
  const { commitMessage } = useAppState().cloud;
  const { setCommitMessage } = useActions().cloud;

  const theme = useTheme();
  const isSM = useMediaQuery(theme.breakpoints.down('sm'));

  const [commitMessageLocal, setCommitMessageLocal] = useState(commitMessage);

  const handleComitMessageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    setCommitMessageLocal(inputValue);
  };

  const handleComitMessageBlur = (event: FocusEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    setCommitMessage(inputValue);
  };

  const handleDone = () => onDone();

  return (
    <Popover
      anchorEl={anchor}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      id="save-settings-popper"
      onClose={handleDone}
      open={open}
    >
      <DialogTitle id="save-settings-title" sx={{ textAlign: 'center' }}>
        {t('cloud:settings:save_settings')}
      </DialogTitle>
      <DialogContent sx={{ width: isSM ? 300 : 400 }}>
        <TextField
          autoComplete="off"
          autoFocus
          fullWidth
          id="comit-message"
          label={t('cloud:settings:comit_message')}
          onBlur={handleComitMessageBlur}
          onChange={handleComitMessageChange}
          placeholder={commitMessage}
          value={commitMessageLocal}
          variant="standard"
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={handleDone}>{t('cloud:settings:done')}</Button>
      </DialogActions>
    </Popover>
  );
};

export default SettingsDialog;
