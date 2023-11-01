import { Icon, Stack } from '@mui/material';
import match from 'autosuggest-highlight/match';
import parse from 'autosuggest-highlight/parse';
import { Context } from '..';
import { TextEmphasis } from '../../components/TextEmphasis';
import { db } from '../../db';
import i18next from '../../i18n';
import { getIcon, type IconName } from '../../icons';
import type {
  CollectionSource,
  Content,
  Error,
  FetchDocumentParams,
  GetFileLatestHashParams,
  NavigateToPathParams,
  Organization,
  Owner,
  PublicRepository,
  Repository,
  Resource,
  SearchResults,
  SearchResultsBlobs,
  StorageSource,
  SuportedProviders,
  UserType,
} from '../../types';
import { isErrorMessage } from '../../types';
import type {
  CreateFork,
  CreatePrResponse,
  CreateRepoParams,
  ProviderAuth,
} from '../../types/Provider';
import { getFromLocalStorage, log } from '../../utilities';

// * The following line is need for VSC extension i18n ally to work
// useTranslation('LWStorageService');

const { t } = i18next;

//* INIITIALIZE
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const onInitializeOvermind = async ({ state }: Context, _overmind: any) => {
  //PREFERRED STORAGE PROVIDER
  const prefprovider = getFromLocalStorage('prefStorageProvider');
  state.cloud.name = prefprovider as SuportedProviders;
};

export const setIsLoading = ({ state }: Context, value: boolean) => {
  state.cloud.isLoading = value;
};

export const setIsSaving = ({ state }: Context, value: boolean) => {
  state.cloud.isSaving = value;
};

export const setDefaultCommitMessage = ({ state }: Context, value: string) => {
  state.cloud.defaultCommitMessage = value;
  state.cloud.commitMessage = value;
};

export const setCommitMessage = ({ state }: Context, value: string) => {
  state.cloud.commitMessage = value;
};

export const initiateProviders = async ({ state, effects }: Context, providers: ProviderAuth[]) => {
  let suportedProviders: SuportedProviders[] = [];

  for (const providerAuth of providers) {
    const provider = suportedProviders.find((name) => name === providerAuth.name);
    if (provider) continue;

    await effects.cloud.api.initialize(providerAuth);
    suportedProviders = [...suportedProviders, providerAuth.name as SuportedProviders];
  }

  state.cloud.providers = suportedProviders;
};

export const getProvider = ({ state, effects }: Context) => {
  const providerName = state.cloud.name;
  if (!providerName) return null;
  const provider = effects.cloud.api.providers[providerName];
  return provider;
};

export const setProvider = ({ state }: Context, providerName: string) => {
  state.cloud.name = providerName as SuportedProviders;
};

export const changeProvider = async (
  { state, actions }: Context,
  providerName: SuportedProviders,
) => {
  state.cloud.name = providerName;

  const provider = actions.cloud.getProvider();
  if (!provider) return;

  const authUser = await provider.getAuthenticatedUser();
  if (!authUser) return;

  state.cloud.user = authUser;

  actions.cloud.resetRepos();
  actions.cloud.resetOwner();
};

//---------------

export interface InitializeProps {
  resource?: Resource | string;
  source?: string;
}

export const initialize = async ({ state, actions }: Context, initialValues: InitializeProps) => {
  const { resource, source } = initialValues;

  if (typeof resource === 'string') {
    actions.common.setSource('paste');
    actions.common.setResource({ content: resource });
    return;
  }

  if (state.cloud.providers.length > 0 && !source) actions.common.setSource('cloud');
  if (source) actions.common.setSource(source as StorageSource);
  actions.common.setResource({ storageSource: source as StorageSource });

  const resourceLoaded = resource
    ? await actions.cloud.rehydrate({ ...resource, storageSource: source as StorageSource })
    : await actions.cloud.resetOwner();
  return resourceLoaded;
};

