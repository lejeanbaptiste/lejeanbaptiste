import '@fontsource/lato/100.css';
import '@fontsource/lato/300.css';
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/lato/900.css';
import '@fortawesome/fontawesome-free/css/fontawesome.css';
import '@fortawesome/fontawesome-free/css/solid.css';
import '@fortawesome/fontawesome-free/css/regular.css';
import { PaletteMode } from '@mui/material';
import * as Sentry from '@sentry/react';
import Dexie from 'dexie';
import html2canvas from 'html2canvas';
import { nanoid } from 'nanoid';
import { createOvermind } from 'overmind';
import { Provider } from 'overmind-react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { Subject } from 'rxjs';
import './i18n';
import i18next from './i18n';
import type Writer from './js/Writer';
import { config } from './overmind';
import type { EditorStateType } from './overmind/editor/state';
import Providers from './Providers';
import { JotaiProvider } from './providers/jotai-provider';
import { getSentryConfig } from './sentry-config';
import type { LeafWriterOptions, LWDocument, ScreenshotParams } from './types';
import './utilities/log';

declare global {
  interface Window {
    writer: Writer;
  }
}

export { clearCache, deleteDb } from './db';
export {
  FIXED_LANGUAGE_OPTIONS,
  canonicalLanguageCode,
  isChineseLanguageCode,
  isEastAsianCalendarLanguageCode,
  isKnownLanguageCode,
  languageLabelForCode,
} from './utilities/languageCodes';
export type { LanguageOption } from './utilities/languageCodes';
export {
  EastAsianDateFields,
  useDateAuthority,
  isDateAuthorityAvailable,
  readEastAsianDateValues,
  eastAsianValuesToAttributes,
  hasEastAsianCalendarContext,
  mergeEastAsianIntoAttributes,
} from './dateAuthority';
export type { EastAsianDateValues, DateAuthorityIndex } from './dateAuthority';
export { entityLookupDialogAtom } from './jotai/entity-lookup';
export { SETTINGS_BOOTSTRAP_URL } from './constants/settingsBootstrap';
export * as Types from './types';
export {
  buildDocxDocument,
  buildMarkdownDocument,
  buildOdtDocument,
  buildPlainTextDocument,
  buildRtfDocument,
  collectAllUnitIds,
  findUnitByCorresp,
  findUnitById,
} from './js/conversion/documentExport';
export type {
  ExportBiblEntry,
  ExportUnitPair,
  RenderedBiblEntry,
} from './js/conversion/documentExport';

const overmind = createOvermind(config, {
  name: 'LEAF-Writer',
  logProxies: true,
});

const DEFAULT_HEIGHT = '700px';

export class Leafwriter {
  private readonly _id: string;
  private readonly domElement: HTMLElement;

  private reactReact: Root | undefined;

  onContentHasChanged: Subject<boolean>;
  private _onLoad: Subject<{ schemaName: string }>;
  private _onClose: Subject<boolean>;
  private _onEditorStateChange: Subject<EditorStateType>;

  private options?: LeafWriterOptions;

  static async clearDB() {
    await Dexie.delete('LEAF-Writer-Validator');
    await Dexie.delete('LEAF-Writer');
  }

  constructor(domElement: HTMLElement) {
    this._id = nanoid();
    this.domElement = domElement;
    this.onContentHasChanged = new Subject();
    this._onLoad = new Subject();
    this._onClose = new Subject();
    this._onEditorStateChange = new Subject();

    // Container height: use 100% when embedded in a flex parent (desktop shell); otherwise default.
    if (domElement.style.height) {
      domElement.style.height = `clamp(400px, ${domElement.style.height}, 100vh)`;
    } else if (domElement.parentElement && domElement.parentElement.clientHeight > 0) {
      domElement.style.height = '100%';
      domElement.style.minHeight = '0';
      domElement.style.display = 'flex';
      domElement.style.flexDirection = 'column';
    } else {
      domElement.style.height = `clamp(400px, ${DEFAULT_HEIGHT}, 100vh)`;
    }

    if (!this.reactReact) this.reactReact = createRoot(this.domElement);

    overmind.addMutationListener((mutation) => {
      if (mutation.path === 'editor.contentHasChanged' && mutation.hasChangedValue) {
        if (overmind.state.editor.LWChangeEventSuspended) return;
        this.onContentHasChanged.next(overmind.state.editor.contentHasChanged);
      }

      // if (mutation.path === 'editor.LWChangeEventSuspended' && mutation.hasChangedValue) {
      //   if (overmind.state.editor.LWChangeEventSuspended) return;
      //   this.onContentHasChanged.next(true);
      // }

      if (mutation.path === 'document.loaded') {
        if (overmind.state.document.loaded === true) {
          this._onLoad.next({ schemaName: overmind.state.document.schemaName });
        }
      }

      if (mutation.path === 'editor.latestEvent') {
        if (overmind.state.editor.latestEvent === 'close') {
          this._onClose.next(true);
          this._onClose.complete();
        }
      }

      if (mutation.path.split('.')[0] === 'editor') {
        this._onEditorStateChange.next(overmind.state.editor);
      }
    });
  }

  init(options: LeafWriterOptions) {
    this.options = options;
    const sentryConfig = options.settings?.telemetry?.sentryConfig;
    if (sentryConfig?.dsn) Sentry.init(getSentryConfig(sentryConfig));
    this.render();
  }

