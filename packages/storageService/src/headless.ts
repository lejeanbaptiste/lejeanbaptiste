import i18next from './i18n';
import type { Error, Repository, Resource } from './types';
import { isErrorMessage } from './types';
import Provider, { ProviderAuth } from './types/Provider';
import { updateTranslation } from './utilities';

let provider: Provider | null;

interface GetFileLatestHashParams {
  filePath: string;
  repository: Repository;
  owner: string;
}

export type { Error, Resource } from './types';

export const loadDocument = async (providerAuth: ProviderAuth, resource: Resource) => {
  updateTranslation();

  const { provider: providerName, owner, ownertype, repo, filename } = resource;
  let { path } = resource;

  if (!providerName) {
    return { type: 'error', message: i18next.t('LWStorageService:cloud.message.storage_provider_undefined') };
  }
  if (!owner) {
    return { type: 'error', message: i18next.t('LWStorageService:cloud.message.document_owner_undefined') };
  }
  if (!ownertype) {
    return { type: 'error', message: i18next.t('LWStorageService:cloud.message.document_owner_type_undefined') };
  }
  if (!repo) return { type: 'error', message: i18next.t('LWStorageService:cloud.message.repository_undefined') };
  if (!path) path = '';
  if (!filename) {
    return { type: 'error', message: i18next.t('LWStorageService:cloud.message.document_filename_undefined') };
  }

  provider = await initializeProvider(providerAuth);
  if (!provider) {
    return { type: 'error', message: i18next.t('LWStorageService:cloud.message.storage_provider_not_supported') };
  }

  const repository = await provider
    .getRepo({ username: owner, repoId: repo, repoName: repo })
    .catch(() => null);

  if (!repository) {
    return { type: 'error', message: i18next.t('LWStorageService:cloud.message.repository_not_found') };
  }

  const filePath = path === '' ? filename : `${path}/${filename}`;

  const document = await provider.getDocument({
    ownerUsername: owner,
    repoName: repo,
    repoId: repo,
    path: filePath,
    branch: repository.default_branch,
  });
  if (!document) return { type: 'error', message: i18next.t('LWStorageService:cloud.message.document_not_found') };

  const documentResource = {
    provider: providerName,
    owner,
    ownertype,
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
  overwrite = false
): Promise<Resource | Error> => {
  updateTranslation();
  
  const { provider: providerName, owner, ownertype, repo, filename, content, hash } = resource;
  let { path } = resource;

  if (!providerName) {
    return { type: 'error', message: i18next.t('LWStorageService:cloud.message.storage_provider_undefined') };
  }
  if (!owner) {
    return { type: 'error', message: i18next.t('LWStorageService:cloud.message.document_owner_undefined') };
  }
  if (!ownertype) {
    return { type: 'error', message: i18next.t('LWStorageService:cloud.message.document_owner_type_undefined') };
  }
  if (!repo) return { type: 'error', message: i18next.t('LWStorageService:cloud.message.repository_undefined') };

  if (!path) path = '';

  if (!filename) {
    return { type: 'error', message: i18next.t('LWStorageService:cloud.message.document_filename_undefined') };
  }
  if (!content) {
    return { type: 'error', message: i18next.t('LWStorageService:cloud.message.document_has_no_content') };
  }

  provider = await initializeProvider(providerAuth);
  if (!provider)
    return { type: 'error', message: i18next.t('LWStorageService:cloud.message.storage_provider_not_supported') };

  const repository = await provider
    .getRepo({ username: owner, repoId: repo, repoName: repo })
    .catch(() => null);
  if (!repository) {
    return { type: 'error', message: i18next.t('LWStorageService:cloud.message.repository_not_found') };
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
    return {
      type: 'error',
      message: i18next.t('LWStorageService:cloud.message.user_has_no_write_permission'),
    };
  }

  //check file exist
  const fileLatestHash = await getFileLatestHash({ filePath, repository, owner });
  if (fileLatestHash === hash && !overwrite) {
    return {
      type: 'error',
      message: `${i18next.t('LWStorageService:cloud.message.file_already_exists')}. ${i18next.t(
        'LWStorageService:cloud.message.unable_to_overwrite_file'
      )}.`,
    };
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

  if (!response)
    return {
      type: 'error',
      message: `${i18next.t('LWStorageService:cloud.message.something_went_wrong')}. ${i18next.t(
        'LWStorageService:cloud.message.unabled_to_save'
      )}.`,
    };
  if (isErrorMessage(response)) return { type: response.type, message: response.message };

  const documentResource = {
    provider: providerName,
    owner,
    ownertype,
    repo,
    path,
    filename,
    content: response.content,
    hash: response.hash,
  };

  return documentResource;
};

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
  let module: any;

  if (providerAuth.name === 'github') module = await import('./providers/Github');
  if (providerAuth.name === 'gitlab') module = await import('./providers/Gitlab');

  if (!module) return null;

  const Provider = module.default;
  const provider = new Provider(providerAuth);

  const user = await provider.getAuthenticatedUser();
  if (!user) return null;

  return provider;
};