export const rehydrate = async ({ state, actions }: Context, resource: Resource) => {
  if (state.common.dialogType === 'save') {
    actions.common.setContentToSave(resource.content);
    actions.common.setResource({
      filename: resource.filename,
      content: resource.content,
      hash: resource.hash,
    });
  }

  if (resource.storageSource === 'url') {
    actions.common.setResource({ url: resource.url, storageSource: 'url' });
    return 'url';
  }

  if (resource.provider) state.cloud.name = resource.provider as SuportedProviders;

  if (!state.cloud.name) {
    log.warn('no provider');
    return null;
  }

  const provider = actions.cloud.getProvider();
  if (!provider) return null;

  if (!resource.owner || !resource.ownerType) {
    actions.cloud.setOwner({ id: provider.userId, username: provider.username, type: 'user' });
    return 'user';
  }

  const ownerType = resource.ownerType as UserType;

  const ownerDetails = await provider.getDetailsForUser({
    user: resource.owner,
    type: ownerType,
  });

  if (!ownerDetails) {
    actions.ui.openDialog({
      props: {
        maxWidth: 'xs',
        preventEscape: true,
        severity: 'error',
        title: `${t('cloud.user_not_found', { ns: 'LWStorageService' })}`,
        Body: () => (
          <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.5}>
            {resource.provider ? (
              <Icon
                component={getIcon(resource.provider as IconName)}
                fontSize="small"
                sx={{ mb: '-3px' }}
              />
            ) : (
              <TextEmphasis disablePadding>{resource.provider ?? ''} :</TextEmphasis>
            )}
            <TextEmphasis color="error" variation="filled">
              {resource.owner ?? ''}
            </TextEmphasis>
          </Stack>
        ),
        onClose: () => {
          if (!provider) return;
          actions.cloud.resetOwner();
        },
      },
    });
    return;
  }

  const { id, name, username } = ownerDetails;

  state.cloud.owner = { id, name, type: ownerType, username };

  if (!resource.repo) {
    ownerType === 'organization'
      ? await actions.cloud.fetchReposForOrgs()
      : await actions.cloud.fetchRepos();
    return 'repos';
  }

  const repo = await actions.cloud.getRepo({
    username: resource.owner,
    repoId: resource.repo,
    repoName: resource.repo,
  });

  if (!repo) {
    actions.ui.openDialog({
      props: {
        maxWidth: 'xs',
        preventEscape: true,
        severity: 'error',
        title: `${t('commons.path_not_found', { ns: 'LWStorageService' })}`,
        Body: () => (
          <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.5}>
            {resource.provider ? (
              <Icon
                component={getIcon(resource.provider as IconName)}
                fontSize="small"
                sx={{ mb: '-3px' }}
              />
            ) : (
              <TextEmphasis disablePadding>{resource.provider ?? ''} :</TextEmphasis>
            )}
            <TextEmphasis>{resource.owner ?? ''}</TextEmphasis>:
            <TextEmphasis color="error" variation="filled">
              {resource.repo ?? ''}
            </TextEmphasis>
          </Stack>
        ),
        onClose: async () => {
          ownerType === 'organization'
            ? await actions.cloud.fetchReposForOrgs()
            : await actions.cloud.fetchRepos();
        },
      },
    });

    return;
  }

  state.cloud.repositoryContent.path = resource.path ? resource.path.split('/') : [''];

  const content = await actions.cloud.fetchRepoContent();

  if (!content) {
    actions.ui.openDialog({
      props: {
        maxWidth: 'xs',
        preventEscape: true,
        severity: 'error',
        title: `${t('commons.path_not_found', { ns: 'LWStorageService' })}`,
        Body: () => (
          <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.5}>
            {resource.provider ? (
              <Icon
                component={getIcon(resource.provider as IconName)}
                fontSize="small"
                sx={{ mb: '-3px' }}
              />
            ) : (
              <TextEmphasis disablePadding>{resource.provider ?? ''} :</TextEmphasis>
            )}
            <TextEmphasis>{resource.owner ?? ''}</TextEmphasis>:
            <TextEmphasis>{resource.repo ?? ''}</TextEmphasis>/
            <TextEmphasis color="error" variation="filled">
              {resource.path ?? ''}
            </TextEmphasis>
          </Stack>
        ),
        onClose: () => {
          if (!provider) return;
          actions.cloud.resetOwner();
        },
      },
    });

    return;
  }

  actions.common.setResource({ ...resource, storageSource: 'cloud' });
  return 'repo';
};

//---------------

export const resetOwner = async ({ actions }: Context) => {
  const provider = actions.cloud.getProvider();
  if (!provider) return;

  actions.cloud.setOwner({ id: provider.userId, username: provider.username, type: 'user' });
};

export const setOwner = ({ state, actions }: Context, owner: Owner) => {
  actions.cloud.resetRepos();
  state.cloud.owner = { ...owner };

  state.cloud.collectionSource = 'owner';

  owner.type === 'organization' ? actions.cloud.fetchReposForOrgs() : actions.cloud.fetchRepos();
};

export const setCollectionSource = (
  { state, actions }: Context,
  collectionSource: CollectionSource,
) => {
  const provider = actions.cloud.getProvider();
  if (!provider) return;

  actions.cloud.resetRepos();

  const username = provider.username;
  if (username && state.cloud.owner?.username !== username) {
    state.cloud.owner = { id: provider.userId, username, type: 'user' };
  }

  state.cloud.collectionSource = collectionSource;

  collectionSource === 'organization'
    ? actions.cloud.fetchOrganizations()
    : actions.cloud.fetchRepos();
};

export const getRepo = async (
  { state, actions }: Context,
  { username, repoId, repoName }: { username: string; repoId: string; repoName: string },
): Promise<Repository | null> => {
  const provider = actions.cloud.getProvider();
  if (!provider) return null;

  const repo = await provider.getRepo({ username, repoId, repoName }).catch(() => null);
  state.cloud.repository = repo ? ({ ...repo } as Repository) : undefined;
  return repo;
};

export const setRepo = ({ state }: Context, repo?: Repository) => {
  state.cloud.repository = repo ? ({ ...repo } as Repository) : undefined;
};

