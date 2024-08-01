import {
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  Popover,
  TextField,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useState, type ChangeEvent, type FocusEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../overmind';

interface SaveSettingsDialogProps {
  anchor?: HTMLDivElement | null;
  onDone: () => void;
  open: boolean;
}

export const SaveSettingsDialog = ({ anchor, onDone, open }: SaveSettingsDialogProps) => {
  const { commitMessage } = useAppState().cloud;
  const { setCommitMessage } = useActions().cloud;

  const { t } = useTranslation();

  const { breakpoints } = useTheme();
  const isSM = useMediaQuery(breakpoints.down('sm'));

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
      data-testid="save:settings-dialog"
    >
      <DialogTitle id="save-settings-title" sx={{ textAlign: 'center' }}>
        {t('SS.cloud.settings.save_settings')}
      </DialogTitle>
      <DialogContent sx={{ width: isSM ? 300 : 400 }}>
        <TextField
          autoComplete="off"
          autoFocus
          fullWidth
          id="comit-message"
          inputProps={{ 'data-testid': 'save:settings:commit-input' }}
          label={t('SS.cloud.settings.comit_message')}
          onBlur={handleComitMessageBlur}
          onChange={handleComitMessageChange}
          placeholder={commitMessage}
          value={commitMessageLocal}
          variant="standard"
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={handleDone} title="done">
          {t('SS.cloud.settings.done')}
        </Button>
      </DialogActions>
    </Popover>
  );
};
