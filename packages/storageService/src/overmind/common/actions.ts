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
    allowedMimeTypes,
    allowPaste,
    defaultCommitMessage,
    language,
    preferProvider,
    providers: providerAuth,
    showInvisibleFiles,
    validate,
  } = config;

  updateTranslation(language);

  const { common, cloud } = state;

  common.allowPaste = allowPaste ?? true;
  common.showInvisibleFiles = showInvisibleFiles ?? false;
  if (allowedMimeTypes) common.allowedMimeTypes = allowedMimeTypes;
  if (defaultCommitMessage) actions.cloud.setDefaultCommitMessage(defaultCommitMessage);
  if (validate) actions.common.setValidate(validate);

  if (providerAuth) {
    await actions.cloud.initiateProviders(providerAuth);

    if (cloud.providers.length > 0 && preferProvider) {
      actions.cloud.setProvider(preferProvider);
      const provider = actions.cloud.getProvider();
      state.cloud.user = await provider?.getAuthenticatedUser() ?? undefined;
    }
  }

  actions.common.setSources();
};

export const setDialogType = ({ state }: Context, value: DialogType) => {
  state.common.dialogType = value;
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
  const { allowPaste, dialogType, sources } = state.common;

  providers.forEach((provider) => {
    sources.push({ value: provider, label: provider, icon: provider });
  });

  if (dialogType === 'load') {
    sources.push({
      value: 'local',
      label: t('commons.from_your_computer', { ns: 'LWStorageService' }),
      icon: 'computer',
    });

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
  if (!resource || !resource.content) return;

  if (state.common.validate) {
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
      if (state.common.resource) state.common.resource.filename = undefined;
      if (state.common.resource) state.common.resource.content = undefined;
      if (state.common.resource) state.common.resource.hash = undefined;
      return;
    }
  }

  state.common.submit = { action: 'load', resource };
  setTimeout(() => actions.common.resetAll(), 0);
};

export const afterSave = async ({ state, actions }: Context, resource?: Resource) => {
  if (!resource) resource = state.common.resource;
  if (!resource || !resource.content) return;

  state.common.submit = { action: 'save', resource };
  actions.common.resetAll();
};

export const clearSubmit = ({ state }: Context) => {
  state.common.submit = undefined;
};

export const setResource = (
  { state }: Context,
  { filename, content, hash, url }: Partial<Resource>
) => {
  const { cloud, common } = state;

  const provider = common.source === 'cloud' ? cloud.name : undefined;
  const ownertype = common.source === 'cloud' ? cloud.owner?.type : undefined;

  const owner = cloud.name === 'gitlab' ? cloud.owner?.id : cloud.owner?.username;
  const repo = cloud.name === 'gitlab' ? cloud.repository?.id : cloud.repository?.name;

  const path = common.source === 'cloud' ? cloud.repositoryContent.path?.join('/') : undefined;

  if (!filename) filename = common.resource?.filename;
  if (!hash) hash = common.resource?.hash;

  const writePermission = provider ? cloud.repository?.writePermission : undefined;

  const updateResource: Resource = {
    provider,
    ownertype,
    owner,
    repo,
    path,
    filename,
    content,
    hash,
    url,
    writePermission,
  };

  state.common.resource = updateResource;
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

export const download = ({ state, actions }: Context) => {
  const { resource } = state.common;
  if (!resource) return;

  const { content, filename } = resource;
  if (!content || !filename) return;

  const blob = new Blob([content]); //, { type: 'text/plain;charset=utf-8' });
  saveAs(blob, filename);

  actions.common.setResource({ filename, content });
  actions.common.afterSave();
};