export const setPath = async ({ state, actions }: Context, path: string[]) => {
  state.cloud.repositoryContent.path = path;

  if (state.cloud.repository) {
    await actions.cloud.fetchRepoContent();
  } else if (!state.cloud.repository && state.cloud.repositories) {
    state.cloud.collectionType = 'repos';
  } else {
    actions.cloud.fetchRepos();
  }
};

export const resetRepos = ({ state }: Context) => {
  state.cloud.collectionSource = 'owner';
  state.cloud.collectionType = undefined;
  state.cloud.repositoryContent = {};
  state.cloud.repositories = undefined;
  state.cloud.repository = undefined;
  state.cloud.organizations = undefined;
};

export const loadMoreRepos = async ({ state, actions }: Context): Promise<void> => {
  if (!state.cloud.repositories?.hasMore) return;

  state.cloud.collectionSource === 'organization'
    ? await actions.cloud.fetchReposForOrgs()
    : await actions.cloud.fetchRepos();
};

export const fetchRepos = async ({ state, actions }: Context): Promise<void> => {
  const provider = actions.cloud.getProvider();
  if (!provider || !state.cloud.owner) return;

  let response: { collection: Repository[]; nextPage: string | null } | null;

  if (state.cloud.owner.username === provider.username) {
    response = await provider
      .getReposForAuthenticatedUser({
        collectionSource: state.cloud.collectionSource,
        nextPage: state.cloud.repositories?.nextPage,
      })
      .catch(() => null);
  } else {
    response = await provider.getReposForUser({
      username: state.cloud.owner.username,
      nextPage: state.cloud.repositories?.nextPage,
    });
  }

  if (!response) return;

  state.cloud.repositories = {
    collection: [...(state.cloud.repositories?.collection ?? []), ...response.collection],
    hasMore: !!response.nextPage,
    nextPage: response.nextPage ?? undefined,
  };

  state.cloud.collectionType = 'repos';
};

export const fetchOrganizations = async ({ state, actions }: Context): Promise<void> => {
  const provider = actions.cloud.getProvider();
  if (!provider) return;

  state.cloud.collectionType = undefined;

  const response = await provider.getOrganizationsForAuthenticatedUser({
    nextPage: state.cloud.organizations?.nextPage,
  });

  if (!response) return;

  state.cloud.organizations = {
    collection: response.collection ?? [],
    hasMore: !!response.nextPage,
    nextPage: response.nextPage ?? undefined,
  };

  state.cloud.collectionType = 'organizations';
};

export const getOrganization = async (
  { actions }: Context,
  org: Organization,
): Promise<Organization | null> => {
  const provider = actions.cloud.getProvider();
  if (!provider) return null;
  if (!provider.getOrganization) return null;

  const organization = await provider.getOrganization({
    orgName: org.name,
    orgId: org.id,
  });

  return organization;
};

export const fetchReposForOrgs = async (
  { state, actions }: Context,
  org?: Organization,
): Promise<void> => {
  const provider = actions.cloud.getProvider();
  if (!provider) return;

  if (!org && state.cloud.owner?.type === 'organization') org = state.cloud.owner;
  if (!org) return;

  if (!state.cloud.repositories?.nextPage) state.cloud.collectionType = undefined;

  const response = await provider.getReposForOrganization({
    orgId: org.id,
    nextPage: state.cloud.repositories?.nextPage,
    orgUsername: org.username,
  });

  if (!response) return;

  state.cloud.repositories = {
    collection: [...(state.cloud.repositories?.collection ?? []), ...response.collection],
    hasMore: !!response.nextPage,
    nextPage: response.nextPage ?? undefined,
  };

  state.cloud.collectionType = 'repos';
};

export const checkOrgMemberWritenPermission = async (
  { state, actions }: Context,
  org?: Organization,
): Promise<boolean> => {
  const provider = actions.cloud.getProvider();
  if (!provider) return false;

  if (!org && state.cloud.owner?.type === 'organization') org = state.cloud.owner;
  if (!org) return false;

  const permission = await provider.checkOrgMemberWritenPermission({
    orgId: org.id,
    orgName: org.username,
    username: provider.username,
    userId: provider.userId,
  });

  return permission;
};

export const checkRepoUserWritenPermission = async ({
  state,
  actions,
}: Context): Promise<boolean> => {
  const provider = actions.cloud.getProvider();
  if (!provider) return false;

  const permission = await provider.checkRepoUserWritenPermission({
    repoId: state.cloud.repository?.id,
    repoName: state.cloud.repository?.name,
    ownerUsername: state.cloud.owner?.username,
    username: provider.username,
    userId: provider.userId,
  });

  return permission;
};

export const getLatestCommit = async ({ state, actions }: Context, path: string) => {
  const { owner, repository } = state.cloud;
  const provider = actions.cloud.getProvider();
  if (!provider) return null;
  if (!repository || !owner) return null;

  const latestCommit = await provider.getLatestCommit({
    ownerUsername: owner.username,
    repoId: repository.id,
    repoName: repository.name,
    path,
  });

  return latestCommit;
};

