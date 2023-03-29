import { RECENT_DOCUMENTS_LIMIT } from '@src/config';
import type { Resource, StorageDialogState } from '@src/types';
import { saveAs } from 'file-saver';
import { Context } from '../index';

export const setPrefStorageProvider = ({ state, effects }: Context, providerId: string) => {
  if (!state.auth.user) return;

  const prefIsStorageProvider = state.providers.storageProviders.some(
    (provider) => provider.providerId === providerId && !!provider.service
  );

  if (!prefIsStorageProvider) {
    effects.storage.api.removeFromLocalStorage('prefStorageProvider');
    return;
  }

  state.auth.user.prefStorageProvider = providerId;
  effects.storage.api.saveToLocalStorage('prefStorageProvider', providerId);

  return providerId;
};

export const openStorageDialog = async (
  { state }: Context,
  storageDialogState: Omit<StorageDialogState, 'open'>
) => {
  state.storage.storageDialogState = { open: true, ...storageDialogState };
};

export const closeStorageDialog = async ({ state }: Context) => {
  state.storage.storageDialogState = { open: false };
};

export const addToRecentDocument = ({ state, effects }: Context, document: Resource) => {
  const { content, hash, ...recent } = document;

  if (
    recent.provider === undefined ||
    recent.owner === undefined ||
    recent.ownertype === undefined ||
    recent.repo === undefined ||
    recent.path === undefined ||
    recent.filename === undefined
  ) {
    return;
  }

  if (!state.storage.recentDocuments) state.storage.recentDocuments = [];

  // if recent document already in the list, remove (and subsequently add in the first position)
  const newRecents = state.storage.recentDocuments.filter(({ url }) => url !== recent.url);

  recent.modifiedAt = new Date();

  //add
  state.storage.recentDocuments = [recent, ...newRecents];

  //limit
  state.storage.recentDocuments = state.storage.recentDocuments.filter(
    (_item, index) => index <= RECENT_DOCUMENTS_LIMIT
  );

  effects.storage.api.saveToLocalStorage('recentFiles', state.storage.recentDocuments);
};

export const downloadImage = async ({ state }: Context, screenshot: string) => {
  const fakeLink = window.document.createElement('a');
  //@ts-ignore
  fakeLink.style = 'display:none;';
  fakeLink.download = 'doc';

  fakeLink.href = screenshot;

  document.body.appendChild(fakeLink);
  fakeLink.click();
  document.body.removeChild(fakeLink);

  fakeLink.remove();
};

export const updateRecentDocument = ({ state, actions, effects }: Context) => {
  if (!state.storage.recentDocuments) return;

  state.storage.recentDocuments = state.storage.recentDocuments.map((document) => {
    if (document.url === state.editor.resource?.url) {
      document.modifiedAt = new Date();
      if (state.editor.resource?.screenshot) document.screenshot = state.editor.resource.screenshot;
    }
    return document;
  });

  effects.storage.api.saveToLocalStorage('recentFiles', state.storage.recentDocuments);
};

export const removeRecentDocument = ({ state, effects }: Context, url: string) => {
  if (!state.storage.recentDocuments) return;

  const { api } = effects.storage;

  const recentDocuments = state.storage.recentDocuments.filter((document) => document.url !== url);

  state.storage.recentDocuments = recentDocuments;
  api.saveToLocalStorage('recentFiles', state.storage.recentDocuments);

  if (recentDocuments.length === 0) api.removeFromLocalStorage('recentFiles');
};

export const loadRecentFiles = async ({ state, effects }: Context) => {
  const recentFiles: Resource[] = effects.storage.api.getFromLocalStorage('recentFiles') ?? [];
  state.storage.recentDocuments = recentFiles;
  return recentFiles;
};

export const getSampleDocuments = async ({ effects }: Context) => {
  const documents = await effects.storage.api.loadCollection('samples');
  return documents;
};

export const getTemplates = async ({ effects }: Context) => {
  const documents = await effects.storage.api.loadCollection('templates');
  return documents;
};

export const loadSample = async ({ effects }: Context, url: string) => {
  const documentString = await effects.storage.api.loadSample(url);
  return documentString;
};

export const download = ({ state }: Context, {content, filename}: {content: string; filename: string;}) => {
  const blob = new Blob([content]); //, { type: 'text/plain;charset=utf-8' });
  saveAs(blob, filename);
  return true;
};

export const convertXMLtoHTML = async ({ effects }: Context, value: string) => {
  const data = await effects.storage.api.convertXMLtoHTML(value);
  return data;
};