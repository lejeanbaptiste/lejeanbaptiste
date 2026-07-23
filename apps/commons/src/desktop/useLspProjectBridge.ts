import { useAppState } from '@src/overmind';
import { isDesktop } from '@src/types/desktop';
import { useEffect, useState } from 'react';

/**
 * Exposes project + app entity-database settings to LEAF-Writer (entity store,
 * disambiguation panel).
 */
export const useLspProjectBridge = () => {
  const { config, rootPath } = useAppState().project;
  const [entityDbFolder, setEntityDbFolder] = useState<string | null>(null);

  useEffect(() => {
    if (!isDesktop()) return;
    void window.electronAPI?.getEntityDbFolder?.().then((folder) => {
      setEntityDbFolder(folder ?? null);
    });
  }, []);

  useEffect(() => {
    if (!isDesktop()) return;

    const syncFromBridge = () => {
      const folder = window.__ljbCommonsUi?.entityDbFolder;
      if (typeof folder === 'string' && folder.trim()) {
        setEntityDbFolder(folder);
      }
    };

    window.addEventListener('ljbCommonsUiChanged', syncFromBridge);
    return () => window.removeEventListener('ljbCommonsUiChanged', syncFromBridge);
  }, []);

  useEffect(() => {
    if (!isDesktop()) return;

    window.__ljbLspProject = {
      defaultSchemaRng: config?.schema?.rng,
      projectRoot: rootPath ?? undefined,
      entityDbFolder,
      syncToCentral: config?.syncToCentral === true,
    };

    return () => {
      delete window.__ljbLspProject;
    };
  }, [config?.schema?.rng, config?.syncToCentral, entityDbFolder, rootPath]);
};

declare global {
  interface Window {
    __ljbLspProject?: {
      defaultSchemaRng?: string;
      projectRoot?: string;
      entityDbFolder?: string | null;
      /** When true, this project's PEDB is auto-synced with the CEDB (see syncToCentral in projectTypes.ts). */
      syncToCentral?: boolean;
    };
  }
}