export const fetchRepoContent = async ({ state, actions }: Context): Promise<Content[] | null> => {
  const { owner, repository, repositoryContent } = state.cloud;
  const provider = actions.cloud.getProvider();
  if (!provider) return null;

  if (!repository || !owner) return null;

  state.cloud.isFetching = true;

  if (!repository.default_branch) {
    await actions.cloud.getRepo({
      username: owner.username,
      repoId: repository.id,
      repoName: repository.name,
    });
  }

  let content: Content[] = await provider.getRepoContent({
    branch: repository.default_branch,
    ownerUsername: owner.username,
    path: repositoryContent.path?.join('/'),
    repoId: repository.id,
    repoName: repository.name,
  });

  if (!content) {
    state.cloud.isFetching = false;
    return null;
  }

  //filter 'invisible files
  if (!state.common.showInvisibleFiles) {
    content = content.filter((content) => !content.name.startsWith('.'));
  }

  state.cloud.repositoryContent.tree = content;
  state.cloud.collectionType = 'content';
  state.cloud.isFetching = false;

  return content;
};

export const createRepo = async (
  { state, actions }: Context,
  newRepository: CreateRepoParams,
): Promise<Repository | null> => {
  const provider = actions.cloud.getProvider();
  if (!provider || !state.cloud.owner) return null;

  const hasPermission =
    state.cloud.owner.type === 'organization'
      ? actions.cloud.checkOrgMemberWritenPermission()
      : provider.username === state.cloud.owner?.username;

  if (!hasPermission) return null;

  let repository: Repository | null;

  if (state.cloud.owner.type === 'organization') {
    newRepository = {
      ...newRepository,
      orgName: state.cloud.owner.username,
      orgId: state.cloud.owner.id,
    };
    repository = await provider.createRepoInOrg(newRepository);
  } else {
    repository = await provider.createRepo(newRepository);
  }

  if (!repository) return null;

  state.cloud.repository = repository ? repository : undefined;
  state.cloud.repositories = undefined;
  await actions.cloud.fetchRepoContent();

  return repository;
};

export const forkRepo = async ({ state, actions }: Context): Promise<Repository | Error | null> => {
  const provider = actions.cloud.getProvider();
  const { owner, repository } = state.cloud;
  if (!provider || !owner || !repository) return null;

  const forkParams: CreateFork = {
    ownerUsername: owner.username,
    repoId: repository.id,
    repoName: repository.name,
  };

  if (owner.type === 'organization') forkParams.orgName = owner.username;

  const fork = await provider.createFork(forkParams);

  if (!fork) return null;

  return fork;
};

export const createFolder = async (
  { state, actions }: Context,
  name: string,
): Promise<any | null> => {
  const provider = actions.cloud.getProvider();
  if (
    !provider ||
    !state.cloud.owner ||
    !state.cloud.repository ||
    !state.cloud.repositoryContent.path
  ) {
    return null;
  }

  const hasPermission = await actions.cloud.checkRepoUserWritenPermission();
  if (!hasPermission) return null;

  const currentPath = state.cloud.repositoryContent.path.join('');
  const path = currentPath === '' ? name : `${currentPath}/${name}`;

  const folder = await provider.createFolder({
    branch: state.cloud.repository?.default_branch,
    content: '',
    message: state.cloud.commitMessage,
    ownerUsername: state.cloud.owner.username,
    path,
    repoId: state.cloud.repository.id,
    repoName: state.cloud.repository.name,
  });

  if (!folder) return null;

  const newPath =
    state.cloud.repositoryContent.path[0] === ''
      ? [name]
      : [...state.cloud.repositoryContent.path, name];
  await actions.cloud.setPath(newPath);

  return folder;
};

//? NAVIGATION

export const navigateTo = (
  { state, actions }: Context,
  { org, repo, path }: NavigateToPathParams,
) => {
  state.common.selectedItem = undefined;

  if (org) {
    const { id, name, username } = org;
    if (state.cloud.owner?.username !== name) state.cloud.repositories = undefined;
    state.cloud.owner = { id, name, type: 'organization', username };
    actions.cloud.fetchReposForOrgs();
    return;
  }

  if (!repo && path) {
    actions.cloud.setPath(path.split('/'));
    return;
  }

  if (repo) {
    actions.cloud.setRepo(repo);
    if (repo && state.cloud.owner?.username !== repo?.owner?.username) {
      if (state.cloud.owner) state.cloud.owner.username = repo.owner.username;
    }

    path ? actions.cloud.setPath(path.split('/')) : actions.cloud.setPath(['']);
    return;
  }

  if (!repo && !path) {
    actions.cloud.setRepo(undefined);
    actions.cloud.setPath([]);
  }
};

