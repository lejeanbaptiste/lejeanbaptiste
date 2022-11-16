import { loadDocument } from '@cwrc/leafwriter-storage-service';
import { usePermalink } from '@src/hooks';
import { useActions, useAppState } from '@src/overmind';
import { StorageProviderName } from '@src/services';
import { Resource } from '@src/types';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useLeafWriter } from '../../useLeafWriter';
import type { IItem } from './Item';
import type { ISubMenu } from './SubMenu';

export type ItemType = 'menuItem' | 'document';

const MIN_WIDTH = 250;

export const useMenu = () => {
  const { userState } = useAppState().auth;
  const { isDirty } = useAppState().editor;
  const { recentDocuments, resource } = useAppState().storage;

  const { getStorageProviderAuth, openStorageDialog, setResource } = useActions().storage;
  const { openDialog } = useActions().ui;

  const navigate = useNavigate();
  const { t } = useTranslation('commons');

  const { setPermalink } = usePermalink();
  const { handleCloseDocument, handleDownload, handleSave } = useLeafWriter();

  const mainMenuOptions: (IItem | 'divider' | ISubMenu)[] = [
    {
      icon: 'template',
      label: `${t('new')}...`,
      onTrigger: () => openDialog({ type: 'templates' }),
    },
    {
      icon: 'folderOpen',
      label: `${t('open')}...`,
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
      hide: !recentDocuments || recentDocuments.length === 0,
      icon: 'recent',
      popupId: 'recent',
      title: `${t('open_recent')}`,
    },
    'divider',
    {
      disabled: userState !== 'AUTHENTICATED',
      icon: 'save',
      label: t('save'),
      onTrigger: () => (!resource?.provider ? handleSave('saveAs') : handleSave()),
      shortcut: ' ⌘S',
      tootipText: `${t('messages:you_must_sign_in_to_use_this_feature')}`,
    },
    {
      disabled: userState !== 'AUTHENTICATED',
      icon: 'saveAs',
      label: `${t('save_as')}...`,
      onTrigger: () => handleSave('saveAs'),
      shortcut: ' ⌘⌥⇧S',
      tootipText: `${t('messages:you_must_sign_in_to_use_this_feature')}`,
    },
    {
      icon: 'download',
      label: t('download'),
      onTrigger: () => handleDownload(),
      shortcut: ' ⌘⇧D',
    },
    'divider',
    {
      label: t('close'),
      onTrigger: () => handleCloseDocument(),
      shortcut: ' ⌘W',
    },
  ];

  const getOptions = (trigger?: string): (IItem | 'divider' | ISubMenu)[] => {
    if (trigger === 'recent') {
      if (!recentDocuments) return [];

      const options: IItem[] = recentDocuments.map((document) => ({
        data: document,
        label: document.filename ?? '',
        onTrigger: () => {
          if (!isDirty) return handleLoadRecentDocument(document);

          openDialog({
            props: {
              maxWidth: 'xs',
              severity: 'warning',
              title: `${t('unsaved_changes')}`,
              actions: [
                { action: 'cancel', label: `${t('cancel')}` },
                { action: 'discard', label: `${t('discard_changes')}` },
              ],
              //@ts-ignore
              onClose: async (action: string) => {
                if (action === 'discard') handleLoadRecentDocument(document);
              },
            },
          });
        },
        type: 'document',
      }));
      return options;
    }
    return [];
  };

  const handleLoadRecentDocument = async (resource: Resource) => {
    if (!resource.provider) return;

    const providerAuth = getStorageProviderAuth(resource.provider as StorageProviderName);
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
