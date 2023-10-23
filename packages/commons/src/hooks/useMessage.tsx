import { Typography } from '@mui/material';
import { useAppState } from '@src/overmind';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export const useMessage = () => {
  const { userState } = useAppState().auth;
  const { storageProviders } = useAppState().providers;

  const { t } = useTranslation('LWC');

  const cloudDisabledMessage = useMemo(() => {
    if (userState !== 'AUTHENTICATED') {
      return `${t('LWC:messages.you_must_sign_in_to_open_and_save_document_from_the_cloud')}`;
    }

    if (!storageProviders.some((provider) => provider.service?.isStorageProvider)) {
      return (
        <>
          <Typography paragraph variant="caption">
            {t(
              'LWC:messages.you_must_sign_in_witn_a_storage_provider_to_open_and_save_document_from_the_cloud',
            )}
            .
          </Typography>
          <Typography variant="caption">
            {t('LWC:messages.link_to_storage_provider_instructions')}.
          </Typography>
        </>
      );
    }
  }, [userState, storageProviders]);

  return {
    cloudDisabledMessage,
  };
};
