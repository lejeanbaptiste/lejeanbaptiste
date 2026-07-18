import { CircularProgress, Stack } from '@mui/material';
import { useStore } from 'jotai';
import { useTranslation } from 'react-i18next';
import { ErrorMessage, ExportView, Sidebar, View } from './components';
import { useConversionAvailability } from './hooks';
import { dialogActionAtom } from './store';

/** Export bypasses the generic remote conversion service entirely (its formats can't
 * preserve live Zotero citation fields) — its own format list and options are self-
 * contained in ExportView, not sourced from useConversionAvailability. */
export const Main = () => {
  const dialogAction = useStore().get(dialogActionAtom);

  if (dialogAction === 'export') {
    return (
      <Stack direction="row" spacing={4} justifyContent="space-around">
        <ExportView />
      </Stack>
    );
  }

  return <ImportMain />;
};

const ImportMain = () => {
  const { data, error, isLoading } = useConversionAvailability();
  const { t } = useTranslation();

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
      <View />
    </Stack>
  );
};
