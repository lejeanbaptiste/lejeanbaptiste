import { Page } from '@src/layouts';
import { BroadcastChannel } from 'broadcast-channel';
import { useEffect } from 'react';

export const LinkAccountsPage = () => {
  const query = new URLSearchParams(location.search);
  const error = query.get('error');

  useEffect(() => {
    const channel = new BroadcastChannel('Leaf-Writer-Link-Accounts');
    channel.postMessage({ success: !error, error });
    window.close();
  }, []);

  return <Page />;
};
