import i18next from './i18n';
import type { Repository, Resource } from './types';
import { isErrorMessage } from './types';
import Provider, { type ProviderAuth } from './types/Provider';
import { updateTranslation } from './utilities';

export type { Resource } from './types';

// * The following line is need for VSC extension i18n ally to work
// useTranslation('LWStorageService');

const { t } = i18next;

let provider: Provider | null;

export const loadDocument = async (providerAuth: ProviderAuth, resource: Resource) => {
  updateTranslation();

  const { provider: providerName, owner, ownertype, repo, filename } = resource;
  let { path } = resource;

  if (!providerName) {
    return new Error(
      t('cloud.message.storage_provider_undefined', { ns: 'LWStorageService' }).toString()
    );
  }
  if (!owner) {
    return new Error(
      t('cloud.message.document_owner_undefined', { ns: 'LWStorageService' }).toString()
    );
  }
  if (!ownertype) {
    return new Error(
      t('cloud.message.document_owner_type_undefined', { ns: 'LWStorageService' }).toString()
    );
  }
  if (!repo) {
    return new Error(
      t('cloud.message.repository_undefined', { ns: 'LWStorageService' }).toString()
    );
  }

  if (!path) path = '';

  if (!filename) {
    return new Error(
      t('cloud.message.document_filename_undefined', { ns: 'LWStorageService' }).toString()
    );
  }

  provider = await initializeProvider(providerAuth);
  if (!provider) {
    return new Error(
      t('cloud.message.storage_provider_not_supported', { ns: 'LWStorageService' }).toString()
    );
  }

  const repository = await provider
    .getRepo({ username: owner, repoId: repo, repoName: repo })
    .catch(() => null);

  if (!repository) {
    return new Error(
      t('cloud.message.repository_not_found', { ns: 'LWStorageService' }).toString()
    );
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
    return new Error(t('cloud.message.document_not_found', { ns: 'LWStorageService' }).toString());
  }

  const documentResource: Resource = {
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
) => {
  updateTranslation();

  const { provider: providerName, owner, ownertype, repo, filename, content, hash } = resource;
  let { path } = resource;

  if (!providerName) {
    return new Error(
      t('cloud.message.storage_provider_undefined', { ns: 'LWStorageService' }).toString()
    );
  }
  if (!owner) {
    return new Error(
      t('cloud.message.document_owner_undefined', { ns: 'LWStorageService' }).toString()
    );
  }
  if (!ownertype) {
    return new Error(
      t('cloud.message.document_owner_type_undefined', { ns: 'LWStorageService' }).toString()
    );
  }
  if (!repo)
    return new Error(
      t('cloud.message.repository_undefined', { ns: 'LWStorageService' }).toString()
    );

  if (!path) path = '';

  if (!filename) {
    return new Error(
      t('cloud.message.document_filename_undefined', { ns: 'LWStorageService' }).toString()
    );
  }
  if (!content) {
    return new Error(
      t('cloud.message.document_has_no_content', { ns: 'LWStorageService' }).toString()
    );
  }

  provider = await initializeProvider(providerAuth);
  if (!provider) {
    return new Error(
      t('cloud.message.storage_provider_not_supported', { ns: 'LWStorageService' }).toString()
    );
  }

  const repository = await provider
    .getRepo({ username: owner, repoId: repo, repoName: repo })
    .catch(() => null);
  if (!repository) {
    return new Error(
      t('cloud.message.repository_not_found', { ns: 'LWStorageService' }).toString()
    );
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
    return new Error(
      t('cloud.message.user_has_no_write_permission', { ns: 'LWStorageService' }).toString()
    );
  }

  //check file exist
  const fileLatestHash = await getFileLatestHash({ filePath, repository, owner });
  if (fileLatestHash === hash && !overwrite) {
    const errorMessage = `${t('cloud.message.file_already_exists', {
      ns: 'LWStorageService',
    })}. ${t('cloud.message.unable_to_overwrite_file', { ns: 'LWStorageService' })}.`;
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
    const errorMessage = `${t('cloud.message.something_went_wrong', {
      ns: 'LWStorageService',
    })}. ${t('cloud.message.unabled_to_save', { ns: 'LWStorageService' })}.`;
    return new Error(errorMessage);
  }

  if (isErrorMessage(response)) return new Error(response.message);

  const documentResource: Resource = {
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
  let module: any;

  if (providerAuth.name === 'github') module = await import('./providers/Github');
  if (providerAuth.name === 'gitlab') module = await import('./providers/Gitlab');

  if (!module) return null;

  const Provider = module.default;
  const provider: Provider = new Provider(providerAuth);

  const user = await provider.getAuthenticatedUser();
  if (!user) return null;

  return provider;
};
