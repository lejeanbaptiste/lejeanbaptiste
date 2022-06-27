import { Dialog } from '@mui/material';
import React, { useEffect } from 'react';
import { useActions, useAppState } from '../../overmind';
import Footer from './Footer';
import Header from './Header';
import Loader from './Loader';
import Main from './Main';
import QueryField from './QueryField';
const EntityLookupDialog = () => {
    const { entry, open, type } = useAppState().ui.entityLookupDialogProps;
    const { results } = useAppState().lookups;
    const { initiate, reset } = useActions().lookups;
    useEffect(() => {
        if (!open || !type)
            return;
        initiate({ entry, type });
        return () => {
            reset();
        };
    }, [open]);
    return (React.createElement(Dialog, { "aria-labelledby": "entity-lookup-title", fullWidth: true, maxWidth: "sm", open: open },
        React.createElement(Header, null),
        React.createElement(QueryField, null),
        !results ? React.createElement(Loader, null) : React.createElement(Main, null),
        React.createElement(Footer, null)));
};
export default EntityLookupDialog;
//# sourceMappingURL=index.js.map