import Github from '../../src/providers/Github';
import Gitlab from '../../src/providers/Gitlab';
import * as mock from './resource';

export const spyProviderFunctions = () => {
  spyGithub();
  spyGitlab();
};

const spyGithub = () => {
  jest
    .spyOn(Github.prototype, 'getAuthenticatedUser')
    .mockImplementation(async () => mock.authenticatedUser);

  jest.spyOn(Github.prototype, 'getRepo').mockImplementation(async () => mock.repository);

  jest.spyOn(Github.prototype, 'getDocument').mockImplementation(async () => mock.document);
  jest
    .spyOn(Github.prototype, 'checkRepoUserWritenPermission')
    .mockImplementation(async () => true);

  jest.spyOn(Github.prototype, 'saveDocument').mockImplementation(async () => mock.savedDocument);

  jest
    .spyOn(Github.prototype, 'getReposForAuthenticatedUser')
    .mockImplementation(async () => ({ collection: mock.repositories, nextPage: null }));

  jest.spyOn(Github.prototype, 'getRepoContent').mockImplementation(async () => mock.repoContent);

  jest
    .spyOn(Github.prototype, 'getOrganizationsForAuthenticatedUser')
    .mockImplementation(async () => ({ collection: mock.organizations, nextPage: null }));
};

const spyGitlab = () => {
  jest
    .spyOn(Gitlab.prototype, 'getAuthenticatedUser')
    .mockImplementation(async () => mock.authenticatedUser);

  jest.spyOn(Gitlab.prototype, 'getRepo').mockImplementation(async () => mock.repository);

  jest.spyOn(Gitlab.prototype, 'getDocument').mockImplementation(async () => mock.document);
  jest
    .spyOn(Gitlab.prototype, 'checkRepoUserWritenPermission')
    .mockImplementation(async () => true);

  jest.spyOn(Gitlab.prototype, 'saveDocument').mockImplementation(async () => mock.savedDocument);
};
