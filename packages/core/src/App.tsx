import { Box } from '@mui/material';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { BottomBar, ContextMenu, EditorToolbar } from './components';
import { createConfig } from './config';
import { EntityLookupDialog } from './dialogs';
import { useDialog, useNotifier } from './hooks';
import Writer from './js/Writer';
import { useActions, useAppState } from './overmind';
import { CodePanel, MarkupPanel, TocPanel } from './panels';
import type { LeafWriterOptions } from './types';
// import { Layout } from './layout';

const CONTAINER = 'lw-layout-container';

const App = ({ document, settings, user }: LeafWriterOptions) => {
  const actions = useActions();
  const state = useAppState();
  const [writer, setWriter] = useState<Writer | null>(null);
  const { i18n } = useTranslation();

  useDialog();
  useNotifier();

  const [editorToobarContainer, setEditorToobarContainer] = useState<Element | null>(null);
  const [codePanelContainer, setCodePanelContainer] = useState<Element | null>(null);
  const [tocPanelContainer, setTocPanelContainer] = useState<Element | null>(null);
  const [structureTreePanelContainer, setStructureTreePanelContainer] = useState<Element | null>(
    null,
  );

  const [initialized, setInitialized] = useState(false);
  const [docLoaded, setDocLoaded] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    i18n.changeLanguage(state.ui.language.code);
  }, [state.ui.language]);

  useEffect(() => {
    window.document.addEventListener('fullscreenchange', fullscreenchanged);
    window.addEventListener('changeLanguage', actions.ui.listenChangeLanguage);
    window.addEventListener('changeTheme', actions.ui.listenChangeTheme);
    return () => {
      window.document.removeEventListener('fullscreenchange', fullscreenchanged);
      window.removeEventListener('changeLanguage', actions.ui.listenChangeLanguage);
      window.addEventListener('changeTheme', actions.ui.listenChangeTheme);
    };
  }, []);

  useEffect(() => {
    if (document.url === undefined || state.document.url !== document.url) {
      // if (writer) writer.destroy();
      actions.document.setDocumentTouched(false);
      actions.document.setLoaded(false);
      // window.writer = null;
      setWriter(null);
      setup();
    }
  }, [document]);

  useEffect(() => {
    if (ready) actions.ui.updateReadonly();
  }, [ready, state.editor.isReadonly]);

  const fullscreenchanged = () => actions.ui.setFullscreen(!!window.document.fullscreenElement);

  const setup = async () => {
    const config = await createConfig(settings);

    config.container = CONTAINER;

    actions.document.clear();
    actions.editor.clear();

    actions.editor.writerInitSettings(config);

    if (settings?.credentials?.nssiToken) {
      actions.editor.setNssiToken(settings.credentials.nssiToken);
    }

    await actions.editor.configureAuthorityServices(settings?.authorityServices);

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

      const toolbarContainer = window.document.querySelector('#editor-toolbar');
      const _codePanelContainer = window.document.querySelector(`#${_writer.editorId}-code`);
      const _tocPanelContainer = window.document.querySelector(`#${_writer.editorId}-toc`);
      const _structureTreePanelContainer = window.document.querySelector(
        `#${_writer.editorId}-markup`,
      );

      setEditorToobarContainer(toolbarContainer);
      setTocPanelContainer(_tocPanelContainer);
      setCodePanelContainer(_codePanelContainer);
      setStructureTreePanelContainer(_structureTreePanelContainer);

      setTimeout(() => _writer.layoutManager.resizeEditor(), 50);
    });

    _writer.event('documentLoaded').subscribe((success: boolean) => {
      if (!success) return;
      actions.document.setLoaded(true);
      setInitialized(true);
      setDocLoaded(true);
    });

    setReady(true);
  };

  return (
    <>
      <Box id={CONTAINER} sx={{ height: 'calc(100% - 32px)', width: '100%' }}>
        {writer && <ContextMenu />}
        <EntityLookupDialog />
        <div>
          {editorToobarContainer && createPortal(<EditorToolbar />, editorToobarContainer)}
          {tocPanelContainer && createPortal(<TocPanel />, tocPanelContainer)}
          {structureTreePanelContainer &&
            !state.editor.isReadonly &&
            createPortal(<MarkupPanel />, structureTreePanelContainer)}
          {codePanelContainer &&
            !state.editor.isReadonly &&
            createPortal(<CodePanel />, codePanelContainer)}
        </div>
      </Box>
      {/* //* WIP {docLoaded && <Layout />} */}
      <BottomBar />
    </>
  );
};

export default App;
