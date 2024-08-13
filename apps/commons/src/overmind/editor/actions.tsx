import LeafWriter from '@cwrc/leafwriter';
import { saveDocument } from '@cwrc/leafwriter-storage-service/headless';
import { AUTOSAVE_TIMEOUT_RETRY } from '@src/config';
import type { Error, Resource } from '@src/types';
import { isErrorMessage } from '@src/types';
import { log } from '@src/utilities';
import i18next from 'i18next';
import { Context } from '../';

// * The following line is need for VSC extension i18n ally to work
// useTranslation()
const { t } = i18next;

export const getGeonameUsername = async ({ effects }: Context) => {
  const response = await effects.editor.api.getGeonameUsername();
  if (typeof response === 'string') return response;
  return;
};

export const loadLeafWriter = async ({ state }: Context, container: HTMLElement) => {
  const LW = (await import('@cwrc/leafwriter')).Leafwriter;
  const leafWriter = new LW(container);
  state.editor.libLoaded = true;
  return leafWriter;
};

export const setResource = async ({ state }: Context, resource?: Resource) => {
  state.editor.contentHasChanged = false;
  state.editor.resource = resource ? { ...resource } : undefined;
};

export const clearResource = async ({ state }: Context) => {
  state.editor.resource = undefined;
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
    screenshot,
  }: {
    content: string;
    screenshot?: string;
  },
): Promise<{ success: true } | { success: false; error: Error }> => {
  state.editor.isSaving = true;

  // Check diff document
  if (actions.editor.isContentSameAsLastSaved(content)) {
    actions.editor.afterSave();
    return { success: true };
  }

  const { resource } = state.editor;

  //Check provider
  if (!resource?.provider) {
    const message = t('LWC.storage.provider_not_found');
    log.error(message);
    state.editor.isSaving = false;
    return { success: false, error: { type: 'error', message } };
  }

  const providerAuth = actions.providers.getStorageProviderAuth(resource.provider);

  //Check provider token
  if (!providerAuth) {
    const message = t('LWC.storage.provider_not_found');
    log.error(message);
    state.editor.isSaving = false;
    return { success: false, error: { type: 'error', message } };
  }

  //Prepare resource
  const updatedResource = {
    ...resource,
    content,
    screenshot,
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
      timerService.stop().setDuration(AUTOSAVE_TIMEOUT_RETRY).setMaxAttempt(5).start();
    }

    return { success: false, error: response };
  }

  // Finalize
  actions.editor.setResource(updatedResource);
  actions.editor.afterSave();
  state.editor.contentLastSaved = content;

  return { success: true };
};

export const afterSave = async ({ state, actions }: Context) => {
  actions.storage.updateRecentDocument();
  actions.editor.setContentHasChanged(false);

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
    screenshot,
  }: {
    content: string;
    screenshot?: string;
  },
): Promise<{ success: boolean; error?: Error }> => {
  const { resource } = state.editor;

  actions.editor.setResource({
    ...resource,
    content,
    screenshot,
  });

  actions.storage.openStorageDialog({
    source: 'cloud',
    resource: { ...resource, content },
    type: 'save',
  });

  return { success: true };
};

export const setContentHasChanged = ({ state }: Context, value: boolean) => {
  state.editor.contentHasChanged = value;
};

export const subscribeToTimerService = ({ state, actions }: Context, editor: LeafWriter) => {
  state.editor.timerService.onTimer.subscribe(async () => {
    const content = await editor.getContent();
    if (typeof content !== 'string') return;
    const screenshot = await editor.getDocumentScreenshot();
    await actions.editor.save({ content, screenshot });
  });
};

export const unsubscribeFromTimerService = ({ state }: Context) => {
  state.editor.timerService.onTimer.unsubscribe();
};

export const close = async ({ state, actions }: Context) => {
  actions.editor.setResource();
  state.editor.libLoaded = false;
  state.editor.contentHasChanged = false;
  state.editor.contentLastSaved = undefined;
};

export const setReadonly = ({ state }: Context, value: boolean) => {
  state.editor.readonly = value;
};
