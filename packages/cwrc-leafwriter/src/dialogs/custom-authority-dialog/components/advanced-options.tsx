import { Box, IconButton, Stack, Typography } from '@mui/material';
import { useField } from 'formik';
import { useTranslation } from 'react-i18next';
import { FiMinus, FiPlus } from 'react-icons/fi';

export const AdvancedOptions = () => {
  const { t } = useTranslation();
  return (
    <Box>
      <Typography borderBottom="1px solid" pb={0.5} mb={1} variant="subtitle1">
        {t('LW.commons.advanced options')}
      </Typography>
      <Stack gap={2}>
        <MaxResultsControl />
      </Stack>
    </Box>
  );
};

const MIN_RESULTS = 5;
const MAX_RESULTS = 20;

export const MaxResultsControl = () => {
  const { t } = useTranslation();
  const [field, _meta, helpers] = useField<number | undefined>('options.maxResults');

  const changeMaxResultBy = (value: number) => {
    if (value > 0) {
      if (!field.value) return;
      const newValue = field.value + value;
      helpers.setValue(newValue > MAX_RESULTS ? undefined : newValue);
      return;
    }
    if (value < 0) {
      if (!field.value) {
        helpers.setValue(MAX_RESULTS);
        return;
      }
      if (field.value > MIN_RESULTS) {
        helpers.setValue(field.value + value);
      }
    }
  };

  return (
    <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
      <Box>
        <Typography mb={-0.75} sx={{ textTransform: 'capitalize' }} variant="body1">
          {t('LW.commons.max results')}
        </Typography>
        <Typography color="text.secondary" variant="caption">
          {t('LW.messages.The maximum number of item return in the lookup search')}
        </Typography>
      </Box>
      <Stack direction="row" gap={1} alignItems="center">
        <IconButton
          disabled={field.value !== undefined && field.value <= MIN_RESULTS}
          onClick={() => changeMaxResultBy(-1)}
          size="small"
        >
          <FiMinus />
        </IconButton>
        <Typography
          sx={{ width: '1.2rem', textAlign: 'right', transition: 'all 4s ease' }}
          variant="body1"
        >
          {field.value ?? '∞'}
        </Typography>
        <IconButton disabled={!field.value} onClick={() => changeMaxResultBy(1)} size="small">
          <FiPlus />
        </IconButton>
      </Stack>
    </Stack>
  );
};
