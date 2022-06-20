import { Context } from '../';
import Writer from '../../js/Writer';

declare global {
  interface Window {
    writer: Writer;
  }
}

export const setInitialStateSchema = ({ state }: Context, id: string) => {
  state.document.schemaId = id;
};

export const setLoaded = ({ state }: Context, value: boolean) => {
  state.document.loaded = value;
};

export const setSchema = ({ state }: Context, id: string) => {
  window.writer?.event('schemaChanged').publish(id);

  state.document.schemaId = id;
  return state.editor.schemas.find((schema) => schema.id === id);
};

export const setDocumentUrl = ({ state }: Context, url: string) => {
  state.document.url = url;
};

export const updateContent = ({ state }: Context, content: string) => {
  if (!state.document.xml) return;
  state.document.xml = content;
};

export const clear = ({ state }: Context) => {
  state.document.schemaId = '';
  state.document.url = undefined;
  state.document.xml = undefined;
};

export const loadDocumentXML = ({ actions }: Context, content: string) => {
  window.writer?.loadDocumentXML(content);
  actions.document.updateContent(content);
};
