import { Menu } from '@mui/material';
import React, { useEffect, useState, type FC } from 'react';
import Writer from '../../js/Writer';
import { useActions, useAppState } from '../../overmind';
import Collection from './collection';
import type { ItemProps } from './collection/Item';
import Header from './Header';
import { useContextmenu } from './hooks/useContextmenu';

export { useContextmenu } from './hooks/useContextmenu';

interface ContextMenuProps {
  writer: Writer;
}

export const ContextMenu: FC<ContextMenuProps> = ({ writer }) => {
  const { isReadonly, settings } = useAppState().editor;
  const { contextMenu } = useAppState().ui;

  const { closeContextMenu } = useActions().ui;

  const { collectionType, getItems, initialize, MIN_WIDTH, query, tagName, xpath, tagMeta } =
    useContextmenu(writer, contextMenu);

  const [anchorReference, setAnchorReference] = useState<'anchorPosition' | 'anchorEl'>(
    'anchorPosition'
  );
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>();
  const [options, setOptions] = useState<ItemProps[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [visibleList, setVisibleList] = useState<ItemProps[]>(options);

  useEffect(() => {
    if (!contextMenu.show) return;
    if (isReadonly) return;

    setShow(true);

    const initialzed = initialize();
    if (!initialzed) return;

    const loadItems = async () => {
      setIsLoading(true);
      const options = await getItems();
      setIsLoading(false);

      if (!options) return;

      setOptions(options);
      setVisibleList(options);
    };

    loadItems();

    const { element } = contextMenu;
    setAnchorReference(element ? 'anchorEl' : 'anchorPosition');
    setAnchorEl(element);

    setMenuPosition({
      top: contextMenu.position?.posY ?? 0,
      left: contextMenu.position?.posX ?? 0,
    });

    return () => {
      setMenuPosition(undefined);
      setOptions([]);
      setIsLoading(false);
      setVisibleList([]);
      setShow(false);
    };
  }, [contextMenu]);

  const handleQuery = (searchQuery: string) => {
    const result = query(options, searchQuery);
    if (!result) return setVisibleList(options);

    setVisibleList(result);
  };

  const handleClose = () => closeContextMenu();

  return (
    <>
      {show && (
        <React.StrictMode>
          <Menu
            anchorEl={anchorEl}
            anchorPosition={menuPosition}
            anchorReference={anchorReference}
            id="contextmenu"
            container={document.getElementById(`${settings.container}`)}
            keepMounted
            MenuListProps={{ sx: { minWidth: MIN_WIDTH, py: 0.5, borderRadius: 1 } }}
            onClose={handleClose}
            open={show}
            PaperProps={{ elevation: 4 }}
            variant="menu"
          >
            <Header tagName={tagName} xpath={xpath} tagMeta={tagMeta} />
            <Collection
              handleQuery={handleQuery}
              collectionType={collectionType}
              fullLength={options.length}
              isLoading={isLoading}
              list={visibleList}
              minWidth={MIN_WIDTH}
            />
          </Menu>
        </React.StrictMode>
      )}
    </>
  );
};
