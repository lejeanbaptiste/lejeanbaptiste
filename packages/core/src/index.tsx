import '@fontsource/lato/100.css';
import '@fontsource/lato/300.css';
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/lato/900.css';
import '@fortawesome/fontawesome-free/css/all.css';
import { PaletteMode } from '@mui/material';
// import '@fortawesome/fontawesome-free/webfonts/fa-regular-400.woff2';
import { createOvermind } from 'overmind';
import { Provider } from 'overmind-react';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { Subject } from 'rxjs';
import App from './App';
import type { Authority, LookupsEntityType } from './components/entityLookups/types';
import i18next from './i18n';
import { config } from './overmind';
import type { ILeafWriterOptions, LWDocument } from './types';
import './utilities/log';

export * as Types from './types';

const overmind = createOvermind(config, {
  name: 'leaf-writer',
  logProxies: true,
});

const DEFAULT_HEIGHT = '700px';

class Leafwriter {
  private readonly domElement: HTMLElement;

  private _isDirty: Subject<boolean>;
  private _onLoad: Subject<{ schemaName: string }>;

  private options?: ILeafWriterOptions;

  constructor(domElement: HTMLElement, options?: ILeafWriterOptions) {
    this.domElement = domElement;
    this._isDirty = new Subject();
    this._onLoad = new Subject();

    //scontainer height
    const containerHeight = domElement.style.height ? domElement.style.height : DEFAULT_HEIGHT;
    domElement.style.height = `clamp(400px, ${containerHeight}, 100vh)`;

    if (options) this.options = options;

    this.render();

    overmind.addMutationListener((mutation) => {
      if (mutation.path === 'editor.isEditorDirty') {
        this._isDirty.next(overmind.state.editor.isEditorDirty);
      }
      if (mutation.path === 'document.loaded') {
        if (overmind.state.document.loaded === true) {
          this._onLoad.next({ schemaName: overmind.state.document.schemaName });
        }
      }
    });
  }

  private render() {
    const root = createRoot(this.domElement);
    root.render(
      <Provider value={overmind}>
        <I18nextProvider i18n={i18next}>
          <App {...this.options} />
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

  async getContent() {
    return await overmind.actions.editor.getContent();
  }

  async setContent(document: LWDocument) {
    // TODO
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
    return overmind.state.editor.schemas;
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

  getFontSize(value: number) {
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
    overmind.actions.editor.setIsEditorDirty(value);
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
      name: LookupsEntityType;
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
    overmind.actions.ui.openSettingsDialog();
  }

  dispose() {
    //todo
    this._isDirty.complete();
    window.writer?.destroy();
  }
}

export default Leafwriter;
