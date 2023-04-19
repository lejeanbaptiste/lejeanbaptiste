import { CircularProgress, Stack } from '@mui/material';
import { useStore } from 'jotai';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorMessage, Sidebar, View } from './components';
import { useConversionAvailability } from './hooks';
import { dialogActionAtom } from './store';

export const Main = () => {
  const { data, error, isLoading } = useConversionAvailability();

  const { t } = useTranslation('LWC');

  const dialogAction = useStore().get(dialogActionAtom);

  if (error || data?.length === 0) {
    return <ErrorMessage message={t('LWC.messages.service not available at the moment')} />;
  }

  if (isLoading) {
    return (
      <Stack minHeight={220} direction="row" spacing={4} justifyContent="space-around">
        <CircularProgress sx={{ alignSelf: 'center' }} />
      </Stack>
    );
  }

  return (
    <Stack direction="row" spacing={4} justifyContent="space-around">
      <Sidebar />
      {dialogAction === 'import' && <View />}
    </Stack>
  );
};
