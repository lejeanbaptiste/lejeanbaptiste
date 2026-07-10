import { useSnackbar } from 'notistack';
import { useEffect } from 'react';
import { useActions, useAppState } from '../overmind';

let displayed: (string | number)[] = [];

export const useNotifier = () => {
  const { notifications } = useAppState().ui;
  const { removeNotificationSnackbar } = useActions().ui;
  const { closeSnackbar, enqueueSnackbar } = useSnackbar();

  const storeDisplayed = (id: string | number) => {
    displayed = [...displayed, id];
  };

  const removeDisplayed = (id: string | number) => {
    displayed = [...displayed.filter((key) => id !== key)];
  };

  useEffect(() => {
    notifications.forEach(({ key, message, options = {}, dismissed = false }) => {
      // dismiss snackbar using notistack
      if (dismissed) return closeSnackbar(key);

      // do nothing if snackbar is already displayed
      if (!key) return;
      if (displayed.includes(key)) return;

      const cleanup = (myKey?: string | number) => {
        if (myKey === undefined || myKey === null) return;
        removeNotificationSnackbar(myKey);
        removeDisplayed(myKey);
      };

      // display snackbar using notistack
      enqueueSnackbar(message, {
        key,
        ...options,
        onClose: (event, reason, myKey) => {
          if (options.onClose) options.onClose(event, reason, myKey);
          cleanup(myKey);
        },
        onExited: (_event, myKey) => {
          cleanup(myKey);
        },
      });

      // keep track of snackbars that we've displayed
      storeDisplayed(key);
    });
  }, [notifications, closeSnackbar, enqueueSnackbar]);
};
