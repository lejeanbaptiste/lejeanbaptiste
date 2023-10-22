// @ts-nocheck
import { beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import '@testing-library/jest-dom';
import '@testing-library/jest-dom/jest-globals';
import { act, getByTestId, getByTitle, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React from 'react';
import StorageDialog from '../src';
import type { StorageDialogProps } from '../src/types';
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
  //@ts-ignore
  await act(async () => render(<StorageDialog open={true} {...props} />));
};

const closeLoadDialog = async () => {
  const footer = screen.getByTestId('footer-load');
  await act(async () => user.click(getByTitle(footer, 'cancel')));
};

const closeSaveDialog = async () => {
  const footer = screen.getByTestId('save:footer');
  await act(async () => user.click(getByTitle(footer, 'cancel')));
};

describe('Dialog Mobile', () => {
  describe('Load', () => {
    describe.each([
      { name: 'from [Github]', preferProvider: 'github' },
      { name: 'from [Gitlab]', preferProvider: 'gitlab' },
    ])('$name', ({ preferProvider }) => {
      test('Open dialog & navigate', async () => {
        //* ALLOWS TO RESIZE WINDOW
        const matchMediaBK = window.matchMedia;
        //@ts-ignore
        window.matchMedia = (match: string) => ({
          //@ts-ignore
          matches: true, // <-- Set according to what you want to test
          addListener: () => {},
          removeListener: () => {},
        });

        expect.assertions(6);

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

        await waitFor(() => expect(getByTestId(storageDialog, 'list-repos')).toBeInTheDocument(), {
          timeout: 500,
        });

        const repositories = getByTestId(storageDialog, 'list-repos');
        await waitFor(() => expect(repositories).toBeInTheDocument());

        const repo = getByTitle(repositories, 'repo1');
        await act(async () => user.dblClick(getByTestId(repo, 'primary-button')));

        await waitFor(() => expect(getByTestId(storageDialog, 'list-content')).toBeInTheDocument());

        //* RESTORE
        window.matchMedia = matchMediaBK;
        global.innerWidth = 1024;
        window.dispatchEvent(new Event('resize'));

        await closeLoadDialog();
      });

      describe('Side Menu', () => {
        test.todo('Navigate');
        test.todo('Search User');
      });
    });
  });

  describe('Save', () => {
    describe.each([
      { name: 'to [Github]', preferProvider: 'github' },
      { name: 'to [Gitlab]', preferProvider: 'gitlab' },
    ])('$name', ({ preferProvider }) => {
      test('Open dialog & navigate', async () => {
        //* ALLOWS TO RESIZE WINDOW
        const matchMediaBK = window.matchMedia;
        //@ts-ignore
        window.matchMedia = (match: string) => ({
          //@ts-ignore
          matches: true, // <-- Set according to what you want to test
          addListener: () => {},
          removeListener: () => {},
        });

        expect.assertions(6);

        //resize window to load mobile menu
        global.innerWidth = 500;
        window.dispatchEvent(new Event('resize'));
        expect(window.innerWidth).toBe(500);

        const resource = mock.getResource({ provider: preferProvider, type: 'save' });
        await setup({
          config: { preferProvider, providers: [mock.githubAuth, mock.gitlabAuth] },
          resource,
          source: 'cloud',
          type: 'save',
        });

        const storageDialog = screen.getByTestId('storage-dialog');
        expect(getByTestId(storageDialog, 'header-dialog-title')).toHaveTextContent('Save');
        expect(getByTestId(storageDialog, 'header-source')).toHaveTextContent(preferProvider);

        await waitFor(() => expect(getByTestId(storageDialog, 'list-repos')).toBeInTheDocument(), {
          timeout: 500,
        });

        const repositories = getByTestId(storageDialog, 'list-repos');
        await waitFor(() => expect(repositories).toBeInTheDocument());

        const repo = getByTitle(repositories, 'repo1');
        await act(async () => user.dblClick(getByTestId(repo, 'primary-button')));

        await waitFor(() => expect(getByTestId(storageDialog, 'list-content')).toBeInTheDocument());

        //* RESTORE
        window.matchMedia = matchMediaBK;
        global.innerWidth = 1024;
        window.dispatchEvent(new Event('resize'));

        await closeSaveDialog();
      });

      // describe('Side Menu', () => {
      //   test.todo('Navigate')
      //   test.todo('Search User')
      // })
    });
    test.todo('Open Dialog & navigate');
  });
});
