import type { IError, Repository, Resource } from './types';
import Provider, { ProviderAuth } from './types/Provider';
import { isErrorMessage } from './utilities';

let provider: Provider | null;

interface IGetFileLatestHashParams {
  filePath: string;
  repository: Repository;
  owner: string;
}

export type { Resource, IError } from './types';

export const loadDocument = async (providerAuth: ProviderAuth, resource: Resource) => {
  const { provider: providerName, owner, ownertype, repo, filename } = resource;
  let { path } = resource;

  if (!providerName) return { error: 'Document provider undefined' };
  if (!owner) return { error: "Document's owner undefined" };
  if (!ownertype) return { error: "Document's ownertype undefined" };
  if (!repo) return { error: "Document's repository undefined" };
  if (!path) path = '';
  if (!filename) return { error: "Document's filename undefined" };

  provider = await initializeProvider(providerAuth);
  if (!provider) return { error: 'Provider not supported' };

  const repository = await provider
    .getRepo({ username: owner, repoId: repo, repoName: repo })
    .catch(() => null);

  if (!repository) return { error: "Document's repositoty not found" };

  const filePath = path === '' ? filename : `${path}/${filename}`;

  const document = await provider.getDocument({
    ownerUsername: owner,
    repoName: repo,
    repoId: repo,
    path: filePath,
    branch: repository.default_branch,
  });
  if (!document) return { error: 'Document not found' };

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
): Promise<Resource | IError> => {
  const { provider: providerName, owner, ownertype, repo, filename, content, hash } = resource;
  let { path } = resource;

  if (!providerName) return { type: 'error', message: 'Document provider not defined' };
  if (!owner) return { type: 'error', message: "Document's owner not defined" };
  if (!ownertype) return { type: 'error', message: "Document's ownertype not defined" };
  if (!repo) return { type: 'error', message: "Document's repository not defined" };

  if (!path) path = '';

  if (!filename) return { type: 'error', message: "Document's filename not defined" };
  if (!content) return { type: 'error', message: 'Document has not content' };

  provider = await initializeProvider(providerAuth);
  if (!provider) return { type: 'error', message: 'Provider not supported' };

  const repository = await provider
    .getRepo({ username: owner, repoId: repo, repoName: repo })
    .catch(() => null);
  if (!repository) return { type: 'error', message: "Document's repositoty not found" };

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
      message: 'User has no permission to save a document in this repository',
    };
  }

  //check file exist
  const fileLatestHash = await getFileLatestHash({ filePath, repository, owner });
  if (fileLatestHash === hash && !overwrite) {
    return { type: 'error', message: 'File already exists. Unable to overwrite.' };
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

  console.log(response);

  if (!response) return { type: 'error', message: 'Something went wrong. Unabled to save.' };
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

const getFileLatestHash = async ({ filePath, repository, owner }: IGetFileLatestHashParams) => {
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
