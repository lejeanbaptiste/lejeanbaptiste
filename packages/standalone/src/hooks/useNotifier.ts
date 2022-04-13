import { useSnackbar } from 'notistack';
import { useEffect } from 'react';
import { useActions, useAppState } from '../overmind';

let displayed: (string | number)[] = [];

export const useNotifier = () => {
  const { notifications } = useAppState();
  const { removeNotificationSnackbar } = useActions();
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

      // display snackbar using notistack
      enqueueSnackbar(message, {
        key,
        ...options,
        onClose: (event, reason, myKey) => {
          if (options.onClose) options.onClose(event, reason, myKey);
        },
        onExited: (event, myKey) => {
          // remove this snackbar from overmind store
          removeNotificationSnackbar(myKey);
          removeDisplayed(myKey);
        },
      });

      // keep track of snackbars that we've displayed
      storeDisplayed(key);
    });
  }, [notifications, closeSnackbar, enqueueSnackbar]);
};