export const navigateBack = ({ state, actions }: Context, level?: number | string) => {
  const path = state.cloud.repositoryContent.path;

  if (typeof level === 'string') {
    if (level === 'organizations') {
      state.cloud.collectionType = 'organizations';
    } else if (level === 'repositories') {
      actions.cloud.setRepo(undefined);
      actions.cloud.setPath([]);
    }
    return;
  }

  if (path && path?.length > 1) {
    if (!level) level = -1;
    actions.cloud.setPath(path.slice(0, level));
  } else if (path && path[0] !== '') {
    actions.cloud.setPath(['']);
  } else {
    actions.cloud.setRepo(undefined);
    actions.cloud.setPath([]);
  }
};

//? SEARCH

export const searchUsers = async ({ actions }: Context, query: string) => {
  const provider = actions.cloud.getProvider();
  if (!provider) return null;

  const response = await provider.searchUsers(query);
  return response;
};

export const searchGlobal = async (
  { state, actions }: Context,
  query: string,
): Promise<SearchResults[] | null> => {
  const provider = actions.cloud.getProvider();
  if (!provider) return null;

  const searches: Promise<SearchResults>[] = [];
  if (state.cloud.repository) searches.push(Promise.resolve(actions.cloud.searchByFilename(query)));
  searches.push(Promise.resolve(actions.cloud.searchBlobs(query)));

  const results = await Promise.all(searches).then((values) => values);
  return results;
};

export const searchBlobs = async (
  { state, actions }: Context,
  query: string,
): Promise<SearchResults> => {
  const provider = actions.cloud.getProvider();
  if (!provider) return { searchType: 'blobs', results: [] };

  if (!state.cloud.owner) return { searchType: 'blobs', results: [] };

  const { allowAllFileTypes, allowedFileTypes } = state.common;
  const extension = allowAllFileTypes
    ? undefined
    : allowedFileTypes?.length === 1
    ? allowedFileTypes[0]
    : undefined;

  const response: SearchResultsBlobs[] | undefined = await provider.searchBlobs({
    extension,
    owner: state.cloud.owner.username,
    query,
    repoId: state.cloud.repository?.id,
  });

  return {
    searchType: 'blobs',
    results: response ?? [],
  };
};

export const searchByFilename = async (
  { state, actions }: Context,
  query: string,
): Promise<SearchResults> => {
  const provider = actions.cloud.getProvider();
  if (!provider) return { searchType: 'filename', results: [] };

  const searchResults = {
    searchType: 'filename',
    results: [] as Content[],
  };

  if (!state.cloud.repository) return searchResults;
  const { repository, owner } = state.cloud;

  if (owner && !repository.tree) {
    const repoTree = await provider.getRepoContentRecursively({
      branch: repository.default_branch,
      ownerUsername: owner.username,
      repoId: repository.id,
      repoName: repository.name,
    });

    state.cloud.repository.tree = repoTree as Content[];
  }

  if (state.cloud.repository.tree == null) return searchResults;

  const results: Content[] = state.cloud.repository.tree
    .filter((item: Content) => item.name.toLowerCase().match(query.toLocaleLowerCase()))
    .map((item: Content) => {
      const matches = match(item.name, query);
      const parts = parse(item.name, matches);
      return { ...item, nameHighlight: parts };
    });

  searchResults.results = results;

  return searchResults;
};

export const fetchDocumentFromUrl = async ({ state, actions }: Context, url: string) => {
  actions.cloud.setIsLoading(true);

  const response = await fetch(url);
  if (!response.ok) return;

  const data = await response.text();

  const resource: Resource = { ...state.common.resource, content: data };

  actions.common.setResource(resource);
  actions.cloud.setIsLoading(false);

  return resource;
};

export const fetchDocument = async (
  { state, actions }: Context,
  { filename, path, repo }: FetchDocumentParams,
) => {
  const { owner } = state.cloud;
  const provider = actions.cloud.getProvider();
  if (!provider || !owner) return;

  const repository = repo ? repo : state.cloud.repository;
  if (!repository) return;

  actions.cloud.setIsLoading(true);

  if (filename) path = `${path}/${filename}`;
  if (path.startsWith('/')) path = path.slice(1);

  const document = await provider.getDocument({
    ownerUsername: owner.username,
    repoName: repository.name,
    repoId: repository.id,
    path,
    branch: repository.default_branch,
  });

  if (!document) {
    actions.cloud.setIsLoading(false);
    return;
  }

  if (state.cloud.repository?.id !== repository.id) state.cloud.repository = { ...repository };

  const [reducedPath, extractedFilename] = splitPathFilename(path);

  state.cloud.repositoryContent.path = reducedPath.split('/');

  const resource: Resource = {
    ...state.common.resource,
    owner: state.cloud.owner?.username,
    ownerType: state.cloud.owner?.type,
    repo: state.cloud.name === 'gitlab' ? repository?.id : repository?.name,
    path: reducedPath,
    filename: extractedFilename,
    content: document.content,
    hash: document.hash,
    url: document.url,
  };

  actions.common.setResource(resource);
  actions.cloud.setIsLoading(false);

  return resource;
};

const splitPathFilename = (path: string): [string, string] => {
  const _path = path.split('/');
  const filename = _path.pop() ?? '';
  path = _path.join('/');
  return [path, filename];
};

