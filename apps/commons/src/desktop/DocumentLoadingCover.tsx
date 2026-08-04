import { Box, Typography } from '@mui/material';
import { useAppState } from '@src/overmind';
import { useTranslation } from 'react-i18next';

/** Full-bleed wait state that hides TinyMCE / LEAF-Writer boot chrome underneath. */
export const DocumentLoadingCover = ({
  visible,
  absolute = true,
}: {
  visible: boolean;
  /** When false, fills the parent flex area instead of overlaying it. */
  absolute?: boolean;
}) => {
  const { darkMode } = useAppState().ui;
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <Box
      aria-busy
      aria-live="polite"
      role="status"
      sx={{
        alignItems: 'center',
        bgcolor: darkMode ? '#000' : '#fff',
        color: darkMode ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.75)',
        display: 'flex',
        inset: absolute ? 0 : undefined,
        justifyContent: 'center',
        ...(absolute
          ? { position: 'absolute', zIndex: 50 }
          : { flex: 1, height: '100%', minHeight: 0, width: '100%' }),
      }}
    >
      <Typography variant="body1">
        {t('LWC.desktop.project.loading_document', { defaultValue: 'Loading document…' })}
      </Typography>
    </Box>
  );
};
