import { Dialog, DialogContent, Stack } from '@mui/material';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAppState } from '../../overmind';
import { AddCustomAuthority } from '../custom-authority-dialog/add-custom-authority';
import type { IDialog } from '../type';
import { Section } from './components';
import { Header } from './header';
import { Authorities, Editor, EntityLookups, MarkupPanel, Reset, UI } from './sections';
import { SideMenu } from './side-menu';

export const SettingsDialog = ({ id, onClose, open = false }: IDialog) => {
  const { isReadonly, settings } = useAppState().editor;
  const { t } = useTranslation();

  const handleClose = () => onClose && onClose(id);

  return (
    <Dialog
      aria-labelledby="settings-title"
      container={document.getElementById(`${settings?.container}`)}
      fullWidth
      maxWidth="md"
      onClose={handleClose}
      open={open}
    >
      <Header onClose={handleClose} />
      <Stack direction="row" overflow="hidden" px={1.5}>
        <SideMenu
          items={[
            { id: 'interface', label: t('LW.commons.interface') },
            { id: 'editor', label: t('LW.commons.editor') },
            { id: 'authorities', label: t('LW.commons.authorities'), hide: isReadonly },
            { id: 'entityLookups', label: t('LW.commons.Entity Lookups'), hide: isReadonly },
            { id: 'markup-panel', label: t('LW.commons.markup panel'), hide: isReadonly },
            { id: 'reset', label: t('LW.commons.reset'), hide: isReadonly },
          ]}
        />
        <DialogContent>
          <Stack component={motion.div} layout spacing={3}>
            <Section id="interface" title={t('LW.commons.interface')}>
              <UI />
            </Section>
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
                <Section id="entityLookups" title={t('LW.commons.Entity Lookups')}>
                  <EntityLookups />
                </Section>
                <Section id="markup-panel" title={t('LW.commons.markup panel')}>
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
