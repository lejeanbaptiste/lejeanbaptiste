import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { DedupedProjectSource } from './sourceProfileTypes';

export interface SourceProfileImportDialogProps {
  entries: DedupedProjectSource[];
  loading: boolean;
  onAddToLibrary: (entry: DedupedProjectSource) => void;
  onApply: (entry: DedupedProjectSource) => void;
  onClose: () => void;
  open: boolean;
}

export const SourceProfileImportDialog = ({
  entries,
  loading,
  onAddToLibrary,
  onApply,
  onClose,
  open,
}: SourceProfileImportDialogProps) => {
  const { t } = useTranslation();

  return (
    <Dialog fullWidth maxWidth="sm" onClose={onClose} open={open}>
      <DialogTitle>{t('LWC.desktop.file_metadata.import_from_project_title')}</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Typography color="text.secondary" variant="body2">
            {t('LWC.desktop.file_metadata.import_scanning')}
          </Typography>
        ) : entries.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            {t('LWC.desktop.file_metadata.import_empty')}
          </Typography>
        ) : (
          <List dense disablePadding>
            {entries.map((entry) => (
              <ListItem
                key={entry.identityKey}
                secondaryAction={
                  <>
                    <Button
                      size="small"
                      onClick={() => onApply(entry)}
                      sx={{ mr: 0.5 }}
                    >
                      {t('LWC.desktop.file_metadata.import_apply')}
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => onAddToLibrary(entry)}>
                      {t('LWC.desktop.file_metadata.import_add_to_library')}
                    </Button>
                  </>
                }
                sx={{ alignItems: 'flex-start', pr: 22 }}
              >
                <ListItemText
                  primary={entry.label}
                  secondary={t('LWC.desktop.file_metadata.import_file_count', {
                    count: entry.fileCount,
                  })}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('LWC.commons.close')}</Button>
      </DialogActions>
    </Dialog>
  );
};
