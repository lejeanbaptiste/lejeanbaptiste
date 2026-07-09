import { ListItem, ListItemButton, ListItemIcon, ListItemText, Menu, Switch } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../overmind';

interface SettingsDialogProps {
  anchor?: HTMLDivElement | null;
  onDone: () => void;
  open: boolean;
}

export const SettingsDialog = ({ anchor, onDone, open }: SettingsDialogProps) => {
  const { allowAllFileTypes } = useAppState().common;
  const { setAllowedAllFileTypes } = useActions().common;

  const { t } = useTranslation();

  const anchorRect = anchor?.getBoundingClientRect();
  const hasAnchorLayout = !!anchorRect && (anchorRect.width > 0 || anchorRect.height > 0);

  const handleToggleAllowAllFiles = () => {
    setAllowedAllFileTypes(!allowAllFileTypes);
  };

  const handleDone = () => onDone();

  return (
    <Menu
      anchorEl={hasAnchorLayout ? anchor : undefined}
      anchorPosition={hasAnchorLayout ? undefined : { top: 0, left: 0 }}
      anchorReference={hasAnchorLayout ? 'anchorEl' : 'anchorPosition'}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      data-testid="global_settings-dialog"
      id="settings-popper"
      open={open}
      onClose={handleDone}
      transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    >
      <ListItem disablePadding>
        <ListItemButton dense onClick={handleToggleAllowAllFiles} role={undefined}>
          <ListItemIcon>
            <Switch
              checked={allowAllFileTypes}
              data-testid="global_settings-dialog-allow_all_files-switch"
              inputProps={{ 'aria-label': 'allow-all-files' }}
              onChange={handleToggleAllowAllFiles}
              title={t('SS.settings.allow_all_files')}
              size="small"
            />
          </ListItemIcon>
          <ListItemText
            primary={t('SS.settings.allow_all_files')}
            sx={{ textTransform: 'capitalize' }}
          />
        </ListItemButton>
      </ListItem>
    </Menu>
  );
};
