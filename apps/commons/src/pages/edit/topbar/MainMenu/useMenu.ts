import { loadDocument } from '@cwrc/leafwriter-storage-service/headless';
import { db } from '@src/db';
import { useLeafWriter, useMessage, useOpenResource } from '@src/hooks';
import { useActions, useAppState } from '@src/overmind';
import { listTransformations } from '@src/services/leafTe';
import { type Resource } from '@src/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import type { ItemProps, SubMenuProps } from './components';

export type ItemType = 'menuItem' | 'document';

const MIN_WIDTH = 250;

export const useMenu = () => {
  const { userState } = useAppState().auth;
  const { readonly, resource } = useAppState().editor;
  const { storageProviders } = useAppState().providers;

  const recentDocumentsCount = useLiveQuery(() => db.recentDocuments.count() ?? 0);

  const { getStorageProviderAuth } = useActions().providers;
  const { openStorageDialog } = useActions().storage;
  const { openDialog } = useActions().ui;

  const { t } = useTranslation('LWC');

  const { handleCloseDocument, handleDownload, handleSave } = useLeafWriter();
  const { openResource } = useOpenResource();

  const { cloudDisabledMessage } = useMessage();

  const mainMenuOptions: (ItemProps | 'divider' | SubMenuProps)[] = [
    {
      icon: 'template',
      label: `${t('LWC:commons.new')}...`,
      onTrigger: () => openDialog({ type: 'templates' }),
    },
    {
      icon: 'folderOpen',
      label: `${t('LWC:commons.open')}...`,
      onTrigger: () =>
        void openStorageDialog({
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
      label: `${t('LWC:commons.open_recent')}`,
      popupId: 'recent',
    },
    {
      icon: 'importIcon',
      label: t('LWC:storage.import document'),
      onTrigger: () => openDialog({ type: 'import', props: { maxWidth: 'md' } }),
    },
    'divider',
    {
      disabled:
        userState !== 'AUTHENTICATED' ||
        !storageProviders.some((provider) => provider.service?.isStorageProvider),
      hide: readonly,
      icon: 'save',
      label: t('LWC:commons.save'),
      onTrigger: () => void (!resource?.provider ? handleSave('saveAs') : handleSave()),
      shortcut: ' ⌘S',
      tooltipText: cloudDisabledMessage,
    },
    {
      disabled:
        userState !== 'AUTHENTICATED' ||
        !storageProviders.some((provider) => provider.service?.isStorageProvider),
      hide: readonly,
      icon: 'saveAs',
      label: `${t('LWC:commons.save_as')}...`,
      onTrigger: () => void handleSave('saveAs'),
      shortcut: ' ⌘⌥⇧S',
      tooltipText: cloudDisabledMessage,
    },
    {
      hide: readonly,
      icon: 'download',
      label: `${t('LWC:commons.export_document')}`,
      popupId: 'download',
    },
    'divider',
    {
      label: t('LWC:commons.close'),
      onTrigger: () => handleCloseDocument(),
      shortcut: ' ⌘W',
    },
  ];

  const getOptions = async (id?: string) => {
    if (id === 'download') return getDownloadOptions();
    if (id === 'recent') return await getRecentFiles();
    return [];
  };

  const getDownloadOptions = async () => {
    const options: ItemProps[] = [
      {
        label: `${t('LWC:commons.xml document')} (.xml)`,
        onTrigger: () => void handleDownload('xml'),
        sx: { textTransform: 'initial' },
      },
    ];

    const conversionFormats = await listTransformations({ from: 'TEI' });
    if (!conversionFormats) return options;

    const conversionOptions: ItemProps[] = conversionFormats.map((format) => ({
      label: `${format} ${t('LWC:commons.document', { format })} (.${format.toLowerCase()})`,
      onTrigger: () => handleDownload(format),
      sx: { textTransform: 'initial', '::first-letter': { textTransform: 'uppercase' } },
    }));

    options.push(...conversionOptions);

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
      onTrigger: () => handleLoadRecentDocument(document),
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
    if (document instanceof Error) return;

    if (!document.content || !document.url) {
      return;
    }

    await openResource({ resource });
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
      void openStorageDialog({ source: 'cloud', resource: undefined, type: 'load' });
      return;
    }

    if (action === 'saveAs' || action === 'save') return handleSave(action);
    if (action === 'download') return handleDownload('xml');
  };

  return {
    MIN_WIDTH,
    mainMenuOptions,
    getOptions,
    onKeydownHandle,
  };
};
