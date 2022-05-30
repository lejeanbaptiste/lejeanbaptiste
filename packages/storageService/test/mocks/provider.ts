import { jest } from '@jest/globals';
import Github from '../../src/providers/Github';
import Gitlab from '../../src/providers/Gitlab';
import * as mock from './resource';

export const spyProviderFunctions = () => {
  spyGithub();
  spyGitlab();
};

const spyGithub = () => {
  const provider = Github.prototype;
  jest
    .spyOn(provider, 'getAuthenticatedUser')
    .mockImplementation(async () => mock.authenticatedUser);

  jest.spyOn(provider, 'getRepo').mockImplementation(async () => mock.repository);

  jest.spyOn(provider, 'getDocument').mockImplementation(async () => mock.document);
  jest.spyOn(provider, 'checkRepoUserWritenPermission').mockImplementation(async () => true);

  jest.spyOn(provider, 'saveDocument').mockImplementation(async () => mock.savedDocument);

  jest
    .spyOn(provider, 'getReposForAuthenticatedUser')
    .mockImplementation(async () => ({ collection: mock.repositories, nextPage: null }));

  //@ts-ignore
  jest.spyOn(provider, 'getRepoContent').mockImplementation(async () => mock.repoContent);

  jest
    .spyOn(provider, 'getOrganizationsForAuthenticatedUser')
    .mockImplementation(async () => ({ collection: mock.organizations, nextPage: null }));

  jest
    .spyOn(provider, 'getReposForOrganization')
    .mockImplementation(async () => ({ collection: mock.repositories, nextPage: null }));

  jest.spyOn(provider, 'searchBlobs').mockImplementation(async () => mock.githubResultSearchBlob);
  jest.spyOn(provider, 'searchUsers').mockImplementation(async () => mock.searchUsersResult);

  jest
    .spyOn(provider, 'getLatestCommit')
    .mockImplementation(async () => mock.getLatestCommitResults);

  jest.spyOn(provider, 'createFolder').mockImplementation(async () => mock.createFolderResults);
};

const spyGitlab = () => {
  const provider = Gitlab.prototype;

  jest
    .spyOn(provider, 'getAuthenticatedUser')
    .mockImplementation(async () => mock.authenticatedUser);

  jest.spyOn(provider, 'getRepo').mockImplementation(async () => mock.repository);

  jest.spyOn(provider, 'getDocument').mockImplementation(async () => mock.document);
  jest.spyOn(provider, 'checkRepoUserWritenPermission').mockImplementation(async () => true);

  jest.spyOn(provider, 'saveDocument').mockImplementation(async () => mock.savedDocument);

  jest
    .spyOn(provider, 'getReposForAuthenticatedUser')
    .mockImplementation(async () => ({ collection: mock.repositories, nextPage: null }));

  jest
    .spyOn(provider, 'getOrganizationsForAuthenticatedUser')
    .mockImplementation(async () => ({ collection: mock.organizations, nextPage: null }));

  jest
    .spyOn(provider, 'getReposForOrganization')
    .mockImplementation(async () => ({ collection: mock.repositories, nextPage: null }));

  jest.spyOn(provider, 'getRepoContent').mockImplementation(async () => mock.repoContent);

  jest.spyOn(provider, 'searchBlobs').mockImplementation(async () => mock.gitlabResultSearchBlob);

  jest
    .spyOn(provider, 'getRepoContentRecursively')
    .mockImplementation(async () => mock.getRepoContentRecursivelyResults);

  jest.spyOn(provider, 'searchUsers').mockImplementation(async () => mock.searchUsersResult);

  jest
    .spyOn(provider, 'getLatestCommit')
    .mockImplementation(async () => mock.getLatestCommitResults);

  jest.spyOn(provider, 'createFolder').mockImplementation(async () => mock.createFolderResults);
};
