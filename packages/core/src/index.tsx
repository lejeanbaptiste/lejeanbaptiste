import '@fontsource/lato/100.css';
import '@fontsource/lato/300.css';
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/lato/900.css';
import '@fortawesome/fontawesome-free/css/all.css';
import { PaletteMode } from '@mui/material';
import html2canvas from 'html2canvas';
import { createOvermind } from 'overmind';
import { Provider } from 'overmind-react';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { Subject } from 'rxjs';
import type { Authority, NamedEntityType } from './dialogs/entityLookups';
import i18next from './i18n';
import { config } from './overmind';
import type { EditorStateType } from './overmind/editor/state';
import Providers from './Providers';
import type { LeafWriterOptions, LWDocument, ScreenshotParams } from './types';
import './utilities/log';

export * as Types from './types';

const overmind = createOvermind(config, {
  name: 'LEAF-Writer',
  logProxies: true,
});

const DEFAULT_HEIGHT = '700px';

export class Leafwriter {
  private readonly domElement: HTMLElement;

  private reactReact: Root;

  private _isDirty: Subject<boolean>;
  private _onLoad: Subject<{ schemaName: string }>;
  private _onClose: Subject<boolean>;
  private _onEditorStateChange: Subject<EditorStateType>;

  private options?: LeafWriterOptions;

  constructor(domElement?: HTMLElement) {
    this.domElement = domElement;
    this._isDirty = new Subject();
    this._onLoad = new Subject();
    this._onClose = new Subject();
    this._onEditorStateChange = new Subject();

    //container height
    const containerHeight = domElement.style.height ? domElement.style.height : DEFAULT_HEIGHT;
    domElement.style.height = `clamp(400px, ${containerHeight}, 100vh)`;

    if (!this.reactReact) this.reactReact = createRoot(this.domElement);

    overmind.addMutationListener((mutation) => {
      if (mutation.path === 'editor.isEditorDirty' && mutation.hasChangedValue) {
        if (overmind.state.editor.LWChangeEventSuspended) return;
        this._isDirty.next(overmind.state.editor.isEditorDirty);
      }

      if (mutation.path === 'editor.LWChangeEventSuspended' && mutation.hasChangedValue) {
        if (overmind.state.editor.LWChangeEventSuspended) return;
        this._isDirty.next(true);
      }

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
    this.render();
  }

  private render() {
    this.reactReact.render(
      <Provider value={overmind}>
        <I18nextProvider i18n={i18next}>
          <Providers {...this.options} />
        </I18nextProvider>
      </Provider>
    );
  }

  get isDirty() {
    return this._isDirty;
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

  async getContent() {
    return await overmind.actions.editor.getContent();
  }

  async getDocumentScreenshot(
    params: ScreenshotParams = { width: 800, height: 480, windowWidth: 800, windowHeight: 1000 }
  ) {
    const page = window.writer.editor.getBody();
    if (!page) return;

    const canvas: HTMLCanvasElement | null = await html2canvas(page, {
      logging: false,
      ...params,
    }).catch(() => null);

    if (!canvas) return null;

    const screenshot = canvas.toDataURL('image/png', 1.0);

    return screenshot;
  }

  async setContent(document: LWDocument) {
    // TODO
  }

  get autosave() {
    return overmind.state.editor.autosave;
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

  setIsReadonly(value: boolean) {
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

  switchLanguage(value: string) {
    return overmind.actions.ui.switchLanguage(value);
  }

  getPossibleFontSizes() {
    return overmind.state.editor.fontSizeOptions;
  }

  getFontSize() {
    return overmind.state.editor.currentFontSize;
  }

  setFontSize(value: number) {
    overmind.actions.editor.setFontSize(value);
    return overmind.state.editor.currentFontSize;
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
    overmind.actions.editor.showEntities(value);
  }

  getIsEditorDirty() {
    overmind.state.editor.isEditorDirty;
  }

  setIsEditorDirty(value: boolean) {
    if (overmind.state.editor.isEditorDirty === value) return;
    overmind.actions.editor.setIsEditorDirty(value);
  }

  setDocumentTouched(value: boolean) {
    overmind.actions.document.setDocumentTouched(value);
  }

  resetSettings() {
    overmind.actions.editor.resetDialogWarnings();
    overmind.actions.editor.resetPreferences();
  }

  getLookups() {
    overmind.state.editor.lookups;
  }

  setLookup({}: {
    name: Authority;
    enabled?: boolean;
    prioity?: number;
    entity?: {
      name: NamedEntityType;
      enabled?: string;
    };
    config?: {
      [x: string]: any;
      username?: string;
    };
  }) {
    //todo
  }

  async validate() {
    overmind.actions.validator.validate();
  }

  async showSettingsDialog() {
    overmind.actions.ui.openDialog({ type: 'settings' });
  }

  dispose() {
    //todo
    this._isDirty.complete();
    overmind.actions.document.clear();
    window.writer?.destroy();
    window.writer = null;
  }
}

export default Leafwriter;
