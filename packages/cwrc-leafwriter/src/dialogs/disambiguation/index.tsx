import { useEffect } from 'react';
import { useActions } from '../../overmind';
import type { IDialog } from '../type';

/** Legacy dialog entry — opens the docked disambiguation panel instead. */
export const DisambiguationDialog = ({ onClose, open = false }: IDialog) => {
  const { startDisambiguationReview } = useActions().ui;

  useEffect(() => {
    if (!open) return;
    startDisambiguationReview();
    onClose?.();
  }, [open, onClose, startDisambiguationReview]);

  return null;
};
