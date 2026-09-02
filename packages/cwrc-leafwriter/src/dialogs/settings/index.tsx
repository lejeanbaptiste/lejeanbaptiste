import { Alert, Dialog, DialogContent, List, Stack } from '@mui/material';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../overmind';
import { AddCustomAuthority } from '../custom-authority-dialog/add-custom-authority';
import { Section } from './components';
import { Header } from './header';
import { Authorities, EntityLookups, Guardrails, MarkupPanel, Reset } from './sections';
import { Toggler } from './components/toggler';
import { DesktopOfflineAuthorities } from './sections/authorities/desktop-offline-authorities';
import { DesktopMapTilesSettings } from './sections/authorities/desktop-maptiles-settings';
import { MatchAcrossLineBreaks } from './sections/authorities/match-across-line-breaks';
import { ShowPackStringCounts } from './sections/authorities/show-pack-string-counts';
import { FontFamily } from './sections/editor/font-family';
import { FontSize } from './sections/editor/font-size';
import { DesktopEncoderName } from './sections/profile/desktop-encoder-name';
import { DesktopEntityDatabase } from './sections/profile/desktop-entity-database';
import { DesktopEntityBackup } from './sections/profile/desktop-entity-backup';
import { DesktopEntitySync } from './sections/profile/desktop-entity-sync';
import { DesktopAiApi } from './sections/ui/desktop-ai-api';
import { DesktopLanguageTool } from './sections/ui/desktop-language-tool';
import { DesktopGithub } from './sections/ui/desktop-github';
import { DesktopStartup } from './sections/ui/desktop-startup';
import { DesktopWarnings } from './sections/ui/desktop-warnings';
import { Language } from './sections/ui/language';
import { TagBubble } from './sections/ui/tag-bubble';
import { ThemeAppearance } from './sections/ui/theme-appearance';
import { SideMenu, type MenuItemProps } from './side-menu';
import { useRequiredFieldsValidity } from './useRequiredFieldsValidity';
import { PluginsSettingsPanel } from './plugins-settings-panel';
import { AiPromptProfilesPanel } from './ai-prompt-profiles-panel';
import { getProjectSettingsPanel } from './hostPanels';
import { PrivacySettingsPanel } from './privacy-settings-panel';
import { TranslationPolicyPanel } from './translation-policy-panel';
import { TranslationDatesPanel } from './translation-dates-panel';
import { SettingsValidationContext } from './settingsValidationContext';
import type { SettingsDialogProps, SettingsTabId } from './types';

