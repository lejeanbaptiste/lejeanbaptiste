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

    window.__ljbLspProject = {
      defaultSchemaRng: config?.schema?.rng,
      projectRoot: rootPath ?? undefined,
      entityStore: config?.entityStore ?? 'central',
      entityDbFolder,
    };

    return () => {
      delete window.__ljbLspProject;
    };
  }, [config?.entityStore, config?.schema?.rng, entityDbFolder, rootPath]);
};

declare global {
  interface Window {
    __ljbLspProject?: {
      defaultSchemaRng?: string;
      projectRoot?: string;
      entityStore?: 'central' | 'project';
      entityDbFolder?: string | null;
    };
  }
}
