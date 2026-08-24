import { Page } from '@src/layouts';
import { BroadcastChannel } from 'broadcast-channel';
import { useEffect } from 'react';

export const LinkAccountsPage = () => {
  const query = new URLSearchParams(location.search);
  const error = query.get('error');

  // Fires exactly once: it reports the outcome to the opener and closes this
  // popup. `error` is read from the URL, which cannot change in a window that is
  // about to close, and re-running would post a duplicate message.
  useEffect(() => {
    const channel = new BroadcastChannel('Leaf-Writer-Link-Accounts');
    channel.postMessage({ success: !error, error });
    window.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Page />;
};