export const getFileLatestHash = async (
  { actions }: Context,
  { filename, path, repository, owner }: GetFileLatestHashParams,
) => {
  const provider = actions.cloud.getProvider();
  if (!provider) return null;

  const currentPath = path.join('');
  const pathWithFilename = currentPath === '' ? filename : `${currentPath}/${filename}`;

  const document = await provider.getDocument({
    ownerUsername: owner.username,
    repoName: repository.name,
    repoId: repository.id,
    path: pathWithFilename,
    branch: repository.default_branch,
  });
  if (!document) return null;

  return document.hash;
};

export const saveDocument = async ({ state, actions }: Context) => {
  const { common, cloud } = state;
  const { repository, repositoryContent, owner } = cloud;
  const { resource } = common;

  const provider = actions.cloud.getProvider();
  if (!provider || !resource?.filename || !repository || !repositoryContent.path || !owner) {
    return null;
  }

  actions.cloud.setIsSaving(true);

  //check file exist
  const fileLatestHash = await actions.cloud.getFileLatestHash({
    filename: resource.filename,
    path: repositoryContent.path,
    repository,
    owner,
  });

  //file does not exist: create new one.
  if (!fileLatestHash) return await actions.cloud._createOrUpdateFile();

  //file exist but hash doesn't match. Overwrite file?
  if (fileLatestHash !== state.common.resource?.hash) {
    actions.ui.openDialog({
      props: {
        maxWidth: 'xs',
        severity: 'warning',
        preventEscape: true,
        title: `${t('cloud.message.file_already_exists', { ns: 'LWStorageService' })}`,
        Body: `${t('cloud.message.Do_you_want_to_overwrite', { ns: 'LWStorageService' })}?`,
        actions: [
          {
            action: 'cancel',
            label: `${t('commons.cancel', { ns: 'LWStorageService' })}`,
            variant: 'outlined',
          },
          { action: 'overwrite', label: `${t('commons.overwrite', { ns: 'LWStorageService' })}` },
        ],
        onClose: async (action) => {
          if (action === 'cancel') {
            actions.cloud.setIsSaving(false);
            return;
          }

          await actions.cloud._createOrUpdateFile(fileLatestHash);
          actions.cloud.setIsSaving(false);
        },
      },
    });

    return;
  }

  //File exist and hash matches. Save file.
  return await actions.cloud._createOrUpdateFile(fileLatestHash);
};

export const _createOrUpdateFile = async ({ state, actions }: Context, hash?: string) => {
  const { commitMessage, repository, repositoryContent, owner } = state.cloud;
  const { resource, contentToSave } = state.common;
  const provider = actions.cloud.getProvider();

  if (
    !contentToSave ||
    !provider ||
    !owner ||
    !repository ||
    !repositoryContent.path ||
    !resource?.filename
  ) {
    return null;
  }

  actions.cloud.setIsSaving(true);

  actions.ui.openDialog({
    props: {
      id: 'progress',
      maxWidth: 'xs',
      preventEscape: true,
      severity: 'info',
      title: `${t('commons.processing', { ns: 'LWStorageService' })}...`,
    },
  });

  const hasPermission = await actions.cloud.checkRepoUserWritenPermission();
  if (!hasPermission) {
    actions.ui.closeDialog('progress');
    actions.cloud.setIsSaving(false);
    return null;
  }

  const currentPath = repositoryContent.path.join('');
  const path = currentPath === '' ? resource.filename : `${currentPath}/${resource.filename}`;

  const response = await provider.saveDocument({
    branch: repository.default_branch,
    content: contentToSave,
    message: commitMessage,
    ownerUsername: owner.username,
    path,
    repoId: repository.id,
    repoName: repository.name,
    hash,
  });

  actions.common.setContentToSave(undefined);

  if (!response) {
    actions.ui.closeDialog('progress');
    actions.ui.openDialog({
      props: {
        id: 'progress',
        maxWidth: 'xs',
        preventEscape: true,
        severity: 'error',
        title: `${t('commons.error', { ns: 'LWStorageService' })}`,
        Body: `${t('cloud.message.unabled_to_save', { ns: 'LWStorageService' })}`,
        onClose: () => actions.cloud.setIsSaving(false),
      },
    });

    return null;
  }

  if (isErrorMessage(response)) {
    actions.ui.closeDialog('progress');

    const title =
      response.message === 'conflict'
        ? t('commons.conflict', { ns: 'LWStorageService' })
        : t('commons.error', { ns: 'LWStorageService' });

    const message =
      response.message === 'conflict'
        ? t('cloud.message.unable_to_overwrite_file', { ns: 'LWStorageService' })
        : `${t('cloud.message.unabled_to_save', { ns: 'LWStorageService' })}. ${response.message}`;

    actions.ui.openDialog({
      props: {
        id: 'progress',
        maxWidth: 'xs',
        preventEscape: true,
        severity: 'error',
        title: title,
        Body: message,
        onClose: () => actions.cloud.setIsSaving(false),
      },
    });

    return null;
  }

  const updatedRsoure = actions.common.setResource({
    ...resource,
    branch: repository.default_branch,
    filename: resource.filename,
    content: contentToSave,
    hash: response.hash,
  });

  state.common.submit = {
    action: 'save',
    resource: updatedRsoure ?? resource,
  };

  actions.ui.closeDialog('progress');
  actions.cloud.setIsSaving(false);

  actions.common.afterSave();
  return response;
};

