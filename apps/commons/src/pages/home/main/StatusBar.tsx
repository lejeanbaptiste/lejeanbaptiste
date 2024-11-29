import { Chip, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';

export const StatusBar = () => {
  const { t } = useTranslation();

  const handleClick = () => {
    window.open(
      'mailto:contact-project+calincs-cwrc-leaf-writer-leaf-writer-31283590-issue-@incoming.gitlab.com',
    );
  };

  return (
    <Stack justifyContent="center" alignItems="center" px={2} mt={5}>
      <Chip
        label={`${t('LWC.home.bugs')} / ${t('LWC.home.requests')}`}
        onPointerDown={handleClick}
        size="small"
        variant="outlined"
        sx={{ mb: 1 }}
      />
    </Stack>
  );
};
