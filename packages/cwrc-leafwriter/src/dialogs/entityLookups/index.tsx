import { Dialog } from '@mui/material';
import { useEffect } from 'react';
import { useActions, useAppState } from '../../overmind';
import Footer from './Footer';
import Header from './Header';
import Loader from './Loader';
import Main from './Main';
import QueryField from './QueryField';

export const EntityLookupDialog = () => {
  const { entry, open, type } = useAppState().ui.entityLookupDialogProps;
  const { results } = useAppState().lookups;
  const { initiate, reset } = useActions().lookups;

  useEffect(() => {
    if (!open || !type) return;
    initiate({ entry, type });

    return () => {
      reset();
    };
  }, [open]);

  return (
    <Dialog aria-labelledby="entity-lookup-title" fullWidth maxWidth="sm" open={open}>
      <Header />
      <QueryField />
      {!results ? <Loader /> : <Main />}
      <Footer />
    </Dialog>
  );
};
