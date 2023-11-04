import { saveAs } from 'file-saver';
import { Context } from '../';
import i18next from '../../i18n';
import type {
  AllowedMimeType,
  DialogType,
  Resource,
  SelectedItem,
  StorageDialogConfig,
  StorageSource,
  Validate,
} from '../../types';
import { updateTranslation } from '../../utilities';

// * The following line is need for VSC extension i18n ally to work
// useTranslation('LWStorageService');

const { t } = i18next;

export const configure = async ({ state, actions }: Context, config: StorageDialogConfig = {}) => {
  const {
    allowLocalFiles,
    allowedMimeTypes,
    allowPaste,
    allowUrl,
    defaultCommitMessage,
    language,
    preferProvider,
    providers: providerAuth,
    showInvisibleFiles,
    validate,
  } = config;

  await updateTranslation(language);

  const { common, cloud } = state;

  common.allowLocalFiles = allowLocalFiles ?? true;
  common.allowPaste = allowPaste ?? true;
  common.allowUrl = allowUrl ?? true;
  common.showInvisibleFiles = showInvisibleFiles ?? false;
  if (allowedMimeTypes) common.allowedMimeTypes = allowedMimeTypes;
  if (defaultCommitMessage) actions.cloud.setDefaultCommitMessage(defaultCommitMessage);
  if (validate) actions.common.setValidate(validate);

  if (providerAuth) {
    await actions.cloud.initiateProviders(providerAuth);

    if (cloud.providers.length > 0 && preferProvider) {
      actions.cloud.setProvider(preferProvider);
      const provider = actions.cloud.getProvider();
      state.cloud.user = (await provider?.getAuthenticatedUser()) ?? undefined;
    }
  }

  actions.common.setSources();
};

export const setDialogType = ({ state }: Context, value: DialogType) => {
  state.common.dialogType = value;
};

export const setAllowLocalFiles = ({ state }: Context, value: boolean) => {
  state.common.allowLocalFiles = value;
};

export const setAllowPaste = ({ state }: Context, value: boolean) => {
  state.common.allowPaste = value;
};

export const setAllowedAllFileTypes = ({ state }: Context, value: boolean) => {
  state.common.allowAllFileTypes = value;
  state.common.selectedItem = undefined;
};

export const setAllowedMimeTypes = ({ state }: Context, value: AllowedMimeType[]) => {
  state.common.allowedMimeTypes = value;
};

export const setAllowUrl = ({ state }: Context, value: boolean) => {
  state.common.allowUrl = value;
};

export const setContentToSave = ({ state }: Context, value: string | undefined) => {
  state.common.contentToSave = value;
};

export const setShowInvisibleFiles = ({ state }: Context, value: boolean) => {
  state.common.showInvisibleFiles = value;
};

export const setSource = ({ state }: Context, source: StorageSource) => {
  state.common.source = source;
};

export const setValidate = ({ state }: Context, validate: Validate) => {
  state.common.validate = validate;
};

export const setSources = ({ state }: Context) => {
  state.common.sources = [];

  const { providers } = state.cloud;
  const { allowLocalFiles, allowPaste, allowUrl, dialogType, sources } = state.common;

  providers.forEach((provider) => {
    sources.push({ value: provider, label: provider, icon: provider });
  });

  if (dialogType === 'load') {
    if (allowUrl) {
      sources.push({
        value: 'url',
        label: t('commons.url', { ns: 'LWStorageService' }),
        icon: 'url',
      });
    }

    if (allowLocalFiles) {
      sources.push({
        value: 'local',
        label: t('commons.from_your_computer', { ns: 'LWStorageService' }),
        icon: 'computer',
      });
    }

    if (allowPaste) {
      sources.push({
        value: 'paste',
        label: t('footer.pasteXml', { ns: 'LWStorageService' }),
        icon: 'paste',
      });
    }
  }
};

