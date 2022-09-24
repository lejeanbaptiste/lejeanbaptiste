import { saveDocument } from '@cwrc/leafwriter-storage-service';
import { log } from '@src/utilities';
import { Context } from '../';
import { StorageProviderName } from '@src/services';

export const getGeonameUsername = async ({ effects }: Context) => {
  const response = await effects.editor.api.getGeonameUsername();
  return response;
};

export const loadLeafWriter = async ({ state }: Context, container: HTMLElement) => {
  const LeafWriter = (await import('@cwrc/leafwriter')).Leafwriter;
  const leafWriter = new LeafWriter(container);
  state.editor.libLoaded = true;
  return leafWriter;
};

export const save = async ({ state, actions }: Context, content: string) => {
  state.editor.isSaving = true;

  const { storage } = state;

  if (!storage.resource?.provider) {
    log.error('Storage Provider not found!');
    state.editor.isSaving = false;
    return;
  }

  const providerAuth = actions.storage.getStorageProviderAuth(
    storage.resource.provider as StorageProviderName
  );

  if (!providerAuth) {
    log.error('Provider token not found');
    state.editor.isSaving = false;
    return;
  }

  //update resourse
  const updatedResourse = {
    ...storage.resource,
    content,
  };

  actions.storage.setResource(updatedResourse);

  //Save

  // * Important
  // Save debounce multiple calls to avoid sync conflict when saving into cloud storage like Github.
  // It will execute immedaiatly. Subsequently calls will be blocked until the timeout, when the last call is executed.
  // After timeout, the subsquently call executes immedaitly again.
  // export const saveDocument = debounce(
  //   ({ state }: Context, saveAs?: boolean) => {
  //     if (!window.writer) return;
  //   },
  //   60_000,
  //   { leading: true, trailing: true }
  // );

  const response = await saveDocument(providerAuth, updatedResourse, true);

  if ('error' in response) {
    log.error(response.error);
    state.editor.isSaving = false;
    return;
  }

  actions.storage.updateRecentDocument();
  actions.editor.setIsDirty(false);

  state.editor.isSaving = false;

  return true;
};

export const saveAs = async ({ state, actions }: Context, content: string) => {
  const { storage } = state;

  actions.storage.setResource({
    ...storage.resource,
    content,
  });

  actions.storage.openStorageDialog({
    source: 'cloud',
    resource: storage.resource,
    type: 'save',
  });

  actions.storage.updateRecentDocument();
  actions.editor.setIsDirty(false);

  return true;;
};

export const setIsDirty = async ({ state }: Context, value: boolean) => {
  state.editor.isDirty = value;
};

export const close = async ({ state, actions }: Context) => {
  actions.storage.setResource();
  state.editor.libLoaded = false;
  state.editor.isDirty = false;
};