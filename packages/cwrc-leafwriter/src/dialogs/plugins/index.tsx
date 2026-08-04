import { useEffect } from 'react';
import { useActions } from '../../overmind';
import type { IDialog } from '../type';

/** @deprecated Use Settings → Plugins tab. Kept so older openDialog({ type: 'plugins' }) calls still work. */
export const PluginsDialog = ({ onClose, open = false }: IDialog) => {
  const { openDialog } = useActions().ui;

  useEffect(() => {
    if (!open) return;
    openDialog({ type: 'settings', props: { initialTab: 'plugins' } });
    onClose?.('close');
  }, [onClose, open, openDialog]);

  return null;
};
