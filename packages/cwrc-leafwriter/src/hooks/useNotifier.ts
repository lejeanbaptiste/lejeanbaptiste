import { useSnackbar } from 'notistack';
import { useEffect, useRef } from 'react';
import { useActions, useAppState } from '../overmind';

let displayed: (string | number)[] = [];

const DEFAULT_AUTO_HIDE_MS = 5000;
const EXIT_BUFFER_MS = 400;

export const useNotifier = () => {
  const { notifications } = useAppState().ui;
  const { removeNotificationSnackbar } = useActions().ui;
  const { closeSnackbar, enqueueSnackbar } = useSnackbar();
  const dismissTimers = useRef(new Map<string | number, ReturnType<typeof setTimeout>>());

  const storeDisplayed = (id: string | number) => {
    displayed = [...displayed, id];
  };

  const removeDisplayed = (id: string | number) => {
    displayed = displayed.filter((key) => id !== key);
  };

  const clearDismissTimer = (id: string | number) => {
    const timer = dismissTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      dismissTimers.current.delete(id);
    }
  };

  useEffect(() => {
    notifications.forEach(({ key, message, options = {}, dismissed = false }) => {
      if (!key) return;

      const cleanup = (myKey?: string | number) => {
        if (myKey === undefined || myKey === null) return;
        clearDismissTimer(myKey);
        removeNotificationSnackbar(myKey);
        removeDisplayed(myKey);
      };

      if (dismissed) {
        closeSnackbar(key);
        if (!displayed.includes(key)) {
          removeNotificationSnackbar(key);
        }
        return;
      }

      if (displayed.includes(key)) return;

      const autoHideDuration = options.persist
        ? null
        : (options.autoHideDuration ?? DEFAULT_AUTO_HIDE_MS);

      enqueueSnackbar(message, {
        key,
        ...options,
        onClose: (_event, reason, myKey) => {
          options.onClose?.(_event, reason, myKey);
          cleanup(myKey);
        },
        onExited: (_event, myKey) => {
          cleanup(myKey);
        },
      });

      storeDisplayed(key);

      if (autoHideDuration != null) {
        dismissTimers.current.set(
          key,
          setTimeout(() => cleanup(key), autoHideDuration + EXIT_BUFFER_MS),
        );
      }
    });
  }, [notifications, closeSnackbar, enqueueSnackbar, removeNotificationSnackbar]);

  useEffect(() => {
    const timers = dismissTimers.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);
};
