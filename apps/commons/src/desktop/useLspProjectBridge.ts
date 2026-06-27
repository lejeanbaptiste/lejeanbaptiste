import { useAppState } from '@src/overmind';
import { isDesktop } from '@src/types/desktop';
import { useEffect } from 'react';

export const useLspProjectBridge = () => {
  const { config, rootPath } = useAppState().project;

  useEffect(() => {
    if (!isDesktop()) return;

    window.__ljbLspProject = {
      defaultSchemaRng: config?.schema?.rng,
      projectRoot: rootPath ?? undefined,
    };

    return () => {
      delete window.__ljbLspProject;
    };
  }, [config?.schema?.rng, rootPath]);
};

declare global {
  interface Window {
    __ljbLspProject?: {
      defaultSchemaRng?: string;
      projectRoot?: string;
    };
  }
}
