import { Box, ThemeProvider, useMediaQuery } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import React, { useEffect, useState } from 'react';
import BottomBar from './components/bottombar';
import ContextMenu from './components/contextmenu';
import EditSourceDialog from './components/editSource';
import EntityLookupDialog from './components/entityLookups';
import Popup from './components/popup';
import SetingsDialog from './components/settings';
import { createConfig } from './config';
import Writer from './js/Writer';
import { useActions, useAppState } from './overmind';
import theme from './theme';
const CONTAINER = 'leafwriterContainer';
const App = ({ document, settings, user }) => {
    const actions = useActions();
    const state = useAppState();
    const [writer, setWriter] = useState(null);
    const preferDark = useMediaQuery('(prefers-color-scheme: dark)');
    useEffect(() => {
        if (state.ui.themeAppearance === 'auto')
            actions.ui.setDarkMode(preferDark);
        return () => { };
    }, [preferDark]);
    useEffect(() => {
        if (document.url === undefined || state.document.url !== document.url) {
            if (writer)
                writer.destroy();
            actions.document.setLoaded(false);
            window.writer = null;
            setWriter(null);
            setup();
        }
    }, [document]);
    const setup = async () => {
        const config = createConfig(settings);
        const { credentials } = settings;
        config.container = CONTAINER;
        actions.document.clear();
        actions.editor.clear();
        actions.editor.writerInitSettings(config);
        if (credentials?.nssiToken)
            actions.editor.setNssiToken(credentials.nssiToken);
        actions.editor.initiateLookupSources(settings.lookups);
        actions.user.setUser(user);
        const _writer = new Writer(config);
        //@ts-ignore
        _writer.overmindState = state;
        //@ts-ignore
        _writer.overmindActions = actions;
        window.writer = _writer;
        //@ts-ignore
        _writer.event('writerInitialized').subscribe(() => {
            actions.document.setDocumentUrl(document.url);
            _writer.setDocument(document.xml);
            setWriter(window.writer);
        });
        _writer.event('documentLoaded').subscribe((success) => {
            actions.document.setLoaded(true);
        });
    };
    return (React.createElement(ThemeProvider, { theme: theme(state.ui.darkMode) },
        React.createElement(SnackbarProvider, null,
            React.createElement(Box, { id: CONTAINER, sx: {
                    height: 'calc(100% - 32px)',
                    width: '100%',
                } }),
            writer && React.createElement(ContextMenu, { writer: writer }),
            React.createElement(BottomBar, null),
            React.createElement(Popup, null),
            React.createElement(EditSourceDialog, null),
            React.createElement(EntityLookupDialog, null),
            React.createElement(SetingsDialog, null))));
};
export default App;
//# sourceMappingURL=App.js.map