  private render() {
    if (!this.reactReact || !this.options) return;

    this.reactReact.render(
      <Sentry.ErrorBoundary
        beforeCapture={(scope) => {
          scope.setTags({ section: 'LEAF-Writer-Editor' });
        }}
        fallback={<p>{i18next.t('LW.error.an_error_has_occurred')}</p>}
      >
        <JotaiProvider>
          <Provider value={overmind}>
            <I18nextProvider i18n={i18next}>
              <Providers {...this.options} />
            </I18nextProvider>
          </Provider>
        </JotaiProvider>
      </Sentry.ErrorBoundary>,
    );
  }

  get id() {
    return this._id;
  }

  get onLoad() {
    return this._onLoad;
  }

  get onClose() {
    return this._onClose;
  }

  get onEditorStateChange() {
    return this._onEditorStateChange;
  }

  getDocumentRootName() {
    return overmind.state.document.rootName;
  }

  async getContent() {
    return await overmind.actions.editor.getContent();
  }

  isReload() {
    return overmind.state.document.isReload;
  }

  async getDocumentScreenshot(
    params: ScreenshotParams = { width: 800, height: 480, windowWidth: 800, windowHeight: 1000 },
  ) {
    const page = window.writer.editor?.getBody();
    if (!page) return;

    const canvas: HTMLCanvasElement | null = await html2canvas(page, {
      logging: false,
      ...params,
    }).catch(() => null);

    if (!canvas) return;

    const screenshot = canvas.toDataURL('image/png', 1.0);

    return screenshot;
  }

  async setContent(_document: LWDocument) {
    // TODO
  }

  get autosave() {
    return overmind.state.editor.autosave ?? false;
  }

  set autosave(value: boolean) {
    overmind.actions.editor.setAutosave(value);
  }

  getAllowOverlap() {
    return overmind.state.editor.allowOverlap;
  }

  getAnnotationMode() {
    return overmind.state.editor.annotationMode;
  }

  getAnnotationModes() {
    return overmind.state.editor.annotationModes;
  }

  setAnnotationrMode(value: number) {
    return overmind.actions.editor.setAnnotationrMode(value);
  }

  getEditorMode() {
    return overmind.state.editor.editorMode;
  }
  getEditorModes() {
    return overmind.state.editor.editorModes;
  }

  setEditorMode(value: string) {
    return overmind.actions.editor.setEditorMode(value);
  }

  isAnnotator() {
    return overmind.state.editor.isAnnotator;
  }

  setIsAnnotator(value: boolean) {
    return overmind.actions.editor.setIsAnnotator(value);
  }

  isReadonly() {
    return overmind.state.editor.isReadonly;
  }

  setReadonly(value: boolean) {
    return overmind.actions.editor.setReadonly(value);
  }

  getSchemas() {
    return overmind.state.editor.schemasList;
  }

  setDocumentSchema(schemaId: string) {
    return overmind.actions.document.setSchema(schemaId);
  }

  setDarkMode(value: boolean) {
    return overmind.actions.ui.setDarkMode(value);
  }

  setThemeAppearance(value: PaletteMode) {
    return overmind.actions.ui.setThemeAppearance(value);
  }

  switchLocale(value: string) {
    return overmind.actions.ui.switchLocale(value);
  }

  getFontSize() {
    return overmind.state.editor.fontSize;
  }

  setFontSize(value: number) {
    overmind.actions.editor.setFontSize(value);
    return overmind.state.editor.fontSize;
  }

  getShowTags() {
    overmind.state.editor.showTags;
  }

  setShowTags(value: boolean) {
    overmind.actions.editor.toggleShowTags(value);
  }

  getShowEntities() {
    overmind.state.editor.showEntities;
  }

  setShowEntities(value: boolean) {
    overmind.actions.editor.setShowEntities(value);
  }

  getContentHasChanged() {
    overmind.state.editor.contentHasChanged;
  }

  setContentHasChanged(value: boolean) {
    if (overmind.state.editor.contentHasChanged === value) return;
    overmind.actions.editor.setContentHasChanged(value);
  }

  setDocumentTouched(value: boolean) {
    overmind.actions.document.setDocumentTouched(value);
  }

  async resetSettings() {
    await overmind.actions.editor.resetDialogWarnings();
    overmind.actions.editor.resetPreferences();
  }

  async validate() {
    overmind.actions.validator.validate();
  }

  async isValid() {
    overmind.state.validator.validationErrors === 0;
  }

  async showSettingsDialog(options?: { onClose?: (action?: string) => void }) {
    overmind.actions.ui.openDialog({
      type: 'settings',
      props: options?.onClose ? { onClose: options.onClose } : undefined,
    });
  }

  closeForegroundPopup(): boolean {
    return overmind.actions.ui.closeForegroundPopup();
  }

  dispose() {
    this.onContentHasChanged.complete();

    if (window.writer) {
      window.writer.destroy();
      window.writer = undefined as unknown as Writer;
    }

    if (this.reactReact) {
      this.reactReact.unmount();
      this.reactReact = undefined;
    }

    overmind.actions.document.clear();
    overmind.actions.editor.clear();
    overmind.actions.user.clear();
  }
}

export default Leafwriter;