export const saveAspullRequest = async ({ state, actions }: Context, crossOrigin = false) => {
  const { resource } = state.common;
  if (!resource) return null;

  actions.cloud.setIsSaving(true);

  actions.ui.openDialog({
    props: {
      id: 'progress',
      maxWidth: 'xs',
      preventEscape: true,
      severity: 'info',
      title: `${t('commons.processing', { ns: 'LWStorageService' })}...`,
    },
  });

  const pullRequestResponse = crossOrigin
    ? await actions.cloud.pullRequestFromFork()
    : await actions.cloud.pullRequest();

  actions.ui.closeDialog('progress');

  if (!pullRequestResponse) {
    actions.cloud.setIsSaving(false);
    return {
      type: 'error',
      message: t('cloud.message.unable_pull_reqest', { ns: 'LWStorageService' }),
    };
  }

  if (isErrorMessage(pullRequestResponse)) {
    actions.ui.openDialog({
      props: {
        maxWidth: 'xs',
        preventEscape: true,
        severity: 'error',
        title: pullRequestResponse.message,
        onClose: () => actions.cloud.setIsSaving(false),
      },
    });

    return null;
  }

  actions.common.setResource({
    filename: resource.filename,
    content: resource.content,
    hash: resource.hash,
  });

  actions.common.afterSave();
  actions.cloud.setIsSaving(false);

  return pullRequestResponse;
};

export const pullRequest = async ({
  state,
  actions,
}: Context): Promise<CreatePrResponse | Error | null> => {
  const { repository, owner } = state.cloud;
  const provider = actions.cloud.getProvider();
  if (!provider || !owner || !repository) return null;

  //------  Create version
  const branchHead = await actions.cloud.branchFile();

  if (!branchHead)
    return {
      type: 'error',
      message: t('cloud.message.unable_create_branch', { ns: 'LWStorageService' }),
    };
  if (isErrorMessage(branchHead)) return branchHead;

  const pullRequestResponse = await provider.createPullRequest({
    branchOrigin: repository.default_branch,
    branchHead: branchHead,
    origin: repository,
    ownerUsername: owner.username,
    title: `pull-request-by-${provider.username}`,
  });

  return pullRequestResponse;
};

export const pullRequestFromFork = async ({
  state,
  actions,
}: Context): Promise<CreatePrResponse | Error | null> => {
  const { repository, owner } = state.cloud;
  const { resource } = state.common;
  const provider = actions.cloud.getProvider();
  if (!provider || !owner || !repository || !resource) return null;

  //------  Create version
  const fork = await actions.cloud.forkFile();
  if (!fork)
    return {
      type: 'error',
      message: t('cloud.message.unable_fork_repo', { ns: 'LWStorageService' }),
    };
  if (isErrorMessage(fork)) return fork;

  actions.ui.openDialog({
    props: {
      id: 'merge-progress',
      maxWidth: 'xs',
      severity: 'info',
      title: `${t('cloud.message.create_merge_request', { ns: 'LWStorageService' })}`,
    },
  });

  const pullRequestResponse = await provider.createPullRequestFromFork({
    fork,
    origin: repository,
    title: `pull-request-by-${provider.username}`,
  });

  return pullRequestResponse;
};

export const branchFile = async ({ state, actions }: Context): Promise<string | Error | null> => {
  const { common, cloud } = state;
  const { repository, repositoryContent, owner } = cloud;
  const { resource } = common;

  const provider = actions.cloud.getProvider();
  if (
    !provider ||
    !owner ||
    !repository ||
    !resource?.filename ||
    !repositoryContent.path ||
    !resource?.content
  ) {
    return null;
  }

  //------create branch
  const branch = await actions.cloud.createBranch();
  if (!branch)
    return {
      type: 'error',
      message: t('cloud.message.unable_create_branch', { ns: 'LWStorageService' }),
    };

  //------get document's hash from branch
  const branchHead = `branch-by-${provider.username}`;
  const currentPath = repositoryContent.path.join('');
  const path = currentPath === '' ? resource.filename : `${currentPath}/${resource.filename}`;

  const branchDocument = await provider.getDocument({
    ownerUsername: owner.username,
    path,
    branch: branchHead,
    repoId: repository.id,
    repoName: repository.name,
  });

  const branchDocumentHash = branchDocument ? branchDocument.hash : undefined;

  //------Save file
  const saveOnBranchResponse = await provider.saveDocument({
    branch: branchHead,
    content: resource.content,
    message: cloud.commitMessage,
    ownerUsername: owner.username,
    path,
    repoId: repository.id,
    repoName: repository.name,
    hash: branchDocumentHash,
  });

  if (!saveOnBranchResponse || saveOnBranchResponse.status === 409) {
    return {
      type: 'error',
      message: t('cloud.message.unable_save_on_branch', {
        branch: branchHead,
        ns: 'LWStorageService',
      }),
    };
  }

  return branchHead;
};

