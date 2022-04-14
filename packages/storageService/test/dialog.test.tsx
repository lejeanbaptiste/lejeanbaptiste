import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  getByTestId,
  getByTitle,
  prettyDOM,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import StorageDialog from '../src';
import type { StorageDialogProps } from '../src/@types/types';
import Github from '../src/providers/Github';
import Gitlab from '../src/providers/Gitlab';
import { spyProviderFunctions } from './mocks/provider';
import * as mock from './mocks/resource';

jest.setTimeout(30_000);

beforeAll(() => {
  spyProviderFunctions();
});

beforeEach(() => {
  jest.restoreAllMocks();
  spyProviderFunctions();
});

const setup = async (props: Omit<StorageDialogProps, 'open'> = {}) => {
  //@ts-ignore
  await act(async () => render(<StorageDialog open={true} {...props} />));
};

const closeLoadDialog = async () => {
  const footer = screen.getByTestId('footer-load');
  await act(async () => userEvent.click(getByTitle(footer, 'cancel')));
};

describe('Dialog', () => {
  describe('Load', () => {
    describe('From local (default)', () => {
      test('Open dialog', async () => {
        await setup();

        expect.assertions(2);

        expect(screen.getByTestId('header-dialog-title')).toHaveTextContent('Load');
        expect(screen.getByTestId('header-source')).toHaveTextContent('local');
      });

      // test('select file', async () => {
      //   await setup();

      //   expect.assertions(2);

      //   expect(screen.getByTestId('header-dialog-title')).toHaveTextContent('Load');
      //   expect(screen.getByTestId('header-source')).toHaveTextContent('local');

      //   await act(async () => {
      //     fireEvent.change(screen.getByTestId('upload_panel-input'), {
      //       target: {
      //         files: [new File(['(⌐□_□)'], 'letter.xml', { type: 'application/xml' })],
      //       },
      //     });
      //   });
      // });
    });

    describe('From Paste', () => {
      test('change from local to paste -> add paste content', async () => {
        await setup();

        expect.assertions(4);

        expect(screen.getByTestId('header-dialog-title')).toHaveTextContent('Load');
        expect(screen.getByTestId('header-source')).toHaveTextContent('local');

        fireEvent.click(screen.getByTestId('source_panel-paste'));
        expect(screen.getByTestId('header-source')).toHaveTextContent('paste');

        const input = screen.getByTestId('paste_panel-input') as HTMLInputElement;
        fireEvent.change(input, { target: { value: '<xml>' } });

        expect(input).toHaveTextContent('<xml>');
      });

      test('Source Paste', async () => {
        await setup({ source: 'paste' });

        expect.assertions(2);

        expect(screen.getByTestId('header-dialog-title')).toHaveTextContent('Load');
        expect(screen.getByTestId('header-source')).toHaveTextContent('paste');
      });

      test('Source Paste with content', async () => {
        await setup({ resource: { content: '<xml>' } });

        expect.assertions(3);

        expect(screen.getByTestId('header-dialog-title')).toHaveTextContent('Load');
        expect(screen.getByTestId('header-source')).toHaveTextContent('paste');
        expect(screen.getByTestId('paste_panel-input')).toHaveTextContent('<xml>');
      });
    });

    describe.each([
      { name: '[Github] From Cloud', preferProvider: 'github' },
      { name: '[Gitlab] From Cloud', preferProvider: 'gitlab' },
    ])('$name', ({ preferProvider }) => {
      describe('General', () => {
        test('Open dialog', async () => {
          await setup({
            config: {
              preferProvider,
              providers: [mock.githubAuth, mock.gitlabAuth],
            },
          });

          expect.assertions(3);

          const storageDialog = screen.getByTestId('storage-dialog');
          expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Load');
          expect(getByTestId(storageDialog, 'header-source')).toHaveTextContent(preferProvider);

          await waitFor(
            () => expect(getByTestId(storageDialog, 'list-repos')).toBeInTheDocument(),
            {
              timeout: 500,
            }
          );

          await closeLoadDialog();
        });

        test('Open dialog mobile', async () => {
          //* ALLOWS TO RESIZE WINDOW
          const matchMediaBK = window.matchMedia;
          //@ts-ignore
          window.matchMedia = (match: string) => ({
            //@ts-ignore
            matches: true, // <-- Set according to what you want to test
            addListener: () => {},
            removeListener: () => {},
          });

          expect.assertions(4);

          //resize window to load mobile menu
          global.innerWidth = 500;
          window.dispatchEvent(new Event('resize'));
          expect(window.innerWidth).toBe(500);

          await setup({
            config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
          });

          const storageDialog = screen.getByTestId('storage-dialog');
          expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Load');
          expect(getByTestId(storageDialog, 'header-source')).toHaveTextContent(preferProvider);

          await waitFor(
            () => expect(getByTestId(storageDialog, 'list-repos')).toBeInTheDocument(),
            {
              timeout: 500,
            }
          );

          //* RESTORE
          window.matchMedia = matchMediaBK;
          global.innerWidth = 1024;
          window.dispatchEvent(new Event('resize'));

          await closeLoadDialog();
        });
      });

      describe('Settings', () => {
        test('Toggle Allow All Files', async () => {
          await setup({
            config: {
              allowedMimeTypes: ['application/xml'],
              preferProvider,
              providers: [mock.githubAuth, mock.gitlabAuth],
            },
          });

          expect.assertions(11);

          const storageDialog = screen.getByTestId('storage-dialog');

          expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Load');
          expect(getByTestId(storageDialog, 'header-source')).toHaveTextContent(preferProvider);

          const repositories = getByTestId(storageDialog, 'list-repos');
          await waitFor(() => expect(repositories).toBeInTheDocument());

          const repo = getByTitle(repositories, 'repo1');
          await act(async () => userEvent.dblClick(getByTestId(repo, 'primary-button')));

          const repositoryList = getByTestId(storageDialog, 'list-content');
          await waitFor(() => expect(repositoryList).toBeInTheDocument());

          const file = getByTitle(storageDialog, 'file_name_without_extension');
          expect(getByTestId(file, 'primary-button')).toHaveClass('Mui-disabled');

          await act(async () => {
            const sourcePanel = getByTestId(storageDialog, 'source_panel');
            userEvent.click(getByTitle(sourcePanel, 'settings'));
          });

          const globalSettingsDialog = screen.getByTestId('global_settings-dialog');
          await waitFor(() => expect(globalSettingsDialog).toBeInTheDocument());

          const allowAllFilesButton = getByTitle(globalSettingsDialog, 'Allow all files');
          expect(allowAllFilesButton).not.toHaveClass('Mui-checked');

          //toggle allow all
          await act(async () => userEvent.click(allowAllFilesButton));
          expect(allowAllFilesButton).toHaveClass('Mui-checked');
          expect(getByTestId(file, 'primary-button')).not.toHaveClass('Mui-disabled');

          //toggle not allow all
          await act(async () => userEvent.click(allowAllFilesButton));
          expect(allowAllFilesButton).not.toHaveClass('Mui-checked');
          expect(getByTestId(file, 'primary-button')).toHaveClass('Mui-disabled');

          await closeLoadDialog();
        });
      });

      describe('Organizations', () => {
        test('Select and Open Organization', async () => {
          await setup({
            config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
          });

          expect.assertions(8);

          const storageDialog = screen.getByTestId('storage-dialog');
          const footer = getByTestId(storageDialog, 'footer-load');
          const footerLoadButton = getByTitle(footer, 'load');

          expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Load');
          expect(getByTestId(storageDialog, 'header-source')).toHaveTextContent(preferProvider);
          expect(footerLoadButton).not.toBeEnabled();

          const sidebar = getByTestId(storageDialog, 'sidebar');
          const organizationsButton = getByTitle(sidebar, 'Organizations');
          await act(async () =>
            userEvent.click(getByTestId(organizationsButton, 'primary-button'))
          );

          const organizations = await waitFor(() => {
            const listOrganizations = getByTestId(storageDialog, 'list-organizations');
            expect(listOrganizations).toBeInTheDocument();
            return listOrganizations;
          });

          const organization = getByTitle(organizations, 'organization 1');
          const orgButton = getByTestId(organization, 'primary-button');
          await act(async () => userEvent.click(orgButton));

          expect(orgButton).toHaveClass('Mui-selected');
          expect(footerLoadButton).toBeEnabled();
          expect(footerLoadButton).toHaveTextContent('open');

          await act(async () => userEvent.click(footerLoadButton));
          await waitFor(() => expect(getByTestId(storageDialog, 'list-repos')).toBeInTheDocument());

          await closeLoadDialog();
        });

        test('Open Organization', async () => {
          await setup({
            config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
          });

          expect.assertions(4);

          const storageDialog = screen.getByTestId('storage-dialog');

          expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Load');
          expect(getByTestId(storageDialog, 'header-source')).toHaveTextContent(preferProvider);

          const sidebar = getByTestId(storageDialog, 'sidebar');
          const organizationsButton = getByTitle(sidebar, 'Organizations');
          await act(async () =>
            userEvent.click(getByTestId(organizationsButton, 'primary-button'))
          );

          const organizations = await waitFor(() => {
            const listOrganizations = getByTestId(storageDialog, 'list-organizations');
            expect(listOrganizations).toBeInTheDocument();
            return listOrganizations;
          });

          const organization = getByTitle(organizations, 'organization 1');
          const orgButton = getByTestId(organization, 'primary-button');
          await act(async () => userEvent.dblClick(orgButton));

          await waitFor(() => expect(getByTestId(storageDialog, 'list-repos')).toBeInTheDocument());

          await closeLoadDialog();
        });
      });

      describe('Repositories', () => {
        test('No repositories', async () => {
          const provider = preferProvider === 'github' ? Github.prototype : Gitlab.prototype;
          jest
            .spyOn(provider, 'getReposForAuthenticatedUser')
            .mockImplementationOnce(async () => ({ collection: [], nextPage: null }));

          await setup({
            config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
          });

          expect.assertions(3);

          const storageDialog = screen.getByTestId('storage-dialog');
          expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Load');
          expect(getByTestId(storageDialog, 'header-source')).toHaveTextContent(preferProvider);

          await waitFor(() => expect(getByTestId(storageDialog, 'list-empty')).toBeInTheDocument());

          await closeLoadDialog();
        });

        test('Select shared with me', async () => {
          await setup({
            config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
          });

          expect.assertions(3);

          const storageDialog = screen.getByTestId('storage-dialog');
          expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Load');
          expect(getByTestId(storageDialog, 'header-source')).toHaveTextContent(preferProvider);

          const sidebar = getByTestId(storageDialog, 'sidebar');
          const shared = getByTitle(sidebar, 'Shared with me');
          await act(async () => userEvent.click(getByTestId(shared, 'primary-button')));

          await waitFor(() => expect(getByTestId(storageDialog, 'list-repos')).toBeInTheDocument());

          await closeLoadDialog();
        });

        test('Select and Open repository', async () => {
          await setup({
            config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
          });

          expect.assertions(8);

          const storageDialog = screen.getByTestId('storage-dialog');
          const footer = getByTestId(storageDialog, 'footer-load');
          const footerLoadButton = getByTitle(footer, 'load');

          expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Load');
          expect(getByTestId(storageDialog, 'header-source')).toHaveTextContent(preferProvider);

          const repositories = getByTestId(storageDialog, 'list-repos');
          await waitFor(() => expect(repositories).toBeInTheDocument());
          expect(footerLoadButton).not.toBeEnabled();

          const repo = getByTitle(repositories, 'repo1');
          const repoButton = getByTestId(repo, 'primary-button');
          await act(async () => userEvent.click(repoButton));

          expect(repoButton).toHaveClass('Mui-selected');
          expect(footerLoadButton).toBeEnabled();
          expect(footerLoadButton).toHaveTextContent('open');

          await act(async () => userEvent.click(footerLoadButton));

          await waitFor(() =>
            expect(getByTestId(storageDialog, 'list-content')).toBeInTheDocument()
          );

          await closeLoadDialog();
        });

        test('Open repository', async () => {
          await setup({
            config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
          });

          expect.assertions(4);

          const storageDialog = screen.getByTestId('storage-dialog');

          expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Load');
          expect(getByTestId(storageDialog, 'header-source')).toHaveTextContent(preferProvider);

          const repositories = getByTestId(storageDialog, 'list-repos');
          await waitFor(() => expect(repositories).toBeInTheDocument());

          const repo = getByTitle(repositories, 'repo1');
          await act(async () => userEvent.dblClick(getByTestId(repo, 'primary-button')));

          await waitFor(() =>
            expect(getByTestId(storageDialog, 'list-content')).toBeInTheDocument()
          );

          await closeLoadDialog();
        });

        describe('Folder', () => {
          test('Select and Open folder', async () => {
            await setup({
              config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
            });

            expect.assertions(9);

            const storageDialog = screen.getByTestId('storage-dialog');
            const footer = getByTestId(storageDialog, 'footer-load');
            const footerLoadButton = getByTitle(footer, 'load');

            expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Load');
            expect(getByTestId(storageDialog, 'header-source')).toHaveTextContent(preferProvider);
            expect(footerLoadButton).not.toBeEnabled();

            const repositories = getByTestId(storageDialog, 'list-repos');
            await waitFor(() => expect(repositories).toBeInTheDocument());

            const repo = getByTitle(repositories, 'repo1');
            await act(async () => userEvent.dblClick(getByTestId(repo, 'primary-button')));

            expect(footerLoadButton).not.toBeEnabled();

            const folder = getByTitle(storageDialog, 'folder1');
            const folderButton = getByTestId(folder, 'primary-button');
            await act(async () => userEvent.click(folderButton));

            expect(folderButton).toHaveClass('Mui-selected');
            expect(footerLoadButton).toBeEnabled();
            expect(footerLoadButton).toHaveTextContent('open');

            await act(async () => userEvent.click(footerLoadButton));

            await waitFor(() =>
              expect(getByTestId(storageDialog, 'list-content')).toBeInTheDocument()
            );

            await closeLoadDialog();
          });

          test('Open folder', async () => {
            await setup({
              config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
            });

            expect.assertions(5);

            const storageDialog = screen.getByTestId('storage-dialog');

            expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Load');
            expect(getByTestId(storageDialog, 'header-source')).toHaveTextContent(preferProvider);

            const repositories = getByTestId(storageDialog, 'list-repos');
            await waitFor(() => expect(repositories).toBeInTheDocument());

            const repo = getByTitle(repositories, 'repo1');
            await act(async () => userEvent.dblClick(getByTestId(repo, 'primary-button')));

            const repositoryList = getByTestId(storageDialog, 'list-content');
            await waitFor(() => expect(repositoryList).toBeInTheDocument());

            await act(async () => userEvent.dblClick(getByTitle(repositoryList, 'folder1')));
            await waitFor(() => expect(repositoryList).toBeInTheDocument());

            await closeLoadDialog();
          });
        });

        describe('File', () => {
          test('Select file and Get details', async () => {
            await setup({
              config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
            });

            expect.assertions(11);

            const storageDialog = screen.getByTestId('storage-dialog');

            expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Load');
            expect(getByTestId(storageDialog, 'header-source')).toHaveTextContent(preferProvider);

            const repositories = getByTestId(storageDialog, 'list-repos');
            await waitFor(() => expect(repositories).toBeInTheDocument());

            const repo = getByTitle(repositories, 'repo1');
            await act(async () => userEvent.dblClick(getByTestId(repo, 'primary-button')));

            const repositoryList = getByTestId(storageDialog, 'list-content');
            await waitFor(() => expect(repositoryList).toBeInTheDocument());

            const file = getByTitle(storageDialog, 'file1.xml');
            await act(async () => userEvent.click(getByTestId(file, 'primary-button')));

            const secondaryButton = getByTestId(file, 'secondary-button');
            await waitFor(() => expect(secondaryButton).toBeInTheDocument());
            await act(async () => userEvent.click(secondaryButton));

            const contentDetails = getByTestId(file, 'content-details');
            await waitFor(() => expect(contentDetails).toBeInTheDocument());

            const { authorEmail, authorName, date, html_url, message } =
              mock.getLatestCommitResults;
            const author = getByTitle(contentDetails, `${authorName} (${authorEmail})`);

            expect(getByTitle(contentDetails, date)).toBeInTheDocument();
            expect(author).toHaveTextContent(authorName);
            expect(author).toHaveAttribute('href', `mailto:${authorEmail}`);
            expect(getByTestId(contentDetails, 'message')).toHaveTextContent(message);
            expect(getByTitle(contentDetails, html_url)).toHaveAttribute('href', html_url);

            await closeLoadDialog();
          });
        });
      });

      describe('Search', () => {
        test('Users', async () => {
          await setup({
            config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
          });

          expect.assertions(4);

          const storageDialog = screen.getByTestId('storage-dialog');
          expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Load');
          expect(getByTestId(storageDialog, 'header-source')).toHaveTextContent(preferProvider);

          const input = screen.getByTestId('search-user-input') as HTMLInputElement;
          userEvent.type(input, 'anto');
          await waitFor(() => {}, { timeout: 800 });
          expect(input).toHaveValue('anto');

          await waitFor(() => expect(screen.getByTestId('search-user-result')).toBeInTheDocument());

          // await closeLoadDialog();
        });
        test('Content', async () => {
          await setup({
            config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
          });

          expect.assertions(7);

          const storageDialog = screen.getByTestId('storage-dialog');

          expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Load');
          expect(getByTestId(storageDialog, 'header-source')).toHaveTextContent(preferProvider);

          const repositories = getByTestId(storageDialog, 'list-repos');
          await waitFor(() => expect(repositories).toBeInTheDocument());

          const repo = getByTitle(repositories, 'repo1');
          await act(async () => userEvent.dblClick(getByTestId(repo, 'primary-button')));

          await waitFor(() =>
            expect(getByTestId(storageDialog, 'list-content')).toBeInTheDocument()
          );

          const searchBar = getByTestId(storageDialog, 'search-bar');
          expect(searchBar).toBeInTheDocument();

          const input = getByTitle(searchBar, 'search') as HTMLInputElement;

          await act(async () => userEvent.type(input, 'car', { delay: 50 })); //simulate user typing
          expect(input).toHaveValue('car');

          await waitFor(
            () => expect(getByTestId(searchBar, 'results')).toBeInTheDocument(),
            { timeout: 2000 } //animation
          );

          // await closeLoadDialog();
        });

        test('Content and display details', async () => {
          await setup({
            config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
          });

          expect.assertions(9);

          const storageDialog = screen.getByTestId('storage-dialog');

          expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Load');
          expect(getByTestId(storageDialog, 'header-source')).toHaveTextContent(preferProvider);

          const repositories = getByTestId(storageDialog, 'list-repos');
          await waitFor(() => expect(repositories).toBeInTheDocument());

          const repo = getByTitle(repositories, 'repo1');
          await act(async () => userEvent.dblClick(getByTestId(repo, 'primary-button')));

          await waitFor(() =>
            expect(getByTestId(storageDialog, 'list-content')).toBeInTheDocument()
          );

          const searchBar = getByTestId(storageDialog, 'search-bar');
          expect(searchBar).toBeInTheDocument();

          const input = getByTitle(searchBar, 'search') as HTMLInputElement;

          await act(async () => userEvent.type(input, 'lang', { delay: 50 })); //simulate user typing
          expect(input).toHaveValue('lang');

          const searchResult = await waitFor(
            () => {
              const results = getByTestId(searchBar, 'results');
              expect(results).toBeInTheDocument();
              return results;
            },
            { timeout: 2000 } //animation
          );

          const item = getByTitle(searchResult, 'language.xml');
          await act(async () => userEvent.hover(item));

          const terciaryButton = getByTestId(item, 'tertiary-button');
          await waitFor(() => expect(terciaryButton).toBeInTheDocument());
          await act(async () => userEvent.click(terciaryButton));

          await waitFor(() =>
            expect(getByTestId(item, 'search-match-details')).toBeInTheDocument()
          );

          // await closeLoadDialog();
        });
      });
    });
  });

  describe('Save', () => {
    test('Open dialog', async () => {
      await setup({
        config: {
          providers: [mock.githubAuth, mock.gitlabAuth],
          preferProvider: 'github',
        },
        resource: mock.getResource({ provider: 'github' }),
        type: 'save',
      });

      await waitFor(() => screen.getByTestId('header-dialog-title'));

      expect(screen.getByTestId('header-dialog-title')).toHaveTextContent('Save');
      expect(screen.getByTestId('header-source')).toHaveTextContent('github');
    });
  });
});
