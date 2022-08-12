import { saveDocument } from '@cwrc/leafwriter-storage-service';
import { Leafwriter } from '@cwrc/leafwriter';
import { log } from '@src/utilities/log';
import { Context } from '../';
import { StorageProviderName } from '@src/services';

export const setLeafWriter = ({ state }: Context, leafWriter?: Leafwriter) => {
  state.editor.leafWriter = leafWriter;
};

export const save = async ({ state, actions }: Context) => {
  const { editor, storage } = state;

  if (!storage.resource?.provider) {
    log.error('Storage Provider not found!');
    return;
  }

  if (!editor.leafWriter) {
    log.error('Leafwriter found!');
    return;
  }

  const content = await editor.leafWriter.getContent();

  if (typeof content !== 'string') {
    log.error(typeof content, 'something wrong');
    return;
  }

  const providerAuth = actions.storage.getStorageProviderAuth(storage.resource.provider as StorageProviderName);
  if (!providerAuth) {
    log.error('Provider token not found');
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
    return;
  }

  editor.leafWriter.setIsEditorDirty(false);

  return { success: true };
};

export const saveAs = async ({ state, actions }: Context) => {
  const { editor, storage } = state;

  const content = await editor.leafWriter?.getContent();

  if (typeof content !== 'string') {
    log.warn(typeof content, 'something wrong');
    return;
  }

  actions.storage.setResource({
    ...storage.resource,
    content,
  });

  actions.storage.openStorageDialog({
    source: 'cloud',
    resource: storage.resource,
    type: 'save',
  });

  return { success: true };
};

export const setIsDirty = async ({ state }: Context, value: boolean) => {
  state.editor.isDirty = value;
};

export const close = async ({ state, actions }: Context) => {
  await state.editor.leafWriter?.dispose();
  actions.editor.setLeafWriter();
  actions.storage.setResource();
};
