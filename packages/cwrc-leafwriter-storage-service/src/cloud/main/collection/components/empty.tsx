import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

export const Empty = () => {
  const { t } = useTranslation();
  return (
    <Stack data-testid="list-empty" justifyContent="center" height={200}>
      <Stack
        direction="row"
        justifyContent="center"
        spacing={2}
        sx={(theme) => ({
          color: `rgba(${theme.palette.text.secondary} / 0.15)`,
        })}
      >
        <ErrorOutlineIcon sx={{ height: 56, width: 56 }} />
        <Typography variant="h3">{t('SS.commons.empty')}</Typography>
      </Stack>
    </Stack>
  );
};
