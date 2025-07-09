import $ from 'jquery';
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

export const setRootname = ({ state }: Context, value: string) => {
  state.document.rootName = value;
};

export const setSchema = ({ state }: Context, id: string) => {
  window.writer?.event('schemaChanged').publish(id);

  state.document.schemaId = id;
  return state.editor.schemasList.find((schema) => schema.id === id);
};

export const setDocumentUrl = ({ state }: Context, url?: string) => {
  state.document.url = url;
};

export const updateContent = ({ state }: Context, content: string) => {
  if (!state.document.xml) return;
  state.document.xml = content;
};

export const updateXMLHeader = ({ state }: Context, content: string) => {
  const parser = new DOMParser();

  const xml = parser.parseFromString(content, 'application/xml');
  const errorNode = xml.querySelector('parsererror');

  if (errorNode) {
    window.writer.dialogManager.show('message', {
      title: 'Invalid XML',
      msg: 'There was an error parsing the XML.',
      type: 'error',
    });
    return false;
  }

  let newHeaderString = '';

  $(xml)
    .find(window.writer.schemaManager.getHeader())
    .children()
    .each((index, element) => {
      newHeaderString += window.writer.converter.buildEditorString(element);
    });

  const _header = $(
    `[_tag="${window.writer.schemaManager.getHeader()}"]`,
    window.writer.editor?.getBody(),
  );

  _header.html(newHeaderString);

  state.editor.contentHasChanged = true;
};

export const clear = ({ state }: Context) => {
  state.document.loaded = false;
  state.document.rootName = undefined;
  state.document.schemaId = '';
  state.document.loaded = false;
  state.document.url = undefined;
  state.document.xml = undefined;
  state.document.isReload = false;
};

export const loadDocumentXML = ({ actions, state }: Context, content: string) => {
  window.writer?.loadDocumentXML(content);
  actions.document.updateContent(content);
  if (state.document.isReload) state.editor.contentHasChanged = true;
};

export const setDocumentTouched = ({ state }: Context, value: boolean) => {
  state.document.touched = value;
};

export const setIsReload = ({ state }: Context, value: boolean) => {
  state.document.isReload = value;
};

export const storeStandOffTags = ({ state }: Context, value: string[]) => {
  state.document.standOffTags = value;
};
