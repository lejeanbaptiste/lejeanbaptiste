import i18next from './i18n';
import type { Repository, Resource } from './types';
import { isErrorMessage } from './types';
import Provider, { type ProviderAuth } from './types/Provider';
import { updateLocale } from './utilities';

export type { Resource } from './types';

// * The following line is need for VSC extension i18n ally to work
// useTranslation();

const { t } = i18next;

let provider: Provider | null;

export const loadDocument = async (providerAuth: ProviderAuth, resource: Resource) => {
  await updateLocale();

  const { provider: providerName, owner, ownerType, repo, filename } = resource;
  let { path } = resource;

  if (!providerName) {
    return new Error(t('SS.cloud.message.storage_provider_undefined'));
  }
  if (!owner) {
    return new Error(t('SS.cloud.message.document_owner_undefined'));
  }
  if (!ownerType) {
    return new Error(t('SS.cloud.message.document_owner_type_undefined'));
  }
  if (!repo) {
    return new Error(t('SS.cloud.message.repository_undefined'));
  }

  if (!path) path = '';

  if (!filename) {
    return new Error(t('SS.cloud.message.document_filename_undefined'));
  }

  provider = await initializeProvider(providerAuth);
  if (!provider) {
    return new Error(t('SS.cloud.message.storage_provider_not_supported'));
  }

  const repository = await provider
    .getRepo({ username: owner, repoId: repo, repoName: repo })
    .catch(() => null);

  if (!repository) {
    return new Error(t('SS.cloud.message.repository_not_found'));
  }

  const filePath = path === '' ? filename : `${path}/${filename}`;

  const document = await provider.getDocument({
    ownerUsername: owner,
    repoName: repo,
    repoId: repo,
    path: filePath,
    branch: repository.default_branch,
  });
  if (!document) {
    return new Error(t('SS.cloud.message.document_not_found'));
  }

  const documentResource: Resource = {
    provider: providerName,
    owner,
    ownerType,
    repo,
    path,
    filename,
    ...document,
  };

  return documentResource;
};

export const saveDocument = async (
  providerAuth: ProviderAuth,
  resource: Resource,
  overwrite = false,
) => {
  await updateLocale();

  const { provider: providerName, owner, ownerType, repo, filename, content, hash } = resource;
  let { path } = resource;

  if (!providerName) {
    return new Error(t('SS.cloud.message.storage_provider_undefined'));
  }
  if (!owner) {
    return new Error(t('SS.cloud.message.document_owner_undefined'));
  }
  if (!ownerType) {
    return new Error(t('SS.cloud.message.document_owner_type_undefined'));
  }
  if (!repo) return new Error(t('SS.cloud.message.repository_undefined'));

  if (!path) path = '';

  if (!filename) {
    return new Error(t('SS.cloud.message.document_filename_undefined'));
  }
  if (!content) {
    return new Error(t('SS.cloud.message.document_has_no_content'));
  }

  provider = await initializeProvider(providerAuth);
  if (!provider) {
    return new Error(t('SS.cloud.message.storage_provider_not_supported'));
  }

  const repository = await provider
    .getRepo({ username: owner, repoId: repo, repoName: repo })
    .catch(() => null);
  if (!repository) {
    return new Error(t('SS.cloud.message.repository_not_found'));
  }

  const filePath = path === '' ? filename : `${path}/${filename}`;

  //permission
  const hasPermission = await provider.checkRepoUserWritenPermission({
    repoId: repository.id,
    repoName: repository.name,
    ownerUsername: owner,
    username: provider.username,
    userId: provider.userId,
  });

  if (!hasPermission) {
    return new Error(t('SS.cloud.message.user_has_no_write_permission'));
  }

  //check file exist
  const fileLatestHash = await getFileLatestHash({ filePath, repository, owner });
  if (fileLatestHash === hash && !overwrite) {
    const errorMessage = `${t('SS.cloud.message.file_already_exists')}. ${t('SS.cloud.message.unable_to_overwrite_file')}.`;
    return new Error(errorMessage);
  }

  //save
  const response = await provider.saveDocument({
    branch: repository.default_branch,
    content,
    message: 'Updated',
    ownerUsername: owner,
    path: filePath,
    repoId: repository.id,
    repoName: repository.name,
    hash: fileLatestHash ?? undefined,
  });

  if (!response) {
    const errorMessage = `${t('SS.cloud.message.something_went_wrong')}. ${t('SS.cloud.message.unabled_to_save')}.`;
    return { message: errorMessage, type: 'error' };
  }

  if (isErrorMessage(response)) {
    return { message: response.message, type: response.type };
  }

  const documentResource: Resource = {
    provider: providerName,
    owner,
    ownerType,
    repo,
    path,
    filename,
    content: response.content as string,
    hash: response.hash as string,
  };

  return documentResource;
};

interface GetFileLatestHashParams {
  filePath: string;
  repository: Repository;
  owner: string;
}

const getFileLatestHash = async ({ filePath, repository, owner }: GetFileLatestHashParams) => {
  if (!provider) return null;

  const document = await provider.getDocument({
    ownerUsername: owner,
    repoName: repository.name,
    repoId: repository.id,
    path: filePath,
    branch: repository.default_branch,
  });
  if (!document) return null;

  return document.hash;
};

const initializeProvider = async (providerAuth: ProviderAuth) => {
  let module;

  if (providerAuth.name === 'github') module = await import('./providers/Github');
  if (providerAuth.name === 'gitlab') module = await import('./providers/Gitlab');

  if (!module) return null;

  const Provider = module.default;
  const provider: Provider = new Provider(providerAuth);

  const user = await provider.getAuthenticatedUser();
  if (!user) return null;

  return provider;
};
