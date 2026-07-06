import {
  Button,
  Dialog,
  DialogContent,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { useActions } from '../../overmind';
import type { IDialog } from '../type';

/** Disambiguation launcher. */
export const DisambiguationDialog = ({ onClose, open = false }: IDialog) => {
  const { startDisambiguationReview } = useActions().ui;

  const handleClose = () => onClose?.();

  const handleStart = () => {
    startDisambiguationReview();
    handleClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      PaperProps={{ sx: { width: 380, m: 1, borderRadius: 1 } }}
    >
      <DialogContent sx={{ p: 1.5 }}>
        <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          Disambiguate
        </Typography>

        <Stack spacing={1} sx={{ mt: 0.5 }}>
          <Typography color="text.secondary" variant="body2">
            Link tagged mentions to authority records in your entity database.
          </Typography>

          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
            <Link component="button" onClick={handleClose} underline="hover" variant="caption">
              Cancel
            </Link>
            <Button onClick={handleStart} size="small" variant="contained">
              Start
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};
