import { Dialog, DialogContent, Stack } from '@mui/material';
import { motion } from 'framer-motion';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppState } from '../../overmind';
import type { IDialog } from '../type';
import { Section } from './components';
import { Header } from './Header';
import { Authorities, Editor, Interface, Reset, MarkupPanel } from './sections';
import { SideMenu, type MenuItemProps } from './SideMenu';

export const SettingsDialog = ({ id, onClose, open }: IDialog) => {
  const { isReadonly, settings } = useAppState().editor;
  const { t } = useTranslation();

  const menuItems: MenuItemProps[] = [
    { id: 'interface', label: t('commons:interface') },
    { id: 'editor', label: t('commons:editor') },
    { id: 'authorities', label: t('commons:authorities'), hide: isReadonly },
    { id: 'markup-panel', label: t('markup panel'), hide: isReadonly },
    { id: 'reset', label: t('commons:reset'), hide: isReadonly },
  ];

  const handleClose = () => onClose(id);

  return (
    <Dialog
      aria-labelledby="settings-title"
      container={document.getElementById(`${settings?.container}`)}
      fullWidth
      maxWidth="sm"
      onClose={handleClose}
      open={open}
    >
      <Header onClose={handleClose} />
      <Stack direction="row" overflow="hidden" px={1.5}>
        <SideMenu items={menuItems} />
        <DialogContent>
          <Stack component={motion.div} layout spacing={3}>
            <Section id="interface" title={t('commons:interface')}>
              <Interface />
            </Section>
            <Section id="editor" title={t('commons:editor')}>
              <Editor />
            </Section>
            {!isReadonly && (
              <>
                <Section id="authorities" title={t('commons:authorities')}>
                  <Authorities />
                </Section>
                <Section id="markup-panel" title={t('markup panel')}>
                  <MarkupPanel />
                </Section>
                <Section id="reset" title={t('commons:reset')}>
                  <Reset />
                </Section>
              </>
            )}
          </Stack>
        </DialogContent>
      </Stack>
    </Dialog>
  );
};
