import CloseIcon from '@mui/icons-material/Close';
import { IconButton, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../icons';

export const Header = ({ onClose }: { onClose: () => void }) => {
  const { t } = useTranslation();

  return (
    <Stack
      direction="row"
      justifyContent="center"
      alignItems="center"
      py={1.25}
      spacing={1}
      sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
    >
      <Icon name="settings" sx={{ height: 18, width: 18 }} />
      <Typography sx={{ fontWeight: 600 }} variant="h6">
        {t('LW.commons.settings')}
      </Typography>
      <IconButton
        aria-label={t('LW.commons.close')}
        onClick={onClose}
        sx={{
          position: 'absolute',
          right: 8,
          top: 8,
          color: (theme) => theme.vars.palette.grey[500],
        }}
        size="small"
      >
        <CloseIcon fontSize="inherit" />
      </IconButton>
    </Stack>
  );
};
