import { suportedStorageProviders, type StorageProviderName } from '@src/services';
import type { IProviderAuth, Resource, StorageDialogState } from '@src/types';
import { log } from '@src/utilities';
import { saveAs } from 'file-saver';
import { Context } from '../index';

//* INIITIALIZE
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const onInitializeOvermind = async ({ state, effects }: Context, overmind: any) => {
  //templates
  state.storage.templates = await effects.storage.api.loadTemplates();

  //sample documents
  state.storage.sampleDocuments = await effects.storage.api.loadSampleDocuments();

  //Recent Files
  const recentFiles: Resource[] = effects.storage.api.getFromLocalStorage('recentFiles') ?? [];
  state.storage.recentDocuments = recentFiles;
};

export const setupStorageProvider = async ({ state, actions, effects }: Context, token: string) => {
  const identity_provider = effects.auth.api.getIdentityProvider();
  if (!identity_provider) return log.warn('No identity_provider');

  if (!state.auth.identityProviders) return;

  Object.values(state.auth.identityProviders).forEach((iDProvider) => {
    actions.storage._linkStorageProvider(iDProvider.name);
  });

  // preferredStorage
  if (!state.auth.user) return;
  //if not preferredStorage, use the first StorageProvider linked Account
  const preferredStorage = effects.storage.api.getFromLocalStorage('prefStorageProvider');

  preferredStorage
    ? (state.auth.user.prefStorageProvider = preferredStorage)
    : actions.storage.changePrefStorageProvider(state.storage.storageProviders[0]);
};

export const _linkStorageProvider = ({ state }: Context, providerName: string) => {
  if (!suportedStorageProviders.includes(providerName as StorageProviderName)) return;

  const storage = providerName as StorageProviderName;
  if (state.storage.storageProviders.includes(storage)) return;
  state.storage.storageProviders = [...state.storage.storageProviders, storage];
};

// Resource

export const setResource = async ({ state }: Context, resource?: Resource) => {
  state.storage.resource = resource ? { ...resource } : undefined;
};

export const clearResource = async ({ state }: Context) => {
  state.storage.resource = undefined;
};

export const getStorageProviderAuth = ({ actions }: Context, name: StorageProviderName) => {
  const provider = actions.auth.getIdentityProvider(name);
  if (!provider) return;
  return { name: provider.name, access_token: provider.getAccessToken() };
};

export const getStorageProvidersAuth = ({ state, actions }: Context) => {
  const providers: IProviderAuth[] = [];

  state.storage.storageProviders.forEach((provider) => {
    const identityProvider = actions.auth.getIdentityProvider(provider);
    if (identityProvider) {
      providers.push({
        name: identityProvider.name,
        access_token: identityProvider.getAccessToken(),
      });
    }
  });

  return providers;
};

export const changePrefStorageProvider = (
  { state, effects }: Context,
  StorageproviderName: string
) => {
  if (!state.auth.user) return;
  state.auth.user.prefStorageProvider = StorageproviderName;
  effects.storage.api.saveToLocalStorage('prefStorageProvider', StorageproviderName);
  return StorageproviderName;
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

export const isStorageProviderSupported = ({ state }: Context, providerName: string) => {
  return suportedStorageProviders.includes(providerName as StorageProviderName);
};

//

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const isValidXml = ({ state }: Context, string: string) => {
  const doc = new DOMParser().parseFromString(string, 'text/xml');
  const parsererror = doc.querySelector('parsererror');
  return !parsererror;
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

  // if recent already in the list, remove (and subsequently add in the first position)
  state.storage.recentDocuments = state.storage.recentDocuments.filter(
    ({ provider, owner, ownertype, repo, path, filename }) =>
      `${provider}/${owner}/${ownertype}/${repo}/${path}/${filename}` !==
      `${recent.provider}/${recent.owner}/${recent.ownertype}/${recent.repo}/${recent.path}/${recent.filename}`
  );

  recent.modifiedAt = new Date();

  //add
  state.storage.recentDocuments = [recent, ...state.storage.recentDocuments];

  //limit
  state.storage.recentDocuments = state.storage.recentDocuments.filter(
    (_item, index) => index <= 5
  );

  effects.storage.api.saveToLocalStorage('recentFiles', state.storage.recentDocuments);
};

export const updateRecentDocument = ({ state, effects }: Context) => {
  state.storage.recentDocuments = state.storage.recentDocuments.map((document) => {
    if (document.url === state.storage.resource?.url) {
      document.modifiedAt = new Date();
    }
    return document;
  });

  effects.storage.api.saveToLocalStorage('recentFiles', state.storage.recentDocuments);
};

export const removeRecentDocument = ({ state, effects }: Context, url: string) => {
  state.storage.recentDocuments = state.storage.recentDocuments.filter(
    (document) => document.url !== url
  );

  effects.storage.api.saveToLocalStorage('recentFiles', state.storage.recentDocuments);
};

export const loadTemplate = async ({ effects }: Context, url: string) => {
  const documentString = await effects.storage.api.loadTemplate(url);
  return documentString;
};

export const download = ({ state }: Context, content: string) => {
  const { resource } = state.storage;
  if (!resource) return;

  const { filename } = resource;
  if (!content || !filename) return;

  const blob = new Blob([content]); //, { type: 'text/plain;charset=utf-8' });
  saveAs(blob, filename);

  return true;
};
