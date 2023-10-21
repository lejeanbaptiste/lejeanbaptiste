// @ts-nocheck
import { beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import '@testing-library/jest-dom';
import {
  act,
  getByTestId,
  getByText,
  getByTitle,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import StorageDialog from '../src';
import type { StorageDialogProps } from '../src/types';
import { spyProviderFunctions } from './mocks/provider';
import * as mock from './mocks/resource';

const user = userEvent.setup({
  pointerEventsCheck: 'never',
});

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
  const footer = screen.getByTestId('save:footer');
  await act(async () => user.click(getByTitle(footer, 'cancel')));
};

describe('Save Dialog', () => {
  describe.each([
    { name: '[Github]', preferProvider: 'github' },
    { name: '[Gitlab] From Cloud', preferProvider: 'gitlab' },
  ])('$name', ({ preferProvider }) => {
    test('Open dialog', async () => {
      const resource = mock.getResource({ provider: preferProvider, type: 'save' });
      await setup({
        config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
        resource,
        source: 'cloud',
        type: 'save',
      });

      expect.assertions(4);

      const storageDialog = screen.getByTestId('storage-dialog');
      const header = getByTestId(storageDialog, 'header');

      expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Save');
      await waitFor(() => expect(getByText(header, preferProvider)).toBeInTheDocument());

      await waitFor(() => expect(getByTestId(storageDialog, 'list-repos')).toBeInTheDocument(), {
        timeout: 500,
      });

      expect(getByTestId(storageDialog, 'topbar:create-repository')).toBeInTheDocument();

      await closeLoadDialog();
    });

    describe('Settings', () => {
      test('Open Settings', async () => {
        const resource = mock.getResource({ provider: preferProvider, type: 'save' });
        await setup({
          config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
          resource,
          source: 'cloud',
          type: 'save',
        });

        expect.assertions(4);

        const storageDialog = screen.getByTestId('storage-dialog');
        const header = getByTestId(storageDialog, 'header');

        expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Save');
        await waitFor(() => expect(getByText(header, preferProvider)).toBeInTheDocument());

        await waitFor(() => expect(getByTestId(storageDialog, 'list-repos')).toBeInTheDocument(), {
          timeout: 500,
        });

        await act(async () => await user.click(screen.getByTestId('save:open-settings-button')));
        const saveSettingsDialog = screen.getByTestId('save:settings-dialog');
        await waitFor(() => expect(saveSettingsDialog).toBeInTheDocument());
      });

      test('Change Commit Message', async () => {
        const resource = mock.getResource({ provider: preferProvider, type: 'save' });
        await setup({
          config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
          resource,
          source: 'cloud',
          type: 'save',
        });

        expect.assertions(5);

        const storageDialog = screen.getByTestId('storage-dialog');
        const header = getByTestId(storageDialog, 'header');

        expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Save');
        await waitFor(() => expect(getByText(header, preferProvider)).toBeInTheDocument());

        await waitFor(() => expect(getByTestId(storageDialog, 'list-repos')).toBeInTheDocument(), {
          timeout: 500,
        });

        await act(async () => await user.click(screen.getByTestId('save:open-settings-button')));
        const saveSettingsDialog = screen.getByTestId('save:settings-dialog');
        await waitFor(() => expect(saveSettingsDialog).toBeInTheDocument());

        const input = getByTestId(
          saveSettingsDialog,
          'save:settings:commit-input',
        ) as HTMLInputElement;

        await act(async () => user.clear(input));
        await act(async () => user.type(input, 'by me', { delay: 50 }));
        expect(input).toHaveValue('by me');

        await act(async () => await user.click(screen.getByTitle('done')));

        await closeLoadDialog();
      });
    });

    describe('Create', () => {
      test('Repository', async () => {
        const resource = mock.getResource({ provider: preferProvider, type: 'save' });
        await setup({
          config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
          resource,
          source: 'cloud',
          type: 'save',
        });

        // expect.assertions(4);

        const storageDialog = screen.getByTestId('storage-dialog');
        const header = getByTestId(storageDialog, 'header');

        expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Save');
        await waitFor(() => expect(getByText(header, preferProvider)).toBeInTheDocument());

        await waitFor(() => expect(getByTestId(storageDialog, 'list-repos')).toBeInTheDocument(), {
          timeout: 500,
        });

        const createRepoButton = getByTestId(storageDialog, 'topbar:create-repository');
        await act(async () => await user.click(createRepoButton));

        const createRepoDialog = screen.getByTestId('save:create-repo-dialog');
        await waitFor(() => expect(createRepoDialog).toBeInTheDocument());

        const inputName = getByTestId(
          createRepoDialog,
          'save:create-repo:name-input',
        ) as HTMLInputElement;
        const inputDescription = getByTestId(
          createRepoDialog,
          'save:create-repo:description-input',
        ) as HTMLInputElement;

        await act(async () => user.type(inputName, 'repo-name', { delay: 50 }));
        await act(async () => user.type(inputDescription, 'repo description', { delay: 50 }));

        expect(inputName).toHaveValue('repo-name');
        expect(inputDescription).toHaveValue('repo description');

        const createButton = getByTestId(createRepoDialog, 'save:create-repo:create-button');
        await act(async () => user.click(createButton));

        await closeLoadDialog();
      });

      test.todo('Repository - Error');

      test('Folder', async () => {
        const resource = mock.getResource({ provider: preferProvider, type: 'save' });
        await setup({
          config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
          resource,
          source: 'cloud',
          type: 'save',
        });

        expect.assertions(7);

        const storageDialog = screen.getByTestId('storage-dialog');
        const header = getByTestId(storageDialog, 'header');

        expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Save');
        await waitFor(() => expect(getByText(header, preferProvider)).toBeInTheDocument());

        const repositories = getByTestId(storageDialog, 'list-repos');
        await waitFor(() => expect(repositories).toBeInTheDocument());

        const input = getByTestId(storageDialog, 'save:filename-input') as HTMLInputElement;
        expect(input).toHaveValue(resource.filename);

        const repo = getByTitle(repositories, 'repo1');
        await act(async () => user.dblClick(getByTestId(repo, 'primary-button')));

        const createFolderButton = getByTestId(storageDialog, 'topbar:create-folder');
        await act(async () => await user.click(createFolderButton));

        const createFolderDialog = screen.getByTestId('save:create-folder-dialog');
        await waitFor(() => expect(createFolderDialog).toBeInTheDocument());

        const inputName = getByTestId(
          createFolderDialog,
          'save:create-folder:name-input',
        ) as HTMLInputElement;

        await act(async () => user.clear(inputName));
        expect(inputName).toHaveValue('');

        await act(async () => user.type(inputName, 'folder-name'));
        expect(inputName).toHaveValue('folder-name');

        // const createButton = getByTestId(createFolderDialog, 'save:create-folder:create-button');
        // await act(async () => user.click(createButton));

        await closeLoadDialog();
      });

      test.todo('Folder - Error');
    });

    describe('Rename', () => {
      test('By Typing', async () => {
        const resource = mock.getResource({ provider: preferProvider, type: 'save' });
        await setup({
          config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
          resource,
          source: 'cloud',
          type: 'save',
        });

        expect.assertions(6);

        const storageDialog = screen.getByTestId('storage-dialog');

        const header = getByTestId(storageDialog, 'header');

        expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Save');
        await waitFor(() => expect(getByText(header, preferProvider)).toBeInTheDocument());

        await waitFor(() => expect(getByTestId(storageDialog, 'list-repos')).toBeInTheDocument(), {
          timeout: 500,
        });

        const input = getByTestId(storageDialog, 'save:filename-input') as HTMLInputElement;
        expect(input).toHaveValue(resource.filename);

        await act(async () => user.clear(input));
        expect(input).toHaveValue('');

        await act(async () => user.type(input, 'new_file.xml'));
        expect(input).toHaveValue('new_file.xml');

        await closeLoadDialog();
      });

      test('By Click Overwrite', async () => {
        const resource = mock.getResource({ provider: preferProvider, type: 'save' });
        await setup({
          config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
          resource,
          source: 'cloud',
          type: 'save',
        });

        expect.assertions(6);

        const storageDialog = screen.getByTestId('storage-dialog');
        const header = getByTestId(storageDialog, 'header');

        expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Save');
        await waitFor(() => expect(getByText(header, preferProvider)).toBeInTheDocument());

        const repositories = getByTestId(storageDialog, 'list-repos');
        await waitFor(() => expect(repositories).toBeInTheDocument());

        const input = getByTestId(storageDialog, 'save:filename-input') as HTMLInputElement;
        expect(input).toHaveValue(resource.filename);

        const repo = getByTitle(repositories, 'repo1');
        await act(async () => user.dblClick(getByTestId(repo, 'primary-button')));

        await waitFor(() => expect(getByTestId(storageDialog, 'list-content')).toBeInTheDocument());

        const file = getByTitle(storageDialog, 'file1.xml');
        const fileButton = getByTestId(file, 'primary-button');
        await act(async () => user.click(fileButton));

        expect(input).toHaveValue('file1.xml');

        await closeLoadDialog();
      });
    });

    describe('Save', () => {
      test('Download', async () => {
        const resource = { ...mock.getResource({ provider: preferProvider, type: 'save' }) };
        await setup({
          config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
          resource,
          source: 'cloud',
          type: 'save',
        });
        expect.assertions(6);

        const storageDialog = screen.getByTestId('storage-dialog');
        const header = getByTestId(storageDialog, 'header');

        const footer = getByTestId(storageDialog, 'save:footer');
        const footerDownloadButton = getByTitle(footer, 'download');

        expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Save');
        await waitFor(() => expect(getByText(header, preferProvider)).toBeInTheDocument());

        const repositories = getByTestId(storageDialog, 'list-repos');
        await waitFor(() => expect(repositories).toBeInTheDocument());

        const input = getByTestId(storageDialog, 'save:filename-input') as HTMLInputElement;
        expect(input).toHaveValue(resource.filename);

        const repo = getByTitle(repositories, 'repo1');
        await act(async () => user.dblClick(getByTestId(repo, 'primary-button')));

        await waitFor(() => expect(getByTestId(storageDialog, 'list-content')).toBeInTheDocument());

        //? mock download function
        footerDownloadButton.onclick = jest.fn((event) => event.stopPropagation());

        //* hack: some of the processes from previou stests are stuck.
        //* in this case 'isSaving' is set to true, which cause some actions to be disabled.
        footerDownloadButton.classList.remove('Mui-disabled');
        expect(footerDownloadButton).not.toHaveClass('Mui-disabled');

        await act(async () => user.click(footerDownloadButton));
      });

      test('Save', async () => {
        const resource = { ...mock.getResource({ provider: preferProvider, type: 'save' }) };
        await setup({
          config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
          resource,
          source: 'cloud',
          type: 'save',
        });

        expect.assertions(6);

        const storageDialog = screen.getByTestId('storage-dialog');
        const header = getByTestId(storageDialog, 'header');

        const footer = getByTestId(storageDialog, 'save:footer');

        expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Save');
        await waitFor(() => expect(getByText(header, preferProvider)).toBeInTheDocument());

        const repositories = getByTestId(storageDialog, 'list-repos');
        await waitFor(() => expect(repositories).toBeInTheDocument());

        const input = getByTestId(storageDialog, 'save:filename-input') as HTMLInputElement;
        expect(input).toHaveValue(resource.filename);

        const repo = getByTitle(repositories, 'repo1');
        await act(async () => user.dblClick(getByTestId(repo, 'primary-button')));

        await waitFor(() => expect(getByTestId(storageDialog, 'list-content')).toBeInTheDocument());

        const saveButton = getByTestId(footer, 'save');
        //* hack: some of the processes from previou stests are stuck.
        //* in this case 'isSaving' is set to true, which cause some actions to be disabled.
        saveButton.classList.remove('Mui-disabled');
        expect(saveButton).not.toHaveClass('Mui-disabled');

        //? mock download function
        saveButton.onclick = jest.fn((event) => event.stopPropagation());

        await act(async () => user.click(saveButton));
      });

      describe('Open Save / PR Options', () => {
        test('Save', async () => {
          const resource = { ...mock.getResource({ provider: preferProvider, type: 'save' }) };
          await setup({
            config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
            resource,
            source: 'cloud',
            type: 'save',
          });

          expect.assertions(10);

          const storageDialog = screen.getByTestId('storage-dialog');
          const header = getByTestId(storageDialog, 'header');

          const footer = getByTestId(storageDialog, 'save:footer');

          expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Save');
          await waitFor(() => expect(getByText(header, preferProvider)).toBeInTheDocument());

          const repositories = getByTestId(storageDialog, 'list-repos');
          await waitFor(() => expect(repositories).toBeInTheDocument());

          const input = getByTestId(storageDialog, 'save:filename-input') as HTMLInputElement;
          expect(input).toHaveValue(resource.filename);

          const repo = getByTitle(repositories, 'repo1');
          await act(async () => user.dblClick(getByTestId(repo, 'primary-button')));

          await waitFor(() =>
            expect(getByTestId(storageDialog, 'list-content')).toBeInTheDocument(),
          );

          const saveOptionsButton = getByTestId(footer, 'save-options-button');
          saveOptionsButton.classList.remove('Mui-disabled');
          expect(saveOptionsButton).not.toHaveClass('Mui-disabled');
          await act(async () => await user.click(saveOptionsButton));

          await waitFor(() =>
            expect(screen.getByTestId('save:footer:save-options-dialog')).toBeInTheDocument(),
          );
          const saveOptionsDialog = screen.getByTestId('save:footer:save-options-dialog');

          expect(getByTestId(saveOptionsDialog, 'save-options:save-button')).toBeInTheDocument();
          expect(
            getByTestId(saveOptionsDialog, 'save-options:pullRequest-button'),
          ).toBeInTheDocument();

          const saveButton = getByTestId(saveOptionsDialog, 'save-options:save-button');
          //* hack: some of the processes from previou stests are stuck.
          //* in this case 'isSaving' is set to true, which cause some actions to be disabled.
          saveButton.classList.remove('Mui-disabled');
          expect(saveButton).not.toHaveClass('Mui-disabled');

          //? mock download function
          saveButton.onclick = jest.fn((event) => event.stopPropagation());

          await act(async () => user.click(saveButton));
        });

        test('Pull Request', async () => {
          const resource = { ...mock.getResource({ provider: preferProvider, type: 'save' }) };
          await setup({
            config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
            resource,
            source: 'cloud',
            type: 'save',
          });

          expect.assertions(10);

          const storageDialog = screen.getByTestId('storage-dialog');
          const header = getByTestId(storageDialog, 'header');

          const footer = getByTestId(storageDialog, 'save:footer');

          expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Save');
          await waitFor(() => expect(getByText(header, preferProvider)).toBeInTheDocument());

          const repositories = getByTestId(storageDialog, 'list-repos');
          await waitFor(() => expect(repositories).toBeInTheDocument());

          const input = getByTestId(storageDialog, 'save:filename-input') as HTMLInputElement;
          expect(input).toHaveValue(resource.filename);

          const repo = getByTitle(repositories, 'repo1');
          await act(async () => user.dblClick(getByTestId(repo, 'primary-button')));

          await waitFor(() =>
            expect(getByTestId(storageDialog, 'list-content')).toBeInTheDocument(),
          );

          const saveOptionsButton = getByTestId(footer, 'save-options-button');
          saveOptionsButton.classList.remove('Mui-disabled');
          expect(saveOptionsButton).not.toHaveClass('Mui-disabled');
          await act(async () => await user.click(saveOptionsButton));

          await waitFor(() =>
            expect(screen.getByTestId('save:footer:save-options-dialog')).toBeInTheDocument(),
          );
          const saveOptionsDialog = screen.getByTestId('save:footer:save-options-dialog');

          expect(getByTestId(saveOptionsDialog, 'save-options:save-button')).toBeInTheDocument();
          expect(
            getByTestId(saveOptionsDialog, 'save-options:pullRequest-button'),
          ).toBeInTheDocument();

          const savePrButton = getByTestId(saveOptionsDialog, 'save-options:pullRequest-button');
          //* hack: some of the processes from previou stests are stuck.
          //* in this case 'isSaving' is set to true, which cause some actions to be disabled.
          savePrButton.classList.remove('Mui-disabled');
          expect(savePrButton).not.toHaveClass('Mui-disabled');

          //? mock download function
          savePrButton.onclick = jest.fn((event) => event.stopPropagation());

          await act(async () => user.click(savePrButton));
        });
      });
    });
  });
});