export const SettingsDialog = ({ onClose, open = false, initialTab }: SettingsDialogProps) => {
  const { isReadonly, settings } = useAppState().editor;
  const { stripCjkWhitespace } = useAppState().editor;
  const { setStripCjkWhitespace } = useActions().editor;
  const { t } = useTranslation();
  const validity = useRequiredFieldsValidity();
  const [closeAttempted, setCloseAttempted] = useState(false);

  const handleClose = () => {
    if (
      activeId === 'project' &&
      window.__ljbConfirmDiscardProjectSettings &&
      !window.__ljbConfirmDiscardProjectSettings()
    ) {
      return;
    }
    if (!validity.allValid) {
      setCloseAttempted(true);
      return;
    }
    onClose && onClose('close');
  };

  const handleTabChange = (id: SettingsTabId) => {
    if (
      activeId === 'project' &&
      id !== 'project' &&
      window.__ljbConfirmDiscardProjectSettings &&
      !window.__ljbConfirmDiscardProjectSettings()
    ) {
      return;
    }
    setActiveId(id);
  };

  const isDesktop =
    typeof window !== 'undefined' && !!(window as Window & { electronAPI?: unknown }).electronAPI;
  const projectFilePath = window.__leafWriterProject?.getProjectFilePath?.() ?? null;
  const hasProject = Boolean(projectFilePath);
  // Supplied by the host app (see `hostPanels`); null when it provides none.
  const ProjectSettingsPanel = getProjectSettingsPanel();

  const dialogContainer = isDesktop
    ? undefined
    : (document.getElementById(`${settings?.container}`) ?? undefined);

  const items = useMemo<MenuItemProps[]>(
    () => [
      { id: 'project', label: t('LW.settings.tabs.project'), hide: !isDesktop || !hasProject },
      { id: 'profile', label: t('LW.settings.tabs.profile'), hide: !isDesktop },
      { id: 'interface', label: t('LW.settings.tabs.interface') },
      { id: 'guardrails', label: t('LW.settings.tabs.guardrails') },
      { id: 'authorities', label: t('LW.settings.tabs.authorities'), hide: isReadonly },
      {
        id: 'asset-packs',
        label: t('LW.settings.tabs.asset_packs'),
        hide: !isDesktop || isReadonly,
      },
      { id: 'plugins', label: t('LW.settings.tabs.plugins'), hide: !isDesktop },
      { id: 'ai', label: t('LW.settings.tabs.ai'), hide: !isDesktop },
      { id: 'translation-policy', label: t('LW.settings.tabs.translation_policy') },
      { id: 'privacy', label: t('LW.settings.tabs.privacy') },
    ],
    [hasProject, isDesktop, isReadonly, t],
  );
  const visibleItems = items.filter(({ hide }) => !hide);
  const defaultTab = (initialTab ?? visibleItems[0]?.id ?? 'interface') as SettingsTabId;
  const [activeId, setActiveId] = useState<SettingsTabId>(defaultTab);

  useEffect(() => {
    if (!open) return;
    if (initialTab && visibleItems.some(({ id }) => id === initialTab)) {
      setActiveId(initialTab);
    }
  }, [initialTab, open, visibleItems]);

  useEffect(() => {
    if (!visibleItems.some(({ id }) => id === activeId)) {
      setActiveId((visibleItems[0]?.id as SettingsTabId | undefined) ?? 'interface');
    }
  }, [activeId, visibleItems]);

  useEffect(() => {
    if (!closeAttempted || validity.allValid) return;
    if (
      validity.isDesktop &&
      !validity.encoderNameValid &&
      visibleItems.some(({ id }) => id === 'profile')
    ) {
      setActiveId('profile');
      return;
    }
    setActiveId('interface');
  }, [closeAttempted, validity, visibleItems]);

  return (
    <Dialog
      aria-labelledby="settings-title"
      container={dialogContainer}
      onClose={handleClose}
      open={open}
      PaperProps={{
        sx: {
          borderRadius: 3.5,
          border: 'none',
          outline: 'none',
          overflow: 'hidden',
          m: 1,
          // Stable size across tabs; content scrolls inside.
          width: 760,
          maxWidth: 'calc(100vw - 32px)',
          height: 'min(80vh, 720px)',
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper',
          boxShadow: (theme) => theme.shadows[10],
        },
      }}
    >
      <Header onClose={handleClose} />
      <Stack
        direction="row"
        px={0.75}
        pb={0.75}
        sx={{ flex: 1, minHeight: 0, overflow: 'hidden', alignItems: 'stretch' }}
      >
        <SideMenu
          activeId={activeId}
          items={items}
          onChange={(id) => handleTabChange(id as SettingsTabId)}
        />
        <DialogContent
          sx={{
            pt: 0.25,
            px: 1,
            pb: 1,
            minWidth: 0,
            minHeight: 0,
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          <SettingsValidationContext.Provider value={{ ...validity, attempted: closeAttempted }}>
            <AnimatePresence mode="wait" initial={false}>
              <Stack
                component={motion.div}
                key={activeId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                spacing={1.75}
              >
                {closeAttempted && !validity.allValid && (
                  <Alert severity="error">{t('LW.desktop.settings.setup_incomplete')}</Alert>
                )}
                {activeId === 'project' && isDesktop && hasProject && ProjectSettingsPanel && (
                  <Section id="project" title={t('LW.settings.tabs.project')}>
                    <ProjectSettingsPanel active={activeId === 'project'} />
                  </Section>
                )}

                {activeId === 'profile' && isDesktop && (
                  <>
                    <Section id="profile-main" title={t('LW.commons.profile')}>
                      <List dense>
                        <DesktopEncoderName />
                        <DesktopEntityDatabase />
                      </List>
                    </Section>
                    <Section
                      id="profile-entity-backup"
                      title={t('LW.desktop.settings.entity_backup.title')}
                    >
                      <List dense>
                        <DesktopEntityBackup />
                      </List>
                    </Section>
                    <Section
                      id="profile-entity-sync"
                      title={t('LW.desktop.settings.entity_sync.title')}
                    >
                      <List dense>
                        <DesktopEntitySync />
                      </List>
                    </Section>
                    <Section id="profile-github" title={t('LW.settings.tabs.github')}>
                      <List dense>
                        <DesktopGithub />
                      </List>
                    </Section>
                  </>
                )}

                {activeId === 'interface' && (
                  <>
                    <Section id="appearance" title={t('LW.settings.tabs.appearance')}>
                      <List dense>
                        <ThemeAppearance />
                        <Language />
                        <TagBubble />
                        <FontSize />
                        <FontFamily />
                      </List>
                    </Section>
                    <Section id="behaviour" title={t('LW.settings.tabs.behaviour')}>
                      <List dense>
                        {isDesktop && <DesktopStartup />}
                        <Toggler
                          icon="translate"
                          onChange={setStripCjkWhitespace}
                          title={t('LW.settings.editor.strip_east_asian_whitespace')}
                          type="toggle"
                          value={stripCjkWhitespace}
                        />
                        {isDesktop && <ShowPackStringCounts />}
                        {isDesktop && <MatchAcrossLineBreaks />}
                      </List>
                    </Section>
                    {!isReadonly && (
                      <Section id="markup-panel" title={t('LW.settings.markupPanel.title')}>
                        <MarkupPanel />
                      </Section>
                    )}
                    <Section id="reset" title={t('LW.commons.reset')}>
                      <Reset />
                    </Section>
                  </>
                )}

                {activeId === 'translation-policy' && (
                  <>
                    <Section
                      id="translation-policy"
                      title={t('LW.settings.tabs.translation_policy')}
                      description={t('LW.settings.translationPolicy.description')}
                    >
                      <TranslationPolicyPanel />
                    </Section>
                    <Section
                      id="translation-dates"
                      title={t('LW.settings.translationPolicy.datesSection')}
                      description={t('LW.settings.translationPolicy.datesDescription')}
                    >
                      <TranslationDatesPanel />
                    </Section>
                  </>
                )}

                {activeId === 'privacy' && (
                  <Section
                    id="privacy"
                    title={t('LW.settings.tabs.privacy')}
                    description={t('LW.settings.privacy.description')}
                  >
                    <PrivacySettingsPanel />
                  </Section>
                )}

                {activeId === 'guardrails' && (
                  <>
                    <Section
                      id="guardrails-main"
                      title={t('LW.settings.guardrails.title')}
                      description={t('LW.settings.guardrails.description')}
                    >
                      <Guardrails />
                    </Section>
                    {isDesktop && (
                      <Section id="guardrails-warnings" title={t('LW.settings.warnings.title')}>
                        <List dense>
                          <DesktopWarnings />
                        </List>
                      </Section>
                    )}
                  </>
                )}

                {activeId === 'authorities' && !isReadonly && (
                  <>
                    {isDesktop && (
                      <Alert severity="info">{t('LW.settings.authorities.asset_packs_note')}</Alert>
                    )}
                    <Section
                      endDecorator={<AddCustomAuthority />}
                      id="authorities-services"
                      title={t('LW.settings.tabs.authorities')}
                    >
                      <Authorities includeDesktopAssets={false} />
                    </Section>
                    <Section id="entity-lookups" title={t('LW.settings.tabs.entity_types')}>
                      <EntityLookups />
                    </Section>
                  </>
                )}

                {activeId === 'asset-packs' && isDesktop && !isReadonly && (
                  <>
                    <Section
                      id="asset-authorities"
                      title={t('LW.settings.asset_packs.offline_authorities')}
                    >
                      <List dense>
                        <DesktopOfflineAuthorities />
                      </List>
                    </Section>
                    <Section id="asset-map-tiles" title={t('LW.settings.asset_packs.map_tiles')}>
                      <List dense>
                        <DesktopMapTilesSettings />
                      </List>
                    </Section>
                  </>
                )}

                {activeId === 'plugins' && isDesktop && (
                  <Section id="plugins" title={t('LW.settings.tabs.plugins')}>
                    <PluginsSettingsPanel active={activeId === 'plugins'} />
                  </Section>
                )}

                {activeId === 'ai' && isDesktop && (
                  <>
                    <Section id="ai-api" title={t('LW.settings.ai_api.title')}>
                      <List dense>
                        <DesktopAiApi />
                      </List>
                    </Section>
                    <Section id="language-tool" title={t('LW.settings.language_tool.title')}>
                      <List dense>
                        <DesktopLanguageTool />
                      </List>
                    </Section>
                    <Section id="ai-prompts" title={t('LW.settings.ai_prompts.title')}>
                      <AiPromptProfilesPanel active={activeId === 'ai'} />
                    </Section>
                  </>
                )}
              </Stack>
            </AnimatePresence>
          </SettingsValidationContext.Provider>
        </DialogContent>
      </Stack>
    </Dialog>
  );
};