export const setFilename = async ({ state }: Context, filename: string) => {
  if (!state.common.resource) {
    state.common.resource = { filename };
    return;
  }
  state.common.resource.filename = filename;
};

//---------------

export const setSelectedItem = ({ state }: Context, value?: SelectedItem) => {
  state.common.selectedItem = value;
};

export const load = async ({ state, actions }: Context, resource?: Resource) => {
  if (!resource) resource = state.common.resource;
  if (!resource) return;

  if (resource.content && state.common.validate) {
    const { valid, error } = state.common.validate(resource.content);

    if (!valid) {
      actions.ui.openDialog({
        props: {
          maxWidth: 'xs',
          preventEscape: true,
          severity: 'error',
          title: error ?? `${t('message.document_not_valid', { ns: 'LWStorageService' })}`,
        },
      });

      if (state.common.resource) {
        state.common.resource.filename = undefined;
        state.common.resource.content = undefined;
        state.common.resource.hash = undefined;
      }

      return;
    }
  }

  state.common.submit = {
    action: 'load',
    resource: { ...resource, storageSource: state.common.source },
  };

  setTimeout(() => {
    if (state.common.resource?.content) {
      actions.common.setResource({ ...state.common.resource, content: undefined, hash: undefined });
    }
  }, 100);
};

export const afterSave = async ({ state, actions }: Context, resource?: Resource) => {
  if (!resource) resource = state.common.resource;
  if (!resource?.content) return;

  state.common.submit = { action: 'save', resource };
  await actions.common.resetAll();
};

export const clearSubmit = ({ state }: Context) => {
  state.common.submit = undefined;
  state.common.resource = undefined;
};

export const setResource = (
  { state }: Context,
  { branch, filename, content, hash, url }: Partial<Resource>,
) => {
  const { cloud, common } = state;

  let updatedResource: Resource = { storageSource: common.source };

  if (common.source === 'url') {
    updatedResource = { ...updatedResource, url };
    state.common.resource = updatedResource;
    return;
  }

  if (common.source === 'paste') {
    updatedResource = { ...updatedResource, content };
    state.common.resource = updatedResource;
    return;
  }

  if (common.source === 'local') {
    updatedResource = { ...updatedResource, content, filename };
    state.common.resource = updatedResource;
    return;
  }

  //* else "cloud"
  updatedResource = {
    ...updatedResource,
    provider: cloud.name,
    ownerType: cloud.owner?.type,
    owner: cloud.name === 'gitlab' ? cloud.owner?.id : cloud.owner?.username,
    repo: cloud.name === 'gitlab' ? cloud.repository?.id : cloud.repository?.name,
    branch: branch ?? 'main',
    path: cloud.repositoryContent.path?.join('/'),
    filename: filename ?? common.resource?.filename,
    hash: hash ?? common.resource?.hash,
    writePermission: cloud.repository?.writePermission,
    url,
    content,
  };

  state.common.resource = updatedResource;

  return updatedResource;
};

export const resetAll = async ({ state }: Context) => {
  state.common.allowPaste = true;
  state.common.messageDialog = { open: false };
  state.common.resource = undefined;
  state.common.selectedItem = undefined;
  state.common.source = 'cloud';
  state.common.dialogType = 'load';

  state.cloud.repositoryContent = {};
  state.cloud.collectionSource = 'owner';
  state.cloud.collectionType = undefined;
  state.cloud.owner = undefined;
  state.cloud.organizations = undefined;
  state.cloud.repository = undefined;
  state.cloud.repositories = undefined;
};

export const download = async ({ state, actions }: Context) => {
  const { resource } = state.common;
  if (!resource) return;

  const content = state.common.contentToSave;

  const { filename } = resource;
  if (!content || !filename) return;

  const blob = new Blob([content]); //, { type: 'text/plain;charset=utf-8' });
  saveAs(blob, filename);

  actions.common.setResource({ filename, content });
  await actions.common.afterSave();
};