export const forkFile = async ({ state, actions }: Context): Promise<Repository | Error | null> => {
  const { common, cloud } = state;
  const { repository, repositoryContent, owner } = cloud;
  const { resource } = common;

  const provider = actions.cloud.getProvider();
  if (
    !provider ||
    !owner ||
    !repository ||
    !repositoryContent.path ||
    !resource?.filename ||
    !resource?.content
  ) {
    return null;
  }

  //------create fork
  const fork = await actions.cloud.fork();
  if (!fork)
    return {
      type: 'error',
      message: t('cloud.message.unable_fork_repo', { ns: 'LWStorageService' }),
    };
  if (isErrorMessage(fork)) return fork;

  //------get document's hash from frok

  const currentPath = repositoryContent.path.join('');
  const path = currentPath === '' ? resource.filename : `${currentPath}/${resource.filename}`;

  actions.ui.openDialog({
    props: {
      id: 'saving-document',
      maxWidth: 'xs',
      severity: 'info',
      title: `${t('message.saving_document', { ns: 'LWStorageService' })}`,
    },
  });

  const forkDocument = await provider.getDocument({
    ownerUsername: provider.username,
    path,
    branch: repository.default_branch,
    repoId: fork.id,
    repoName: fork.name,
  });
  const forkDocumentHash = forkDocument ? forkDocument.hash : undefined;

  //------Save file
  const saveOnForkResponse = await provider.saveDocument({
    branch: repository.default_branch,
    content: resource.content,
    message: cloud.commitMessage,
    ownerUsername: provider.username,
    path,
    repoId: fork.id,
    repoName: fork.name,
    hash: forkDocumentHash,
  });

  if (!saveOnForkResponse || saveOnForkResponse.status === 409) {
    return {
      type: 'error',
      message: t('cloud.message.unable_save_document_on_fork', {
        fork: fork.name,
        ns: 'LWStorageService',
      }),
    };
  }

  return fork;
};

export const fork = async ({ state, actions }: Context): Promise<Repository | Error | null> => {
  const { collectionSource, owner, repository } = state.cloud;
  const provider = actions.cloud.getProvider();
  if (!provider || !owner || !repository) return null;

  //get forked repo
  let repo = await provider
    .getRepo({
      username: provider.username,
      repoName: repository.name,
      repoId: `${provider.username}/${repository.path}`,
    })
    .catch(() => null);

  if (repo) return repo;

  setTimeout(() => {
    actions.ui.openDialog({
      props: {
        id: 'forking-repository',
        maxWidth: 'xs',
        severity: 'info',
        title: `${t('cloud.forking', { ns: 'LWStorageService' })}`,
        Body: `${t('cloud.message.forking_can_take_minutes', { ns: 'LWStorageService' })}. ${t(
          'message.be_patient',
          { ns: 'LWStorageService' },
        )}.}`,
      },
    });
  }, 5_000);

  //create new fork
  const fork: Repository | Error = await provider
    .createFork({
      ownerUsername: owner.username,
      repoName: repository.name,
      repoId: repository.id,
      orgName: collectionSource === 'organization' ? owner.username : undefined,
    })
    .catch((error) => {
      // throw new Error(error);
      return { type: 'error', message: error };
    });

  //error handling
  if (isErrorMessage(fork)) return fork;

  //get recent creted fork
  repo = await provider
    .getRepo({
      username: provider.username,
      repoName: fork.name,
      repoId: fork.id,
    })
    .catch(() => null);

  if (!repo) return null;

  return repo as Repository;
};

export const createBranch = async ({ state, actions }: Context) => {
  const provider = actions.cloud.getProvider();
  if (!provider) return null;

  const { cloud } = state;
  if (!cloud.repository) return null;

  //check if branch exists
  let branch: any = await provider.getBranch({
    branch: `branch-by-${provider.username}`,
    ownerUsername: cloud.owner?.username,
    repoId: cloud.repository?.id,
    repoName: cloud.repository?.name,
  });

  if (branch) return branch;

  //create new one if branch does not exists
  branch = await provider.createBranch({
    branchOrigin: cloud.repository?.default_branch,
    branchTarget: `branch-by-${provider.username}`,
    repoId: cloud.repository?.id,
    ownerUsername: cloud.owner?.username,
    repoName: cloud.repository.name,
  });

  if (!branch) return null;

  return branch;
};

//? PUBLIC RESPOSITORY

export const addPublicRepository = async (_: Context, publicRepository: PublicRepository) => {
  await db.publicRepositories.add(publicRepository).catch(() => {
    log.debug('Public Repository already added.', publicRepository);
  });
};

export const getPublicRepository = async (_: Context, uuid: string) => {
  return await db.publicRepositories.get(uuid);
};

export const removePublicRepository = async (_: Context, uuid: string) => {
  await db.publicRepositories.delete(uuid);
};
