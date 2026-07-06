import { useEffect, useRef } from 'react';
import EntitiesList from '../../js/layout/panels/entitiesList';

const DESKTOP_ENTITIES_PANEL_ID = 'desktop-panel-entities';

export const DesktopEntitiesPanel = () => {
  const listRef = useRef<EntitiesList | null>(null);

  useEffect(() => {
    const mount = (): boolean => {
      const parent = document.getElementById(DESKTOP_ENTITIES_PANEL_ID);
      if (!parent?.isConnected || !window.writer) return false;

      const existingRoot = parent.querySelector('.entitiesList');
      if (listRef.current && existingRoot) return true;

      listRef.current?.destroy?.();
      listRef.current = new EntitiesList({
        writer: window.writer,
        parentId: DESKTOP_ENTITIES_PANEL_ID,
      });
      return true;
    };

    if (mount()) {
      return () => {
        listRef.current?.destroy?.();
        listRef.current = null;
      };
    }

    const intervalId = window.setInterval(() => {
      if (mount()) window.clearInterval(intervalId);
    }, 200);

    return () => {
      window.clearInterval(intervalId);
      listRef.current?.destroy?.();
      listRef.current = null;
    };
  }, []);

  return null;
};
