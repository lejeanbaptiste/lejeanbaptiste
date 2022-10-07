import { Page } from '@src/layouts';
import React, { FC, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BroadcastChannel } from 'broadcast-channel';

export const LinkAccounts: FC = () => {
  const { t } = useTranslation('commons');
  const query = new URLSearchParams(location.search);
  const error = query.get('error');

  useEffect(() => {
    const channel = new BroadcastChannel('Leaf-Writer-Link-Accounts');
    channel.postMessage({ success: !error, error });
    window.close();
  }, []);

  return <Page title={t('homepage')}></Page>;
};
