import { db } from '@src/db';
import type { Resource, StorageDialogState } from '@src/types';
import { saveAs } from 'file-saver';
import { v4 as uuidv4 } from 'uuid';
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

export const addToRecentDocument = async (_context: Context, document: Resource) => {
  const { content, hash, ...resource } = document;

  if (
    !resource.provider === undefined ||
    resource.owner === undefined ||
    resource.ownertype === undefined ||
    resource.repo === undefined ||
    resource.path === undefined ||
    resource.filename === undefined ||
    resource.url === undefined
  ) {
    return;
  }

  if (!resource.id) {
    const item = await db.recentDocuments.get({ url: resource.url });
    resource.id = item?.id ?? uuidv4();
  }

  resource.modifiedAt = new Date();

  await db.recentDocuments.put(resource, resource.id);
};

export const downloadImage = async ({ state }: Context, screenshot: string) => {
  const fakeLink = window.document.createElement('a');

  (fakeLink as HTMLElement).style.display = 'none';
  fakeLink.download = 'doc';

  fakeLink.href = screenshot;

  document.body.appendChild(fakeLink);
  fakeLink.click();
  document.body.removeChild(fakeLink);

  fakeLink.remove();
};

export const updateRecentDocument = async ({ state }: Context) => {
  const { resource } = state.editor;
  if (!resource || !resource.url) return;

  if (!resource.id) {
    const item = await db.recentDocuments.get({ url: resource.url });
    resource.id = item?.id ?? uuidv4();
  }

  resource.modifiedAt = new Date();

  try {
    await db.recentDocuments.put(resource, resource.id);
  } catch (error) {
    console.log(error)
  }
 
};

export const removeRecentDocument = async (_context: Context, id: string) => {
  await db.recentDocuments.delete(id);
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

export const download = (
  _context: Context,
  { content, filename }: { content: string; filename: string }
) => {
  const blob = new Blob([content]); //, { type: 'text/plain;charset=utf-8' });
  saveAs(blob, filename);
  return true;
};

export const convertXMLtoHTML = async ({ effects }: Context, content: string) => {
  const data = await effects.storage.api.convertXMLtoHTML(content);
  return data;
};

export const checkDocumentFormat = (_context: Context, content: string) => {
  const format = checkIsTranskibus(content);
  return format;
};

const checkIsTranskibus = (content: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'application/xml');
  if (!doc) return;
  const header = doc.querySelector('teiHeader');
  if (!header) return;
  const publisher = header.querySelector('publisher');
  if (publisher?.textContent !== 'tranScriptorium') return;

  return 'traskribus-TEI';
};

export const convertTranskribusToTei = async ({ effects }: Context, resource: Resource) => {
  if (!resource.content) {
    return new Error('No content');
  }

  const convertedResource = await effects.storage.api.convertTranskribusToTei(resource.content);
  if (convertedResource instanceof Error) return convertedResource;

  //New file name
  let newFilename = resource.filename;
  if (newFilename) {
    const extension = newFilename.slice(-4); // get extension
    newFilename = newFilename.slice(0, -4); // remove xml extension
    newFilename = `${newFilename} (copy)${extension}`;
  }

  //remove original hash and url
  resource = {
    ...resource,
    content: convertedResource,
    filename: newFilename,
    hash: undefined,
    url: undefined,
  };

  return resource;
};
