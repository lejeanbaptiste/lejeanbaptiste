import { useEffect, useRef } from 'react';
import EntitiesList from '../../js/layout/panels/entitiesList';

const DESKTOP_ENTITIES_PANEL_ID = 'desktop-panel-entities';

export const DesktopEntitiesPanel = () => {
  const listRef = useRef<EntitiesList | null>(null);

  useEffect(() => {
    if (!window.writer) return;

    listRef.current = new EntitiesList({
      writer: window.writer,
      parentId: DESKTOP_ENTITIES_PANEL_ID,
    });

    return () => {
      listRef.current?.destroy?.();
      listRef.current = null;
    };
  }, []);

  return null;
};
