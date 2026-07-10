import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { useActions } from '@src/overmind';

const APP_VERSION = '0.0.1';
const PROJECT_URL = 'https://github.com/lejeanbaptiste/lejeanbaptiste';
const BUG_REPORT_URL =
  'https://github.com/lejeanbaptiste/lejeanbaptiste/issues/new?template=bug_report.md';

interface AboutDialogProps {
  onClose: () => void;
  open: boolean;
}

export const AboutDialog = ({ onClose, open }: AboutDialogProps) => {
  const { openDialog } = useActions().ui;

  const handlePrivacy = () => {
    onClose();
    openDialog({ type: 'privacy' });
  };

  return (
    <Dialog fullWidth maxWidth="xs" onClose={onClose} open={open}>
      <DialogTitle>About Le Jean-Baptiste</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body2">
            A desktop XML editor for scholarly text encoding, built on LEAF-Writer.
          </Typography>
          <Link href={PROJECT_URL} rel="noopener noreferrer" target="_blank" variant="body2">
            Project website
          </Link>
          <Typography color="text.secondary" variant="caption">
            Version {APP_VERSION}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={2}>
            <Link component="button" onClick={handlePrivacy} variant="body2">
              Privacy policy
            </Link>
            <Link href={BUG_REPORT_URL} rel="noopener noreferrer" target="_blank" variant="body2">
              Bugs / requests
            </Link>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>OK</Button>
      </DialogActions>
    </Dialog>
  );
};
