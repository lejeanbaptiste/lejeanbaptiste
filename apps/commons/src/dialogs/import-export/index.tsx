import { Dialog, DialogContent } from '@mui/material';
import { useActions } from '@src/overmind';
import { Provider } from 'jotai';
import { nanoid } from 'nanoid';
import { useEffect } from 'react';
import type { IDialog } from '../type';
import { Actions, Header } from './components';
import { Main } from './main';
import { ImportExportStore, dialogActionAtom } from './store';

export type DialogTye = Extract<'import' | 'export', IDialog['type']>;

export const ImportDialog = ({
  id = nanoid(),
  maxWidth,
  open = true,
  type = 'import',
}: IDialog) => {
  const { closeDialog } = useActions().ui;

  useEffect(() => {
    ImportExportStore.set(dialogActionAtom, type as DialogTye);
  }, []);

  const handleAction = () => closeDialog(id);

  return (
    <Dialog fullWidth={type === 'export' ? false : true} id={id} maxWidth={maxWidth} open={open}>
      <Provider store={ImportExportStore}>
        <Header />
        <DialogContent>
          <Main />
        </DialogContent>
        <Actions onAction={handleAction} />
      </Provider>
    </Dialog>
  );
};
