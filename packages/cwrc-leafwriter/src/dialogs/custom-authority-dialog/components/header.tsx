import CloseIcon from '@mui/icons-material/Close';
import { IconButton, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { CustomAuthorityDialogProps } from '..';

export const Header = ({
  onClose,
  type,
}: Pick<CustomAuthorityDialogProps, 'onClose'> & { type: 'add' | 'edit' }) => {
  const { t } = useTranslation();

  return (
    <Stack direction="row" justifyContent="center" alignItems="center" py={2} spacing={2}>
      <Typography sx={{ textTransform: 'capitalize' }} variant="h5">
        {type === 'edit' ? 'Edit' : 'Add'} Authority
      </Typography>
      <IconButton
        aria-label={t('LW.commons.close')}
        onClick={onClose}
        sx={{
          position: 'absolute',
          right: 8,
          top: 12,
          color: (theme) => theme.vars.palette.grey[500],
        }}
      >
        <CloseIcon fontSize="inherit" />
      </IconButton>
    </Stack>
  );
};
