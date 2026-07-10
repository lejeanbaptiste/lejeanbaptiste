import { Dialog, DialogContent, List, Stack } from '@mui/material';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAppState } from '../../overmind';
import { AddCustomAuthority } from '../custom-authority-dialog/add-custom-authority';
import type { IDialog } from '../type';
import { Section } from './components';
import { Header } from './header';
import { Authorities, Editor, EntityLookups, MarkupPanel, Reset, UI } from './sections';
import { DesktopAiApi } from './sections/ui/desktop-ai-api';
import { SideMenu } from './side-menu';

export const SettingsDialog = ({ onClose, open = false }: IDialog) => {
  const { isReadonly, settings } = useAppState().editor;
  const { t } = useTranslation();

  const handleClose = () => onClose && onClose('close');

  const isDesktop =
    typeof window !== 'undefined' && !!(window as Window & { electronAPI?: unknown }).electronAPI;

  const dialogContainer = isDesktop
    ? undefined
    : (document.getElementById(`${settings?.container}`) ?? undefined);

  return (
    <Dialog
      aria-labelledby="settings-title"
      container={dialogContainer}
      fullWidth
      maxWidth={isDesktop ? 'lg' : 'md'}
      onClose={handleClose}
      open={open}
        PaperProps={{
          sx: {
            borderRadius: 3.5,
            border: 'none',
            outline: 'none',
            overflow: 'hidden',
            m: 1,
            bgcolor: 'background.paper',
            boxShadow: (theme) => theme.shadows[10],
          },
        }}
    >
      <Header onClose={handleClose} />
      <Stack direction="row" overflow="hidden" px={0.75} pb={0.75}>
        <SideMenu
          items={[
            { id: 'interface', label: t('LW.commons.interface') },
            { id: 'ai-api', label: t('LW.settings.ai_api.title'), hide: !isDesktop },
            { id: 'editor', label: t('LW.commons.editor') },
            { id: 'authorities', label: t('LW.commons.authorities'), hide: isReadonly },
            { id: 'entityLookups', label: t('LW.commons.entity_types'), hide: isReadonly },
            { id: 'markup-panel', label: t('LW.settings.markupPanel.title'), hide: isReadonly },
            { id: 'reset', label: t('LW.commons.reset'), hide: isReadonly },
          ]}
        />
        <DialogContent sx={{ pt: 0.25, px: 1, pb: 1, minWidth: 0 }}>
          <Stack component={motion.div} layout spacing={1.75}>
            <Section id="interface" title={t('LW.commons.interface')}>
              <UI />
            </Section>
            {isDesktop && (
              <Section id="ai-api" title={t('LW.settings.ai_api.title')}>
                <List dense>
                  <DesktopAiApi />
                </List>
              </Section>
            )}
            <Section id="editor" title={t('LW.commons.editor')}>
              <Editor />
            </Section>
            {!isReadonly && (
              <>
                <Section
                  endDecorator={<AddCustomAuthority />}
                  id="authorities"
                  title={t('LW.commons.authorities')}
                >
                  <Authorities />
                </Section>
                <Section id="entityLookups" title={t('LW.commons.entity_types')}>
                  <EntityLookups />
                </Section>
                <Section id="markup-panel" title={t('LW.settings.markupPanel.title')}>
                  <MarkupPanel />
                </Section>
                <Section id="reset" title={t('LW.commons.reset')}>
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
