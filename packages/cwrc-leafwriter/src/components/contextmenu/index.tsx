import { Menu } from '@mui/material';
import { Provider, useSetAtom } from 'jotai';
import { useEffect, useState } from 'react';
import { useActions, useAppState } from '../../overmind';
import { Collection, Header, type ItemProps } from './components';
import { useContextmenu } from './hooks';
import { tagMetaAtom, tagNameAtom, xpathAtom } from './store';

export const MIN_WIDTH = 250;

export const ContextMenu = () => {
  const { isReadonly, settings } = useAppState().editor;
  const { contextMenu } = useAppState().ui;

  const setTagMeta = useSetAtom(tagMetaAtom);
  const setTagName = useSetAtom(tagNameAtom);
  const setXpath = useSetAtom(xpathAtom);

  const { closeContextMenu } = useActions().ui;

  const { getItems, initialize } = useContextmenu();

  const [anchorRef, setAnchorRef] = useState<'anchorPosition' | 'anchorEl'>('anchorPosition');
  const [anchorEl, setAnchorEl] = useState<Element | null>(null);
  const [options, setOptions] = useState<ItemProps[]>([]);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!contextMenu.show) return;
    if (isReadonly) return;

    const initialzed = initialize();
    if (!initialzed) return;

    setAnchorRef(contextMenu.anchorEl ? 'anchorEl' : 'anchorPosition');
    setAnchorEl(contextMenu.anchorEl ?? null);
    setPosition({
      top: contextMenu.position?.posY ?? 0,
      left: contextMenu.position?.posX ?? 0,
    });

    setShow(true);
    loadItems();

    return () => {
      setPosition({ top: 0, left: 0 });
      setOptions([]);
      setShow(false);

      setXpath(null);
      setTagName(null);
      setTagMeta(null);
    };
  }, [contextMenu.show]);

  const loadItems = async () => {
    const options = await getItems();
    if (!options) return;
    setOptions(options);
  };

  const handleClose = () => closeContextMenu();

  return (
    <>
      {show && (
        <Menu
          anchorEl={anchorEl}
          anchorPosition={position}
          anchorReference={anchorRef}
          id="contextmenu"
          container={document.getElementById(`${settings.container}`)}
          keepMounted
          MenuListProps={{ sx: { minWidth: MIN_WIDTH, py: 0.5, borderRadius: 1 } }}
          onClose={handleClose}
          open={show}
          PaperProps={{ elevation: 4 }}
          variant="menu"
        >
          <Header count={contextMenu.count} nodeType={contextMenu.nodeType} />
          <Provider>
            <Collection list={options} searchable={contextMenu.eventSource === 'ribbon'} />
          </Provider>
        </Menu>
      )}
    </>
  );
};
