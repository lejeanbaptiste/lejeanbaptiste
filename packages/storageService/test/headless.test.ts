import { loadDocument, saveDocument } from '../src/headless';
import Github from '../src/providers/Github';
import Gitlab from '../src/providers/Gitlab';
import { spyProviderFunctions } from './mocks/provider';
import * as mock from './mocks/resource';

beforeAll(() => {
  spyProviderFunctions();
});

beforeEach(() => {
  jest.restoreAllMocks();
  spyProviderFunctions();
});

describe.only('headless', () => {
  describe('Load document', () => {
    describe('Resource invalid', () => {
      test.each([
        { name: 'Provider undefined', auth: mock.githubAuth, resource: {} },
        {
          name: 'Owner undefined',
          auth: mock.githubAuth,
          resource: mock.getResource({ type: 'owner_undefined' }),
        },
        {
          name: 'Ownertype undefined',
          auth: mock.githubAuth,
          resource: mock.getResource({ type: 'ownertype_undefined' }),
        },
        {
          name: 'Repo undefined',
          auth: mock.githubAuth,
          resource: mock.getResource({ type: 'repo_undefined' }),
        },
        {
          name: 'Filename undefined',
          auth: mock.githubAuth,
          resource: mock.getResource({ type: 'filename_undefined' }),
        },
        {
          name: 'Provider unsupported',
          auth: mock.unsupportedProviderAuth,
          resource: mock.getResource({ provider: 'github' }),
        },
        {
          name: 'Document not found',
          auth: mock.githubAuth,
          resource: mock.getResource({ type: 'document_not_found' }),
        },
      ])('$name', async ({ auth, resource }) => {
        jest.spyOn(Github.prototype, 'getDocument').mockImplementationOnce(async () => null);
        const response = await loadDocument(auth, resource);
        expect(response).toHaveProperty('error');
      });

      test('Repository invalid', async () => {
        jest.spyOn(Github.prototype, 'getRepo').mockImplementationOnce(async () => {
          throw new Error();
        });

        const response = await loadDocument(
          mock.githubAuth,
          mock.getResource({ type: 'repo_invalid' })
        );
        expect(response).toHaveProperty('error');
      });
    });

    describe('Resource valid', () => {
      test.each([{ provider: 'github' }, { provider: 'gitlab' }])(
        '$provider: File Loaded',
        async ({ provider }) => {
          const response = await loadDocument(
            mock.getProviderAuth(provider),
            mock.getResource({ provider })
          );
          expect(response).toHaveProperty('content');
          expect(response).toHaveProperty('hash');
        }
      );
    });
  });

  describe('Save document', () => {
    describe('Resource invalid', () => {
      test.each([
        {
          name: 'Provider undefined',
          auth: mock.githubAuth,
          resource: {},
        },
        {
          name: 'Owner undefined',
          auth: mock.githubAuth,
          resource: mock.getResource({ type: 'owner_undefined' }),
        },
        {
          name: 'Ownertype undefined',
          auth: mock.githubAuth,
          resource: mock.getResource({ type: 'ownertype_undefined' }),
        },
        {
          name: 'Repo undefined',
          auth: mock.githubAuth,
          resource: mock.getResource({ type: 'repo_undefined' }),
        },
        {
          name: 'Filename undefined',
          auth: mock.githubAuth,
          resource: mock.getResource({ type: 'filename_undefined' }),
        },
        {
          name: 'Provider unsupported',
          auth: mock.unsupportedProviderAuth,
          resource: mock.getResource({ provider: 'github' }),
        },
        {
          name: 'Document not found',
          auth: mock.githubAuth,
          resource: mock.getResource({ type: 'document_not_found' }),
        },
      ])('$name', async ({ auth, resource }) => {
        jest.spyOn(Github.prototype, 'getDocument').mockImplementationOnce(async () => null);
        const response = await saveDocument(auth, resource);
        expect(response).toHaveProperty('error');
      });

      test('Repository invalid', async () => {
        jest.spyOn(Github.prototype, 'getRepo').mockImplementationOnce(async () => {
          throw new Error();
        });

        const response = await saveDocument(
          mock.githubAuth,
          mock.getResource({ type: 'repo_invalid' })
        );
        expect(response).toHaveProperty('error');
      });
    });

    describe('Permission', () => {
      test.each([{ provider: 'github' }, { provider: 'gitlab' }])(
        '$provider: No permission to save',
        async ({ provider }) => {
          jest
            .spyOn(Github.prototype, 'checkRepoUserWritenPermission')
            .mockImplementationOnce(async () => false);

          jest
            .spyOn(Gitlab.prototype, 'checkRepoUserWritenPermission')
            .mockImplementationOnce(async () => false);

          const response = await saveDocument(
            mock.getProviderAuth(provider),
            mock.getResource({ provider })
          );
          expect(response).toHaveProperty('error');
        }
      );

      test.each([{ provider: 'github' }, { provider: 'gitlab' }])(
        '$provider: File already exist && override not allowed',
        async ({ provider }) => {
          const doc = { content: 'test', hash: '111' };

          jest.spyOn(Github.prototype, 'getDocument').mockImplementationOnce(async () => doc);
          jest.spyOn(Gitlab.prototype, 'getDocument').mockImplementationOnce(async () => doc);

          const response = await saveDocument(
            mock.getProviderAuth(provider),
            mock.getResource({ provider })
          );
          expect(response).toHaveProperty('error');
        }
      );
    });

    describe('Resource valid', () => {
      test.each([{ provider: 'github' }, { provider: 'gitlab' }])(
        '$provider: File already exist && override allowed',
        async ({ provider }) => {
          const doc = { content: 'test', hash: '111' };

          jest.spyOn(Github.prototype, 'getDocument').mockImplementationOnce(async () => doc);
          jest.spyOn(Gitlab.prototype, 'getDocument').mockImplementationOnce(async () => doc);

          const response = await saveDocument(
            mock.getProviderAuth(provider),
            mock.getResource({ provider }),
            true
          );
          expect(response).toHaveProperty('content');
          expect(response).toHaveProperty('hash');
        }
      );

      test.each([{ provider: 'github' }, { provider: 'gitlab' }])(
        '$provider: File saved',
        async ({ provider }) => {
          const response = await loadDocument(
            mock.getProviderAuth(provider),
            mock.getResource({ provider })
          );
          expect(response).toHaveProperty('content');
          expect(response).toHaveProperty('hash');
        }
      );
    });
  });
});
