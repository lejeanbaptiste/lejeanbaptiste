import { Box } from '@mui/material';
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { BottomBar, ContextMenu, EditorLocationBar, EditorToolbar } from './components';
import { createConfig } from './config';
import { EntityLookupDialog } from './dialogs';
import { useDialog, useNotifier } from './hooks';
import { configureAuthorityServices } from './jotai/entity-lookup/utilities';
import type Writer from './js/Writer';
import { useActions, useAppState } from './overmind';
import { MarkupPanel } from './panels/markup';
import { TocPanel } from './panels/toc';
import { DesktopEntitiesPanel } from './panels/entities/DesktopEntitiesPanel';
import { AutoTaggingReviewPane } from './layout/AutoTaggingReviewPane';
import { DisambiguationReviewPane, DISAMBIGUATION_PANEL_WIDTH } from './layout/DisambiguationReviewPane';
import { TranslationPane } from './layout/TranslationPane';
import type { LeafWriterOptions } from './types';
import './utilities/cursorSession';
// import { Layout } from './layout';

const CONTAINER = 'lw-layout-container';

const SourceEditorPane = lazy(() =>
  import(
    /* webpackChunkName: "leafwriter-monaco" */ './components/sourceEditor/SourceEditorPane'
  ).then((module) => ({
    default: module.SourceEditorPane,
  })),
);

const CodePanel = lazy(() =>
  import(/* webpackChunkName: "leafwriter-monaco" */ './panels/code').then((module) => ({
    default: module.CodePanel,
  })),
);

declare global {
  interface Window {
    __ljbDebugValidator?: (options?: { runValidation?: boolean }) => Promise<unknown>;
  }
}

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

const observeElement = (
  selector: string,
  onChange: (element: Element | null) => void,
): (() => void) => {
  let lastElement: Element | null = null;

  const publish = () => {
    const nextElement = document.querySelector(selector);
    if (nextElement === lastElement) return;
    lastElement = nextElement;
    onChange(nextElement);
  };

  publish();

  const observer = new MutationObserver(() => publish());
  observer.observe(document.body, { childList: true, subtree: true });

  return () => observer.disconnect();
};

const App = ({ document, settings, user }: LeafWriterOptions) => {
  const actions = useActions();
  const state = useAppState();
  const { editorViewMode, autoTaggingReview, disambiguationReview } = state.ui;
  const autoTaggingActive = autoTaggingReview?.active ?? false;
  const disambiguationActive = disambiguationReview?.active ?? false;
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
  const [autoTaggingPaneContainer, setAutoTaggingPaneContainer] = useState<Element | null>(null);
  const [disambiguationPaneContainer, setDisambiguationPaneContainer] = useState<Element | null>(null);

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
    return observeElement('#desktop-panel-translation', setTranslationPaneContainer);
  }, []);

  useEffect(() => {
    if (!isDesktopApp()) return;
    return observeElement('#desktop-panel-auto-tagging', setAutoTaggingPaneContainer);
  }, []);

  useEffect(() => {
    if (!isDesktopApp()) return;
    return observeElement('#desktop-panel-disambiguation', setDisambiguationPaneContainer);
  }, []);

  useEffect(() => {
    if (!isDesktopApp() || !writer) return;
    const disconnectToc = observeElement('#desktop-panel-toc', setTocPanelContainer);
    const disconnectMarkup = observeElement(
      '#desktop-panel-markup',
      setStructureTreePanelContainer,
    );
    const disconnectEntities = observeElement('#desktop-panel-entities', (element) => {
      setEntitiesPanelReady(!!element);
    });

    return () => {
      disconnectToc();
      disconnectMarkup();
      disconnectEntities();
    };
  }, [writer]);

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

    const { default: Writer } = await import(
      /* webpackChunkName: "leafwriter-visual-editor" */ './js/Writer'
    );
    const _writer = new Writer(config);

    //@ts-ignore
    _writer.overmindState = state;
    //@ts-ignore
    _writer.overmindActions = actions;
    window.writer = _writer;

    window.__ljbDebugValidator = (
      opts?: Parameters<typeof actions.validator.debugValidatorState>[0],
    ) => actions.validator.debugValidatorState(opts);

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
              <Suspense fallback={null}>
                <SourceEditorPane
                  key={state.document.url ?? state.document.schemaId ?? 'source'}
                />
              </Suspense>,
              sourceEditorPaneContainer,
            )}
          {tocPanelContainer && createPortal(<TocPanel />, tocPanelContainer)}
          {structureTreePanelContainer &&
            !isReadonly &&
            createPortal(<MarkupPanel />, structureTreePanelContainer)}
          {codePanelContainer &&
            !isReadonly &&
            showRawXmlPanel &&
            createPortal(
              <Suspense fallback={null}>
                <CodePanel />
              </Suspense>,
              codePanelContainer,
            )}
          {entitiesPanelReady && isDesktopApp() && <DesktopEntitiesPanel />}
          {translationPaneContainer &&
            createPortal(<TranslationPane />, translationPaneContainer)}
          {autoTaggingPaneContainer &&
            createPortal(<AutoTaggingReviewPane />, autoTaggingPaneContainer)}
          {disambiguationPaneContainer &&
            createPortal(<DisambiguationReviewPane />, disambiguationPaneContainer)}
          {!isDesktopApp() && autoTaggingActive && (
            <Box
              sx={{
                position: 'fixed',
                right: 0,
                top: 0,
                bottom: 0,
                width: 380,
                zIndex: 1300,
                boxShadow: 4,
              }}
            >
              <AutoTaggingReviewPane />
            </Box>
          )}
          {!isDesktopApp() && disambiguationActive && (
            <Box
              sx={{
                position: 'fixed',
                right: 0,
                top: 0,
                bottom: 0,
                width: DISAMBIGUATION_PANEL_WIDTH,
                zIndex: 1300,
                boxShadow: 4,
              }}
            >
              <DisambiguationReviewPane />
            </Box>
          )}
        </div>
      </Box>
      {/* //* WIP {docLoaded && <Layout />} */}
      <BottomBar />
    </Box>
  );
};

export default App;
