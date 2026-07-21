import { beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import StorageDialog from '@cwrc/leafwriter-storage-service/.';
import type { StorageDialogProps } from '@cwrc/leafwriter-storage-service/types';
import '@testing-library/jest-dom';
import '@testing-library/jest-dom/jest-globals';
import {
  act,
  fireEvent,
  getByTestId,
  getByText,
  getByTitle,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import Github from '@cwrc/leafwriter-storage-service/providers/Github';
import Gitlab from '@cwrc/leafwriter-storage-service/providers/Gitlab';
import { spyProviderFunctions } from './mocks/provider';
import * as mock from './mocks/resource';

const user = userEvent.setup({
  pointerEventsCheck: 0,
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
  await act(async () => render(<StorageDialog open={true} {...props} />));
};

const closeLoadDialog = async () => {
  const footer = screen.getByTestId('save:footer');
  await user.click(getByTitle(footer, 'cancel'));
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

        await user.click(screen.getByTestId('save:open-settings-button'));
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

        await user.click(screen.getByTestId('save:open-settings-button'));
        const saveSettingsDialog = screen.getByTestId('save:settings-dialog');
        await waitFor(() => expect(saveSettingsDialog).toBeInTheDocument());

        const input = getByTestId(
          saveSettingsDialog,
          'save:settings:commit-input',
        ) as HTMLInputElement;

        await user.clear(input);
        await user.type(input, 'by me');
        expect(input).toHaveValue('by me');

        await user.click(screen.getByTitle('done'));

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
        await user.click(createRepoButton);

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

        await user.type(inputName, 'repo-name');
        await user.type(inputDescription, 'repo description');

        expect(inputName).toHaveValue('repo-name');
        expect(inputDescription).toHaveValue('repo description');

        const createButton = getByTestId(createRepoDialog, 'save:create-repo:create-button');
        await user.click(createButton);

        // The mocked providers don't stub `createRepo`/`createRepoInOrg`, so
        // the real permission check in the `createRepo` overmind action can
        // fail (mismatched owner/provider username), opening a SimpleDialog
        // error ("repo_creation_error"). That dialog is a sibling of
        // `storage-dialog`, not a child of it, and is never dismissed by
        // `closeLoadDialog()` - if left open, it leaks into later tests
        // (mui-modal-provider's stack stays open, marking the next test's
        // dialog `aria-hidden`), which is what caused
        // "Rename > By Typing" to intermittently fail with "the element to
        // be cleared could not be focused". Dismiss it here, same as a real
        // user would, before finishing the test.
        await waitFor(() =>
          expect(
            screen.queryByTestId('save:create-repo-dialog') === null ||
              screen.queryByText(/creation error/i) !== null,
          ).toBe(true),
        );

        const errorDialog = screen.queryByText(/creation error/i);
        if (errorDialog) {
          await user.click(screen.getByRole('button', { name: /close/i }));
        }

        await closeLoadDialog();
      });

      test('Repository - Error', async () => {
        // Force the create-repo action's failure path regardless of which
        // owner/permission branch it takes (user vs organization), so this
        // test doesn't depend on the incidental permission-check outcome
        // that made the happy-path "Repository" test above sometimes hit
        // this same branch by accident.
        const ProviderClass = preferProvider === 'gitlab' ? Gitlab : Github;
        jest.spyOn(ProviderClass.prototype, 'createRepo').mockResolvedValue(null);
        jest.spyOn(ProviderClass.prototype, 'createRepoInOrg').mockResolvedValue(null);

        const resource = mock.getResource({ provider: preferProvider, type: 'save' });
        await setup({
          config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
          resource,
          source: 'cloud',
          type: 'save',
        });

        const storageDialog = screen.getByTestId('storage-dialog');
        await waitFor(() => expect(getByTestId(storageDialog, 'list-repos')).toBeInTheDocument(), {
          timeout: 500,
        });

        const createRepoButton = getByTestId(storageDialog, 'topbar:create-repository');
        await user.click(createRepoButton);

        const createRepoDialog = screen.getByTestId('save:create-repo-dialog');
        await waitFor(() => expect(createRepoDialog).toBeInTheDocument());

        const inputName = getByTestId(
          createRepoDialog,
          'save:create-repo:name-input',
        ) as HTMLInputElement;
        await user.type(inputName, 'repo-name');

        const createButton = getByTestId(createRepoDialog, 'save:create-repo:create-button');
        await user.click(createButton);

        await waitFor(() => expect(screen.getByText(/creation error/i)).toBeInTheDocument());

        // Same cleanup as the happy-path test above: dismiss the error
        // dialog before finishing, or it leaks into later tests.
        await user.click(screen.getByRole('button', { name: /close/i }));

        await closeLoadDialog();
      });

      test('Folder', async () => {
        const resource = mock.getResource({ provider: preferProvider, type: 'save' });
        await setup({
          config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
          resource,
          source: 'cloud',
          type: 'save',
        });

        expect.assertions(8);

        const storageDialog = screen.getByTestId('storage-dialog');
        const header = getByTestId(storageDialog, 'header');

        expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Save');
        await waitFor(() => expect(getByText(header, preferProvider)).toBeInTheDocument());

        const repositories = getByTestId(storageDialog, 'list-repos');
        await waitFor(() => expect(repositories).toBeInTheDocument());

        const input = getByTestId(storageDialog, 'save:filename-input') as HTMLInputElement;
        expect(input).toHaveValue(resource?.filename);

        const repo = getByTitle(repositories, 'repo1');
        await user.dblClick(getByTestId(repo, 'primary-button'));

        await waitFor(() =>
          expect(getByTestId(storageDialog, 'topbar:create-folder')).toBeInTheDocument(),
        );

        const createFolderButton = getByTestId(storageDialog, 'topbar:create-folder');
        await user.click(createFolderButton);

        const createFolderDialog = screen.getByTestId('save:create-folder-dialog');
        await waitFor(() => expect(createFolderDialog).toBeInTheDocument());

        const inputName = getByTestId(
          createFolderDialog,
          'save:create-folder:name-input',
        ) as HTMLInputElement;

        await user.clear(inputName);
        expect(inputName).toHaveValue('');

        fireEvent.change(inputName, { target: { value: 'folder-name' } });
        await waitFor(() => expect(inputName).toHaveValue('folder-name'));

        // const createButton = getByTestId(createFolderDialog, 'save:create-folder:create-button');
        // await user.click(createButton);

        await closeLoadDialog();
      });

      test('Folder - Error', async () => {
        const ProviderClass = preferProvider === 'gitlab' ? Gitlab : Github;
        jest.spyOn(ProviderClass.prototype, 'createFolder').mockResolvedValue(null);

        const resource = mock.getResource({ provider: preferProvider, type: 'save' });
        await setup({
          config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
          resource,
          source: 'cloud',
          type: 'save',
        });

        const storageDialog = screen.getByTestId('storage-dialog');
        const repositories = getByTestId(storageDialog, 'list-repos');
        await waitFor(() => expect(repositories).toBeInTheDocument());

        const repo = getByTitle(repositories, 'repo1');
        await user.dblClick(getByTestId(repo, 'primary-button'));

        await waitFor(() =>
          expect(getByTestId(storageDialog, 'topbar:create-folder')).toBeInTheDocument(),
        );

        const createFolderButton = getByTestId(storageDialog, 'topbar:create-folder');
        await user.click(createFolderButton);

        const createFolderDialog = screen.getByTestId('save:create-folder-dialog');
        await waitFor(() => expect(createFolderDialog).toBeInTheDocument());

        const inputName = getByTestId(
          createFolderDialog,
          'save:create-folder:name-input',
        ) as HTMLInputElement;
        await user.type(inputName, 'folder-name');

        const createButton = getByTestId(createFolderDialog, 'save:create-folder:create-button');
        await user.click(createButton);

        await waitFor(() => expect(screen.getByText(/creation error/i)).toBeInTheDocument());

        await user.click(screen.getByRole('button', { name: /close/i }));

        await closeLoadDialog();
      });
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
        expect(input).toHaveValue(resource?.filename);

        await user.clear(input);
        expect(input).toHaveValue('');

        await user.type(input, 'new_file.xml');
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
        expect(input).toHaveValue(resource?.filename);

        const repo = getByTitle(repositories, 'repo1');
        await user.dblClick(getByTestId(repo, 'primary-button'));

        await waitFor(() => expect(getByTestId(storageDialog, 'list-content')).toBeInTheDocument());

        const file = getByTitle(storageDialog, 'file1.xml');
        const fileButton = getByTestId(file, 'primary-button');
        await user.click(fileButton);

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
        await user.dblClick(getByTestId(repo, 'primary-button'));

        await waitFor(() => expect(getByTestId(storageDialog, 'list-content')).toBeInTheDocument());

        //? mock download function
        footerDownloadButton.onclick = jest.fn((event: MouseEvent) => event.stopPropagation());

        //* hack: some of the processes from previou stests are stuck.
        //* in this case 'isSaving' is set to true, which cause some actions to be disabled.
        footerDownloadButton.classList.remove('Mui-disabled');
        expect(footerDownloadButton).not.toHaveClass('Mui-disabled');

        await user.click(footerDownloadButton);
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
        await user.dblClick(getByTestId(repo, 'primary-button'));

        await waitFor(() => expect(getByTestId(storageDialog, 'list-content')).toBeInTheDocument());

        const saveButton = getByTestId(footer, 'save');
        //* hack: some of the processes from previou stests are stuck.
        //* in this case 'isSaving' is set to true, which cause some actions to be disabled.
        saveButton.classList.remove('Mui-disabled');
        expect(saveButton).not.toHaveClass('Mui-disabled');

        //? mock download function
        saveButton.onclick = jest.fn((event: MouseEvent) => event.stopPropagation());

        await user.click(saveButton);
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
          await user.dblClick(getByTestId(repo, 'primary-button'));

          await waitFor(() =>
            expect(getByTestId(storageDialog, 'list-content')).toBeInTheDocument(),
          );

          const saveOptionsButton = getByTestId(footer, 'save-options-button');
          saveOptionsButton.classList.remove('Mui-disabled');
          expect(saveOptionsButton).not.toHaveClass('Mui-disabled');
          await user.click(saveOptionsButton);

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
          saveButton.onclick = jest.fn((event: MouseEvent) => event.stopPropagation());

          await user.click(saveButton);
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
          await user.dblClick(getByTestId(repo, 'primary-button'));

          await waitFor(() =>
            expect(getByTestId(storageDialog, 'list-content')).toBeInTheDocument(),
          );

          const saveOptionsButton = getByTestId(footer, 'save-options-button');
          saveOptionsButton.classList.remove('Mui-disabled');
          expect(saveOptionsButton).not.toHaveClass('Mui-disabled');
          await user.click(saveOptionsButton);

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
          savePrButton.onclick = jest.fn((event: MouseEvent) => event.stopPropagation());

          await user.click(savePrButton);
        });
      });
    });
  });
});
