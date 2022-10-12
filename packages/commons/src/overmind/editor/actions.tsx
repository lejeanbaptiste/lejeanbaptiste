import LeafWriter from '@cwrc/leafwriter';
import { saveDocument } from '@cwrc/leafwriter-storage-service';
import { StorageProviderName } from '@src/services';
import type { IError } from '@src/types';
import { isErrorMessage, log } from '@src/utilities';
import i18next from 'i18next';
import { Context } from '../';

export const getGeonameUsername = async ({ effects }: Context) => {
  const response = await effects.editor.api.getGeonameUsername();
  return response;
};

export const loadLeafWriter = async ({ state }: Context, container: HTMLElement) => {
  const LW = (await import('@cwrc/leafwriter')).Leafwriter;
  const leafWriter = new LW(container);
  state.editor.libLoaded = true;
  return leafWriter;
};

export const setAutosave = ({ state }: Context, value: boolean) => {
  state.editor.autosave = !!value;
};

export const isContentSameAsLastSaved = ({ state }: Context, content: string) => {
  return state.editor.contentLastSaved === content;
};

export const save = async (
  { state, actions }: Context,
  {
    content,
    snapshot,
  }: {
    content: string;
    snapshot?: string;
  }
): Promise<{ success: boolean; error?: IError }> => {
  state.editor.isSaving = true;

  // Check diff document
  if (actions.editor.isContentSameAsLastSaved(content)) {
    actions.editor.afterSave();
    return { success: true };
  }

  const { storage } = state;

  //Check provider
  if (!storage.resource?.provider) {
    const message = i18next.t('storage:provider_not_found');
    log.error(message);
    state.editor.isSaving = false;
    return { success: false, error: { type: 'error', message } };
  }

  const providerAuth = actions.storage.getStorageProviderAuth(
    storage.resource.provider as StorageProviderName
  );

  //Check provider token
  if (!providerAuth) {
    const message = i18next.t('storage:provider_not_found');
    log.error(message);
    state.editor.isSaving = false;
    return { success: false, error: { type: 'error', message } };
  }

  //Prepare resource
  const updatedResource = {
    ...storage.resource,
    content,
    snapshot,
  };

  //* Resquest save
  const response = await saveDocument(providerAuth, updatedResource, true);

  if (isErrorMessage(response)) {
    log.error(response.message);

    if (response.message !== 'conflict') {
      state.editor.isSaving = false;
      return { success: false, error: response };
    }

    const { timerService } = state.editor;
    if (timerService.maxAttempts === Infinity) {
      state.editor.saveDelayed = true;
      // actions.editor.delaySave({ content });
      timerService.stop().setDuration(10_000).setMaxAttempt(5).start();
    }

    return { success: false, error: response };
  }

  // Finalize
  actions.storage.setResource(updatedResource);

  actions.editor.afterSave();

  state.editor.contentLastSaved = content;

  return { success: true };
};

export const afterSave = async ({ state, actions }: Context) => {
  actions.storage.updateRecentDocument();
  actions.editor.setIsDirty(false);

  state.editor.saveDelayed = false;
  state.editor.isSaving = false;

  return { success: true };
};

export const setContentLastSaved = ({ state }: Context, content: string) => {
  state.editor.contentLastSaved = content;
};

export const saveAs = async (
  { state, actions }: Context,
  {
    content,
    snapshot,
  }: {
    content: string;
    snapshot?: string;
  }
): Promise<{ success: boolean; error?: IError }> => {
  const { storage } = state;

  actions.storage.setResource({
    ...storage.resource,
    content,
    snapshot,
  });

  actions.storage.openStorageDialog({
    source: 'cloud',
    resource: storage.resource,
    type: 'save',
  });

  // actions.storage.updateRecentDocument();
  // actions.editor.setIsDirty(false);

  return { success: true };
};

export const setIsDirty = async ({ state }: Context, value: boolean) => {
  if (state.editor.isDirty !== value) state.editor.isDirty = value;

  if (value === false) {
    state.editor.timerService.stop();
    return;
  }

  if (state.editor.autosave && state.storage.resource?.provider) state.editor.timerService.start();
};

export const subscribeToTimerService = ({ state, actions }: Context, editor: LeafWriter) => {
  state.editor.timerService.onTimer.subscribe(async (value) => {
    const content = await editor.getContent();
    const snapshot = await editor.getDocumentSnapshot();
    await actions.editor.save({ content, snapshot });
  });
};

export const unsubscribeFromTimerService = ({ state }: Context) => {
  state.editor.timerService.onTimer.unsubscribe();
};

export const close = async ({ state, actions }: Context) => {
  actions.storage.setResource();
  state.editor.libLoaded = false;
  state.editor.isDirty = false;
};
