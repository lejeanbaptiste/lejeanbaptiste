import { leafwriterAtom } from '@src/jotai';
import { useActions } from '@src/overmind';
import { useAtom } from 'jotai';
import { useCallback } from 'react';

export const useProjectMenu = () => {
  const { openProjectFolder, saveActiveTab } = useActions().project;
  const [leafWriter] = useAtom(leafwriterAtom);

  const onKeydownHandle = useCallback(async (event: KeyboardEvent) => {
    if (!event.metaKey) return;

    if (event.code === 'KeyS') {
      event.preventDefault();
      event.stopPropagation();
      if (!leafWriter) return;
      const content = await leafWriter.getContent();
      await saveActiveTab({ content });
      return;
    }

    if (event.code === 'KeyO') {
      event.preventDefault();
      event.stopPropagation();
      await openProjectFolder();
    }
  }, [leafWriter, openProjectFolder, saveActiveTab]);

  return { onKeydownHandle };
};
