import { Page } from '@src/layouts/components';
import React, { FC, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BroadcastChannel } from 'broadcast-channel';

const LinkAccounts: FC = () => {
  const { t } = useTranslation();
  const query = new URLSearchParams(location.search);
  const error = query.get('error');

  useEffect(() => {
    const channel = new BroadcastChannel('Leaf-Writer-Link-Accounts');
    channel.postMessage({ success: !error, error });
    window.close();
  }, []);

  return <Page title={t('home:homepage')}></Page>;
};

export default LinkAccounts;
