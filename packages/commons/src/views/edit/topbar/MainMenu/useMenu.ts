import { loadDocument } from '@cwrc/leafwriter-storage-service';
import { db } from '@src/db';
import { useMessage, usePermalink } from '@src/hooks';
import { useActions, useAppState } from '@src/overmind';
import { type Resource } from '@src/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useLeafWriter } from '../../useLeafWriter';
import type { ItemProps, SubMenuProps } from './components';

export type ItemType = 'menuItem' | 'document';

const MIN_WIDTH = 250;

export const useMenu = () => {
  const { userState } = useAppState().auth;
  const { contentHasChanged, readonly, resource } = useAppState().editor;
  const { storageProviders } = useAppState().providers;

  const recentDocumentsCount = useLiveQuery(() => db.recentDocuments.count() ?? 0);

  const { setResource } = useActions().editor;
  const { getStorageProviderAuth } = useActions().providers;
  const { openStorageDialog } = useActions().storage;
  const { openDialog } = useActions().ui;

  const navigate = useNavigate();
  const { t } = useTranslation('LWC');

  const { setPermalink } = usePermalink();
  const { handleCloseDocument, handleDownload, handleExportToHTML, handleSave } = useLeafWriter();

  const { cloudDisabledMessage } = useMessage();

  const mainMenuOptions: (ItemProps | 'divider' | SubMenuProps)[] = [
    {
      icon: 'template',
      label: `${t('commons.new')}...`,
      onTrigger: () => openDialog({ type: 'templates' }),
    },
    {
      icon: 'folderOpen',
      label: `${t('commons.open')}...`,
      onTrigger: () =>
        openStorageDialog({
          source: userState === 'AUTHENTICATED' ? 'cloud' : 'local',
          resource: undefined,
          type: 'load',
        }),
      shortcut: ' ⌘O',
    },
    {
      disabled: userState !== 'AUTHENTICATED',
      hide: recentDocumentsCount === 0,
      icon: 'recent',
      label: `${t('commons.open_recent')}`,
      popupId: 'recent',
    },
    'divider',
    {
      disabled:
        userState !== 'AUTHENTICATED' ||
        !storageProviders.some((provider) => provider.service?.isStorageProvider),
      hide: readonly,
      icon: 'save',
      label: t('commons.save'),
      onTrigger: () => (!resource?.provider ? handleSave('saveAs') : handleSave()),
      shortcut: ' ⌘S',
      tooltipText: cloudDisabledMessage,
    },
    {
      disabled:
        userState !== 'AUTHENTICATED' ||
        !storageProviders.some((provider) => provider.service?.isStorageProvider),
      hide: readonly,
      icon: 'saveAs',
      label: `${t('commons.save_as')}...`,
      onTrigger: () => handleSave('saveAs'),
      shortcut: ' ⌘⌥⇧S',
      tooltipText: cloudDisabledMessage,
    },
    {
      hide: readonly,
      icon: 'download',
      label: `${t('commons.download')}`,
      popupId: 'download',
    },
    'divider',
    {
      label: t('commons.close'),
      onTrigger: () => handleCloseDocument(),
      shortcut: ' ⌘W',
    },
  ];

  const getOptions = async (id?: string) => {
    if (id === 'download') return getDownloadOptions();
    if (id === 'recent') return await getRecentFiles();
    return [];
  };

  const getDownloadOptions = () => {
    const options: ItemProps[] = [
      {
        label: `${t('commons.xml document')} (.xml)`,
        onTrigger: () => handleDownload(),
        sx: { textTransform: 'initial' },
      },
      {
        label: t('commons.export_as_HTML'),
        onTrigger: () => handleExportToHTML(),
      },
    ];

    return options;
  };

  const getRecentFiles = async () => {
    const recentDocuments = await db.recentDocuments
      .toCollection()
      .reverse()
      .limit(10)
      .sortBy('modifiedAt');

    const recent: ItemProps<Resource>[] = recentDocuments.map((document) => ({
      data: document,
      label: document.filename ?? '',
      onTrigger: () => {
        if (!contentHasChanged) return handleLoadRecentDocument(document);
        openDialog({
          props: {
            maxWidth: 'xs',
            severity: 'warning',
            title: `${t('commons.unsaved_changes')}`,
            actions: [
              { action: 'cancel', label: `${t('commons.cancel')}` },
              { action: 'discard', label: `${t('commons.discard_changes')}` },
            ],
            onClose: async (action) => {
              if (action === 'discard') handleLoadRecentDocument(document);
            },
          },
        });
      },
      sx: { textTransform: 'initial' },
      type: 'document',
    }));

    return recent;
  };

  const handleLoadRecentDocument = async (resource: Resource) => {
    if (!resource.provider) return;

    const providerAuth = getStorageProviderAuth(resource.provider);
    if (!providerAuth) return;

    const document = await loadDocument(providerAuth, resource);
    if (!document || 'error' in document || !document.content || !document.url) {
      return;
    }

    setResource(document);
    const permalink = setPermalink(document);
    navigate(`/edit${permalink}`, { replace: true });
  };

  const onKeydownHandle = async (event: KeyboardEvent) => {
    if (!event.metaKey) return;

    let action: 'save' | 'saveAs' | 'load' | 'download' | '' = '';

    if (event.code === 'KeyS') action = 'save';
    if (event.shiftKey && event.altKey && event.code === 'KeyS') action = 'saveAs';
    if (event.shiftKey && event.code === 'KeyD') action = 'download';
    if (event.code === 'KeyO') action = 'load';

    if (action === '') return;

    event.preventDefault();
    event.stopPropagation();

    if (action === 'load') {
      openStorageDialog({ source: 'cloud', resource: undefined, type: 'load' });
      return;
    }

    if (action === 'saveAs' || action === 'save') return handleSave(action);
    if (action === 'download') return handleDownload();
  };

  return {
    MIN_WIDTH,
    mainMenuOptions,
    getOptions,
    onKeydownHandle,
  };
};
