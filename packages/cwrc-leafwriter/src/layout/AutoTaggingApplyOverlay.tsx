import { Backdrop, LinearProgress, Stack, Typography } from '@mui/material';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

export type AutoTaggingBusyLabel =
  | 'Applying tags…'
  | 'Reverting tags…'
  | 'Running AI suggest…'
  | 'Running AI audit…';

export interface AutoTaggingApplyOverlayProps {
  done?: number;
  /** Known labels get i18n treatment; free-form progress strings are shown as-is. */
  label: AutoTaggingBusyLabel | (string & {});
  open: boolean;
  total?: number;
}

/** Full-window progress while auto-tagging mutates and reloads the document. */
export const AutoTaggingApplyOverlay = ({
  done = 0,
  label,
  open,
  total = 0,
}: AutoTaggingApplyOverlayProps) => {
  const { t } = useTranslation('LW');

  if (!open || typeof document === 'undefined') return null;

  const determinate = total > 0;
  const value = determinate ? Math.min(100, Math.round((done / total) * 100)) : undefined;

  return createPortal(
    <Backdrop
      open
      sx={{
        zIndex: (theme) => theme.zIndex.modal + 2,
        color: '#fff',
        flexDirection: 'column',
      }}
    >
      <Stack alignItems="center" spacing={1.5} sx={{ width: 280, maxWidth: '90vw', px: 2 }}>
        <Typography variant="body1">{t(label)}</Typography>
        <LinearProgress
          variant={determinate ? 'determinate' : 'indeterminate'}
          value={value}
          sx={{ width: '100%', height: 8, borderRadius: 1 }}
        />
        {determinate && (
          <Typography variant="caption" color="inherit" sx={{ opacity: 0.85 }}>
            {done} / {total}
          </Typography>
        )}
      </Stack>
    </Backdrop>,
    document.body,
  );
};
