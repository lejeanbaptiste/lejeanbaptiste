import { Backdrop, Box, Stack, Typography } from '@mui/material';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

export type AutoTaggingBusyLabel =
  | 'Applying tags…'
  | 'Updating review…'
  | 'Reverting tags…'
  | 'Running AI suggest…'
  | 'Running AI audit…';

export interface AutoTaggingApplyOverlayProps {
  /** Known labels get i18n treatment; free-form progress strings are shown as-is. */
  label: AutoTaggingBusyLabel | (string & {});
  open: boolean;
}

/**
 * Full-window overlay while auto-tagging mutates and reloads the document.
 *
 * The label is set once per operation and never updates while it's open, and
 * the spinner is a pure CSS transform animation with no live counters — both
 * stay smooth on the compositor thread even while the tagging work itself is
 * pinning the main thread (observed as visible stutter on Windows when the
 * label/progress text was updated on every item).
 */
export const AutoTaggingApplyOverlay = ({ label, open }: AutoTaggingApplyOverlayProps) => {
  const { t } = useTranslation('LW');

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <Backdrop
      open
      sx={{
        zIndex: (theme) => theme.zIndex.modal + 2,
        color: '#fff',
        flexDirection: 'column',
      }}
    >
      <Stack alignItems="center" spacing={2}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '4px solid rgba(255, 255, 255, 0.25)',
            borderTopColor: 'rgba(255, 255, 255, 0.9)',
            animation: 'lw-auto-tagging-spin 0.8s linear infinite',
            '@keyframes lw-auto-tagging-spin': {
              from: { transform: 'rotate(0deg)' },
              to: { transform: 'rotate(360deg)' },
            },
          }}
        />
        <Typography variant="body1">{t(label)}</Typography>
      </Stack>
    </Backdrop>,
    document.body,
  );
};
