import { entityStoreFromDesktop } from '../../../../packages/cwrc-leafwriter/src/autoTagging/entityStore';
import { runEntityDatabaseCheck } from '../../../../packages/cwrc-leafwriter/src/autoTagging/entityDatabaseCheck';
import { resolveEntityStorePaths } from '../../../../packages/cwrc-leafwriter/src/autoTagging/entityStoreResolve';
import { useAppState } from '@src/overmind';
import { isDesktop } from '@src/types/desktop';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export const useEntityDatabaseLifecycle = () => {
  const { config, projectFilePath, rootPath } = useAppState().project;
  const { t } = useTranslation();
  const checkedProjectRef = useRef<string | null>(null);
  const staleEntitiesRef = useRef(false);

  const resolveEntitiesPath = useCallback((): string | null => {
    if (!isDesktop() || !rootPath) return null;
    try {
      const globals = window as unknown as {
        __ljbLspProject?: { entityDbFolder?: string | null; entityStore?: 'central' | 'project' };
      };
      const paths = resolveEntityStorePaths({
        projectRoot: rootPath,
        entityStore: config?.entityStore ?? globals.__ljbLspProject?.entityStore,
        centralFolder: globals.__ljbLspProject?.entityDbFolder ?? null,
      });
      return paths.entitiesPath;
    } catch {
      return null;
    }
  }, [config?.entityStore, rootPath]);

  useEffect(() => {
    if (!isDesktop() || !projectFilePath || !rootPath) return;
    if (checkedProjectRef.current === projectFilePath) return;

    const store = entityStoreFromDesktop();
    if (!store || !window.electronAPI) return;

    checkedProjectRef.current = projectFilePath;
    void runEntityDatabaseCheck(
      store,
      {
        projectDatabaseId: config?.entityDatabaseId,
        projectRoot: rootPath,
        projectFilePath,
      },
      {
        listProjectXmlFiles: (path) => window.electronAPI!.listProjectXmlFiles(path),
        readFile: (path) => window.electronAPI!.readFile(path),
        writeFile: (path, content) => window.electronAPI!.writeFile(path, content),
        showNativeMessageBox: (options) => window.electronAPI!.showNativeMessageBox(options),
        updateProjectFileConfig: (path, patch) =>
          window.electronAPI!.updateProjectFileConfig(path, patch),
      },
    );
  }, [config?.entityDatabaseId, projectFilePath, rootPath]);

  useEffect(() => {
    if (!isDesktop() || !window.electronAPI?.onExternalFileChange) return;
    const entitiesPath = resolveEntitiesPath();
    if (!entitiesPath) return;

    return window.electronAPI.onExternalFileChange((filePath) => {
      if (filePath.replace(/\\/g, '/') !== entitiesPath.replace(/\\/g, '/')) return;
      staleEntitiesRef.current = true;
      void window.electronAPI?.showNativeMessageBox?.({
        type: 'question',
        title: t('LWC.desktop.entity_database_changed.title'),
        message: t('LWC.desktop.entity_database_changed.message'),
        buttons: [
          t('LWC.desktop.entity_database_changed.reload'),
          t('LWC.desktop.entity_database_changed.keep'),
        ],
      }).then(({ response }) => {
        if (response === 0) staleEntitiesRef.current = false;
      });
    });
  }, [resolveEntitiesPath, t]);

  return { entitiesPath: resolveEntitiesPath(), staleEntitiesRef };
};
