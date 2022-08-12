import type { IProviderAuth, Resource, StorageDialogState } from '@src/types';
import { log } from '@src/utilities/log';
import { StorageProviderName, suportedStorageProviders } from '../../services';
import { Context } from '../index';

//* INIITIALIZE
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const onInitializeOvermind = async ({ state }: Context, overmind: any) => {
  //Recent Files
  const recentFilesSTRING = localStorage.getItem('recentFiles') ?? '[]';
  const recentFiles: Resource[] = JSON.parse(recentFilesSTRING);
  state.storage.recentDocuments = recentFiles;
};

export const setupStorageProvider = async ({ state, actions, effects }: Context, token: string) => {
  const identity_provider = effects.auth.api.getIdentityProvider();
  if (!identity_provider) return log.warn('No identity_provider');

  if (!state.auth.identityProviders) return;

  Object.values(state.auth.identityProviders).forEach((iDProvider) => {
    actions.storage._linkStorageProvider(iDProvider.name);
  });

  //preferredStorage

  if (!state.auth.user) return;
  //if not preferredStorage, use the first StorageProvider linked Account
  const preferredStorage = localStorage.getItem('prefStorageProvider');

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
  // if (resource) state.resource = resource;
  state.storage.resource = resource ? { ...resource } : undefined;
  // state.storage.resource = resource;
};

export const clearResource = async ({ state }: Context) => {
  state.storage.resource = undefined;
};

export const getStorageProviderAuth = ({ state, actions }: Context, name: StorageProviderName) => {
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

export const changePrefStorageProvider = ({ state }: Context, StorageproviderName: string) => {
  if (!state.auth.user) return;
  state.auth.user.prefStorageProvider = StorageproviderName;
  localStorage.setItem('prefStorageProvider', StorageproviderName);
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

export const addToRecentDocument = ({ state }: Context, document: Resource) => {
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
  state.storage.recentDocuments = state.storage.recentDocuments.filter((item, index) => index <= 3);

  localStorage.setItem('recentFiles', JSON.stringify(state.storage.recentDocuments));
};

export const updateRecentDocument = ({ state }: Context) => {
  state.storage.recentDocuments = state.storage.recentDocuments.map((document) => {
    if (document.url === state.storage.resource?.url) {
      document.modifiedAt = new Date();
    }
    return document;
  });

  localStorage.setItem('recentFiles', JSON.stringify(state.storage.recentDocuments));
};

export const loadTemplate = async ({ effects }: Context, url: string) => {
  const documentString = await effects.storage.api.loadTemplate(url);
  return documentString;
};
