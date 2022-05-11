import { Dialog } from '@mui/material';
import { useActions, useAppState } from '../../overmind';
import React, { FC, useEffect } from 'react';
import Footer from './Footer';
import Header from './Header';
import Loader from './Loader';
import Main from './Main';
import QueryField from './QueryField';

const EntityLookupDialog: FC = () => {
  const { entry, open, type } = useAppState().ui.entityLookupDialogProps;
  const { results } = useAppState().lookups;
  const { initiate, reset } = useActions().lookups;

  useEffect(() => {
    if (!open || !type) return;
    initiate({entry, type});

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

export default EntityLookupDialog;
