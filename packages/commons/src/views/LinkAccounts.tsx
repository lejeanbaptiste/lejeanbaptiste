import { Page } from '@src/layouts';
import { BroadcastChannel } from 'broadcast-channel';
import React, { useEffect, type FC } from 'react';

export const LinkAccounts: FC = () => {
  const query = new URLSearchParams(location.search);
  const error = query.get('error');

  useEffect(() => {
    const channel = new BroadcastChannel('Leaf-Writer-Link-Accounts');
    channel.postMessage({ success: !error, error });
    window.close();
  }, []);

  return <Page />;
};
