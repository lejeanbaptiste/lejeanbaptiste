import { Dialog, DialogContent } from '@mui/material';
import { useActions } from '@src/overmind';
import { Provider } from 'jotai';
import { useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { IDialog } from '../type';
import { Main } from './Main';
import { Actions, Header } from './components';
import { ImportExportStore, dialogActionAtom } from './store';

export type DialogTye = Extract<'import' | 'export', IDialog['type']>;

export const ImportDialog = ({
  id = uuidv4(),
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
