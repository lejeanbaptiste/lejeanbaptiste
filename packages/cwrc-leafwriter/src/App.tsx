import { Box } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { BottomBar, ContextMenu, EditorLocationBar, EditorToolbar } from './components';
import { SourceEditorPane } from './components/sourceEditor';
import { createConfig } from './config';
import { EntityLookupDialog } from './dialogs';
import { useDialog, useNotifier } from './hooks';
import { configureAuthorityServices } from './jotai/entity-lookup/utilities';
import Writer from './js/Writer';
import { useActions, useAppState } from './overmind';
import { CodePanel, MarkupPanel, TocPanel } from './panels';
import { DesktopEntitiesPanel } from './panels/entities/DesktopEntitiesPanel';
import { TranslationPane } from './layout/TranslationPane';
import type { LeafWriterOptions } from './types';
import './utilities/cursorSession';
// import { Layout } from './layout';

const CONTAINER = 'lw-layout-container';

const isDesktopApp = () => typeof window !== 'undefined' && !!window.electronAPI;

const waitForElement = (selector: string, timeoutMs = 5000): Promise<Element> =>
  new Promise((resolve, reject) => {
    const started = Date.now();
    const check = () => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Element not found: ${selector}`));
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });

const App = ({ document, settings, user }: LeafWriterOptions) => {
  const actions = useActions();
  const state = useAppState();
  const { editorViewMode } = state.ui;
  const { isReadonly, showRawXmlPanel } = state.editor;
  const [writer, setWriter] = useState<Writer | null>(null);
  const { i18n } = useTranslation();

  useDialog();
  useNotifier();

  const [editorToobarContainer, setEditorToobarContainer] = useState<Element | null>(null);
  const [editorLocationBarContainer, setEditorLocationBarContainer] = useState<Element | null>(
    null,
  );
  const [sourceEditorPaneContainer, setSourceEditorPaneContainer] = useState<Element | null>(null);
  const [codePanelContainer, setCodePanelContainer] = useState<Element | null>(null);
  const [tocPanelContainer, setTocPanelContainer] = useState<Element | null>(null);
  const [structureTreePanelContainer, setStructureTreePanelContainer] = useState<Element | null>(
    null,
  );
  const [entitiesPanelReady, setEntitiesPanelReady] = useState(false);
  const [translationPaneContainer, setTranslationPaneContainer] = useState<Element | null>(null);

  const [initialized, setInitialized] = useState(false);
  const [docLoaded, setDocLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const setupInProgressRef = useRef(false);

  useEffect(() => {
    i18n.changeLanguage(state.ui.currentLocale);
  }, [state.ui.currentLocale]);

  useEffect(() => {
    window.document.addEventListener('fullscreenchange', fullscreenchanged);
    window.addEventListener('changeLanguage', actions.ui.listenChangeLanguage);
    window.addEventListener('changeTheme', actions.ui.listenChangeTheme);
    return () => {
      window.document.removeEventListener('fullscreenchange', fullscreenchanged);
      window.removeEventListener('changeLanguage', actions.ui.listenChangeLanguage);
      window.removeEventListener('changeTheme', actions.ui.listenChangeTheme);
    };
  }, []);

  useEffect(() => {
    if (document.url === undefined) return;

    const alreadyLoaded = state.document.url === document.url && !!window.writer;
    const shouldSetup = !alreadyLoaded;
    if (!shouldSetup) return;

    actions.document.setDocumentTouched(false);
    actions.document.setLoaded(false);
    setWriter(null);
    setup();
  }, [document.url]);

  useEffect(() => {
    if (ready) actions.ui.updateReadonly();
  }, [ready, state.editor.isReadonly]);

  // The translation tab's mount point only exists once at least one language is
  // configured, which can happen at any point during the session (via Edition
  // metadata) — so keep retrying rather than waiting once at startup.
  useEffect(() => {
    if (!isDesktopApp()) return;
    let cancelled = false;

    const tryFind = () => {
      const el = window.document.querySelector('#desktop-panel-translation');
      if (el) {
        if (!cancelled) setTranslationPaneContainer(el);
        return;
      }
      if (!cancelled) setTimeout(tryFind, 1000);
    };
    tryFind();

    return () => {
      cancelled = true;
    };
  }, []);

  const fullscreenchanged = () => actions.ui.setFullscreen(!!window.document.fullscreenElement);

  const setup = async () => {
    if (setupInProgressRef.current) {
      return;
    }
    setupInProgressRef.current = true;
    try {
    const config = await createConfig(settings);

    config.container = CONTAINER;

    actions.document.clear();
    actions.editor.clear();

    actions.editor.writerInitSettings(config);

    if (settings?.locale) actions.ui.switchLocal(settings.locale);

    configureAuthorityServices(settings?.authorityServices);

    actions.user.setUser(user);

    await waitForElement(`#${CONTAINER}`);

    const _writer = new Writer(config);

    //@ts-ignore
    _writer.overmindState = state;
    //@ts-ignore
    _writer.overmindActions = actions;
    window.writer = _writer;

    //@ts-ignore
    _writer.event('writerInitialized').subscribe(() => {
      actions.document.setDocumentUrl(document.url);

      if (document.xml) {
        actions.document.setDocumentXml(document.xml);
      }

      _writer.setDocument(document.xml);

      setWriter(window.writer);

      const desktopToolbarRow = isDesktopApp()
        ? window.document.querySelector('#desktop-toolbar-row')
        : null;
      const legacyToolbarEl = window.document.querySelector('#editor-toolbar');
      if (desktopToolbarRow && legacyToolbarEl instanceof HTMLElement) {
        legacyToolbarEl.style.display = 'none';
      }

      const toolbarContainer = desktopToolbarRow ?? legacyToolbarEl;
      const locationBarContainer = window.document.querySelector('#editor-location-bar');
      const sourceEditorPane = window.document.querySelector('#source-editor-pane');
      const _codePanelContainer = window.document.querySelector(`#${_writer.editorId}-code`);

      setEditorToobarContainer(toolbarContainer);
      setEditorLocationBarContainer(locationBarContainer);
      setSourceEditorPaneContainer(sourceEditorPane);
      setCodePanelContainer(_codePanelContainer);

      if (isDesktopApp()) {
        void (async () => {
          try {
            const [_tocPanelContainer, _structureTreePanelContainer, _entitiesPanelContainer] =
              await Promise.all([
                waitForElement('#desktop-panel-toc'),
                waitForElement('#desktop-panel-markup'),
                waitForElement('#desktop-panel-entities'),
              ]);

            setTocPanelContainer(_tocPanelContainer);
            setStructureTreePanelContainer(_structureTreePanelContainer);
            setEntitiesPanelReady(!!_entitiesPanelContainer);
          } catch {
            console.warn('Desktop left panel mount points not found');
          }
        })();
      } else {
        const _tocPanelContainer = window.document.querySelector(`#${_writer.editorId}-toc`);
        const _structureTreePanelContainer = window.document.querySelector(
          `#${_writer.editorId}-markup`,
        );

        setTocPanelContainer(_tocPanelContainer);
        setStructureTreePanelContainer(_structureTreePanelContainer);
      }

      setTimeout(() => _writer.layoutManager.resizeEditor(), 50);
    });

    _writer.event('documentLoaded').subscribe((success: boolean) => {
      if (!success) return;
      if (document.xml) {
        actions.document.setDocumentXml(document.xml);
      }
      actions.document.setLoaded(true);
      setInitialized(true);
      setDocLoaded(true);
    });

    setReady(true);
    } finally {
      setupInProgressRef.current = false;
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, width: '100%' }}>
      <Box id={CONTAINER} sx={{ flex: 1, minHeight: 0, width: '100%' }}>
        {writer && <ContextMenu />}
        <EntityLookupDialog />
        <div>
          {editorLocationBarContainer &&
            createPortal(<EditorLocationBar />, editorLocationBarContainer)}
          {editorToobarContainer &&
            editorViewMode === 'visual' &&
            createPortal(<EditorToolbar />, editorToobarContainer)}
          {sourceEditorPaneContainer &&
            !isReadonly &&
            editorViewMode === 'source' &&
            createPortal(
              <SourceEditorPane key={state.document.url ?? state.document.schemaId ?? 'source'} />,
              sourceEditorPaneContainer,
            )}
          {tocPanelContainer && createPortal(<TocPanel />, tocPanelContainer)}
          {structureTreePanelContainer &&
            !isReadonly &&
            createPortal(<MarkupPanel />, structureTreePanelContainer)}
          {codePanelContainer &&
            !isReadonly &&
            showRawXmlPanel &&
            createPortal(<CodePanel />, codePanelContainer)}
          {entitiesPanelReady && isDesktopApp() && <DesktopEntitiesPanel />}
          {translationPaneContainer &&
            createPortal(<TranslationPane />, translationPaneContainer)}
        </div>
      </Box>
      {/* //* WIP {docLoaded && <Layout />} */}
      <BottomBar />
    </Box>
  );
};

export default App;
