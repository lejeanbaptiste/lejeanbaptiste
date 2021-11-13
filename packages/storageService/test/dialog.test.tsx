import React from 'react';
import { act, render, fireEvent, waitFor, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import StorageDialog from '../src';
import type { StorageDialogProps } from '../src/@types/types';
import * as mock from './mocks/resource';
import { spyProviderFunctions } from './mocks/provider';
import userEvent from '@testing-library/user-event';
import Github from '../src/providers/Github';
import Gitlab from '../src/providers/Gitlab';

jest.setTimeout(20000);

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

describe('Dialog', () => {
  describe('Load', () => {
    describe('From local (default)', () => {
      test('Open dialog', async () => {
        await setup();

        expect.assertions(2);

        expect(screen.getByTestId('header-dialog-title')).toHaveTextContent('Load');
        expect(screen.getByTestId('header-source')).toHaveTextContent('local');
      });

      // test('Open dialog -> select file', async () => {
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
      test('Open dialog -> change from local to paste -> add paste content', async () => {
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

      test('Open dialog -> Source Paste', async () => {
        await setup({ source: 'paste' });

        expect.assertions(2);

        expect(screen.getByTestId('header-dialog-title')).toHaveTextContent('Load');
        expect(screen.getByTestId('header-source')).toHaveTextContent('paste');
      });

      test('Open dialog -> Source Paste with content', async () => {
        await setup({ resource: { content: '<xml>' } });

        expect.assertions(3);

        expect(screen.getByTestId('header-dialog-title')).toHaveTextContent('Load');
        expect(screen.getByTestId('header-source')).toHaveTextContent('paste');
        expect(screen.getByTestId('paste_panel-input')).toHaveTextContent('<xml>');
      });
    });

    describe('From Cloud', () => {
      test('Open dialog', async () => {
        await setup({
          config: {
            providers: [mock.githubAuth, mock.gitlabAuth],
            preferProvider: 'github',
          },
        });

        await waitFor(() => screen.getByTestId('header-dialog-title'));

        expect(screen.getByTestId('header-dialog-title')).toHaveTextContent('Load');
        expect(screen.getByTestId('header-source')).toHaveTextContent('github');

        await waitFor(() => {}, { timeout: 500 });

        await waitFor(() =>
          expect(screen.getByTestId('repository-list-repos')).toBeInTheDocument()
        );
      });

      test('Open dialog -> No repositories', async () => {
        jest
          .spyOn(Github.prototype, 'getReposForAuthenticatedUser')
          .mockImplementationOnce(async () => ({ collection: [], nextPage: null }));

        await setup({
          config: {
            providers: [mock.githubAuth, mock.gitlabAuth],
            preferProvider: 'github',
          },
        });

        await waitFor(() => screen.getByTestId('header-dialog-title'));

        expect(screen.getByTestId('header-dialog-title')).toHaveTextContent('Load');
        expect(screen.getByTestId('header-source')).toHaveTextContent('github');

        await waitFor(() => expect(screen.getByTestId('list-empty')).toBeInTheDocument());
      });

      test('Open dialog -> Select shared with me', async () => {
        await setup({
          config: {
            providers: [mock.githubAuth, mock.gitlabAuth],
            preferProvider: 'github',
          },
        });

        await waitFor(() => screen.getByTestId('header-dialog-title'));

        expect(screen.getByTestId('header-dialog-title')).toHaveTextContent('Load');
        expect(screen.getByTestId('header-source')).toHaveTextContent('github');

        await act(async () =>
          userEvent.click(screen.getByTestId('sideButton-listItem-button-collaborator'))
        );

        await waitFor(() =>
          expect(screen.getByTestId('repository-list-repos')).toBeInTheDocument()
        );
      });

      test('Open dialog -> Select organization', async () => {
        await setup({
          config: {
            providers: [mock.githubAuth, mock.gitlabAuth],
            preferProvider: 'github',
          },
        });

        await waitFor(() => screen.getByTestId('header-dialog-title'));

        expect(screen.getByTestId('header-dialog-title')).toHaveTextContent('Load');
        expect(screen.getByTestId('header-source')).toHaveTextContent('github');

        await act(async () =>
          userEvent.click(screen.getByTestId('sideButton-listItem-button-organization'))
        );

        await waitFor(() =>
          expect(screen.getByTestId('repository-list-organizations')).toBeInTheDocument()
        );
      });

      test('Open dialog -> Select repository', async () => {
        await setup({
          config: {
            providers: [mock.githubAuth, mock.gitlabAuth],
            preferProvider: 'github',
          },
        });

        await waitFor(() => screen.getByTestId('header-dialog-title'));

        expect(screen.getByTestId('header-dialog-title')).toHaveTextContent('Load');
        expect(screen.getByTestId('header-source')).toHaveTextContent('github');

        await act(async () => userEvent.click(screen.getByTestId('repository-item-repo1')));

        await waitFor(() =>
          expect(screen.getByTestId('repository-list-content')).toBeInTheDocument()
        );
      });

      test('Open dialog -> Select repository -> Select folder', async () => {
        await setup({
          config: {
            providers: [mock.githubAuth, mock.gitlabAuth],
            preferProvider: 'github',
          },
        });

        await waitFor(() => screen.getByTestId('header-dialog-title'));

        expect(screen.getByTestId('header-dialog-title')).toHaveTextContent('Load');
        expect(screen.getByTestId('header-source')).toHaveTextContent('github');

        await act(async () => userEvent.click(screen.getByTestId('repository-item-repo1')));
        await act(async () => userEvent.click(screen.getByTestId('content-button-folder1')));

        await waitFor(() =>
          expect(screen.getByTestId('repository-list-content')).toBeInTheDocument()
        );
      });

      test('Open dialog -> Search content', async () => {
        await setup({
          config: {
            providers: [mock.githubAuth, mock.gitlabAuth],
            preferProvider: 'github',
          },
        });

        await waitFor(() => screen.getByTestId('header-dialog-title'));

        expect(screen.getByTestId('header-dialog-title')).toHaveTextContent('Load');
        expect(screen.getByTestId('header-source')).toHaveTextContent('github');

        await act(async () => userEvent.click(screen.getByTestId('repository-item-repo1')));

        await waitFor(() =>
          expect(screen.getByTestId('repository-list-content')).toBeInTheDocument()
        );

        const input = screen.getByTestId('search-file-input') as HTMLInputElement;

        userEvent.type(input, 'car');
        await waitFor(() => {}, { timeout: 800 });

        expect(input).toHaveValue('car');
        await waitFor(() =>
          expect(screen.getByTestId('search-global-result-collection')).toBeInTheDocument()
        );
      });

      test('Open dialog -> Search content -> view match', async () => {
        await setup({
          config: {
            providers: [mock.githubAuth, mock.gitlabAuth],
            preferProvider: 'github',
          },
        });

        await waitFor(() => screen.getByTestId('header-dialog-title'));

        expect(screen.getByTestId('header-dialog-title')).toHaveTextContent('Load');
        expect(screen.getByTestId('header-source')).toHaveTextContent('github');

        const input = screen.getByTestId('search-file-input') as HTMLInputElement;
        userEvent.type(input, 'car');
        await waitFor(() => {}, { timeout: 800 });
        expect(input).toHaveValue('car');

        await waitFor(() =>
          expect(screen.getByTestId('search-global-result-collection')).toBeInTheDocument()
        );
        userEvent.hover(screen.getByTestId('search-global-item-languages.xml'));

        await waitFor(() =>
          expect(screen.getByTestId('show-match-text-button')).toBeInTheDocument()
        );
        fireEvent.click(screen.getByTestId('show-match-text-button'));

        await waitFor(() =>
          expect(screen.getByTestId('search-content-match-blog')).toBeInTheDocument()
        );
      });

      test('Open dialog -> Search users', async () => {
        await setup({
          config: {
            providers: [mock.githubAuth, mock.gitlabAuth],
            preferProvider: 'github',
          },
        });

        await waitFor(() => screen.getByTestId('header-dialog-title'));

        expect(screen.getByTestId('header-dialog-title')).toHaveTextContent('Load');
        expect(screen.getByTestId('header-source')).toHaveTextContent('github');

        const input = screen.getByTestId('search-user-input') as HTMLInputElement;
        userEvent.type(input, 'anto');
        await waitFor(() => {}, { timeout: 800 });
        expect(input).toHaveValue('anto');

        await waitFor(() => expect(screen.getByTestId('search-user-result')).toBeInTheDocument());
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
