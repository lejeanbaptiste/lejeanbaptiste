import CloseIcon from '@mui/icons-material/Close';
import { Icon, IconButton, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { getIcon } from '../../icons';

type HeaderProps = {
  onClose: () => void;
};

export const Header = ({ onClose }: HeaderProps) => {
  const { t } = useTranslation('leafwriter');

  return (
    <Stack direction="row" justifyContent="center" alignItems="center" py={2} spacing={2}>
      <Icon component={getIcon('settings')} sx={{ height: 24, width: 24 }} />
      <Typography sx={{ textTransform: 'capitalize' }} variant="h5">
        {t('commons.settings')}
      </Typography>
      <IconButton
        aria-label="close"
        onClick={onClose}
        sx={{ position: 'absolute', right: 8, top: 12, color: ({ palette }) => palette.grey[500] }}
      >
        <CloseIcon fontSize="inherit" />
      </IconButton>
    </Stack>
  );
};
