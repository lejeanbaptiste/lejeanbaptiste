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

        expect(screen.getByTestId('header-dialog-title')).toHaveTextContent('Load');
        expect(screen.getByTestId('header-source')).toHaveTextContent('local');
      });
    });

    describe('From Paste', () => {
      test('Open dialog, change from local to paste, and add paste content', async () => {
        await setup();

        expect(screen.getByTestId('header-dialog-title')).toHaveTextContent('Load');
        expect(screen.getByTestId('header-source')).toHaveTextContent('local');

        fireEvent.click(screen.getByTestId('source_panel-paste'));

        expect(screen.getByTestId('header-source')).toHaveTextContent('paste');

        const input = screen.getByTestId('paste_panel-input');

        fireEvent.change(input, { target: { value: '<xml>' } });
      });

      test('Open dialog: Source Paste', async () => {
        await setup({ source: 'paste' });

        expect(screen.getByTestId('header-dialog-title')).toHaveTextContent('Load');
        expect(screen.getByTestId('header-source')).toHaveTextContent('paste');

        const input = screen.getByTestId('paste_panel-input');
        fireEvent.change(input, { target: { value: '<xml>' } });
      });

      test('Open dialog: Source Paste with content', async () => {
        await setup({ resource: { content: '<xml>' } });

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

        await waitFor(() => {}, { timeout: 500 });

        expect(screen.getByTestId('header-dialog-title')).toHaveTextContent('Load');
        expect(screen.getByTestId('header-source')).toHaveTextContent('github');
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
      });
    });
  });
});
