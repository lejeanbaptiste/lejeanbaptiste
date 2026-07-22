import { saveDocument } from '@cwrc/leafwriter-storage-service/headless';
import { SAVE_CONFLICT_RETRY_DELAY } from '@src/config';
import type { Error, Resource } from '@src/types';
import { isErrorMessage } from '@src/types';
import { log } from '@src/utilities';
import i18next from 'i18next';
import { Context } from '../';

// * The following line is need for VSC extension i18n ally to work
// useTranslation()
const { t } = i18next;

export const loadLeafWriter = async ({ state }: Context, container: HTMLElement) => {
  container.replaceChildren();
  const LW = (await import('@cwrc/leafwriter')).Leafwriter;
  const leafWriter = new LW(container);
  state.editor.libLoaded = true;
  return leafWriter;
};

export const resetLibLoaded = ({ state }: Context) => {
  state.editor.libLoaded = false;
};

export const setResource = async ({ state }: Context, resource?: Resource) => {
  state.editor.contentHasChanged = false;
  state.editor.resource = resource ? { ...resource } : undefined;
};

export const clearResource = async ({ state }: Context) => {
  state.editor.resource = undefined;
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
): Promise<{ success: true; saved: boolean } | { success: false; error: Error }> => {
  state.editor.isSaving = true;

  // Check diff document
  if (actions.editor.isContentSameAsLastSaved(content)) {
    actions.editor.afterSave();
    return { success: true, saved: false };
  }

  const { resource } = state.editor;

  //Check provider
  if (!resource?.provider) {
    const message = t('LWC.storage.provider not found');
    log.error(message);
    state.editor.isSaving = false;
    return { success: false, error: { type: 'error', message } };
  }

  const providerAuth = actions.providers.getStorageProviderAuth(resource.provider);

  //Check provider token
  if (!providerAuth) {
    const message = t('LWC.storage.provider not found');
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

    if (!state.editor.saveDelayed) {
      state.editor.saveDelayed = true;
      scheduleConflictRetry({ state, actions }, { content, screenshot }, 1);
    }

    return { success: false, error: response };
  }

  // Finalize
  actions.editor.setResource(updatedResource);
  actions.editor.afterSave();
  state.editor.contentLastSaved = content;

  return { success: true, saved: true };
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

const CONFLICT_RETRY_MAX_ATTEMPTS = 5;

const scheduleConflictRetry = (
  { state, actions }: Pick<Context, 'state' | 'actions'>,
  params: { content: string; screenshot?: string },
  attempt: number,
): void => {
  setTimeout(async () => {
    const result = await actions.editor.save(params);
    const isConflict = !result.success && result.error?.message === 'conflict';

    if (isConflict && attempt < CONFLICT_RETRY_MAX_ATTEMPTS) {
      scheduleConflictRetry({ state, actions }, params, attempt + 1);
      return;
    }

    state.editor.saveDelayed = false;
  }, SAVE_CONFLICT_RETRY_DELAY);
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
