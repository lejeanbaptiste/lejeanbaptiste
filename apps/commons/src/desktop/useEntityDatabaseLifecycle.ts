import { entityStoreFromDesktop } from '../../../../packages/cwrc-leafwriter/src/autoTagging/entityStore';
import { applyPendingOrders } from '@src/desktop/entityDb/applyOrders';
import {
  purgeReportedOrphans,
  runEntityDatabaseCheck,
  sweepProjectOrphans,
} from '../../../../packages/cwrc-leafwriter/src/autoTagging/entityDatabaseCheck';
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
      const paths = resolveEntityStorePaths({ projectRoot: rootPath });
      return paths.entitiesPath;
    } catch {
      return null;
    }
  }, [rootPath]);

  useEffect(() => {
    if (!isDesktop() || !projectFilePath || !rootPath) return;
    if (checkedProjectRef.current === projectFilePath) return;

    const store = entityStoreFromDesktop();
    if (!store || !window.electronAPI) return;

    checkedProjectRef.current = projectFilePath;

    void (async () => {
      // Check this project into the shared-database registry so merge/delete
      // key propagation knows every project tree using this entities.xml.
      await store.registerProjectInRegistry().catch(() => undefined);

      const checkApi = {
        listProjectXmlFiles: (path: string) => window.electronAPI!.listProjectXmlFiles(path),
        readFile: (path: string) => window.electronAPI!.readFile(path),
        writeFile: (path: string, content: string) => window.electronAPI!.writeFile(path, content),
        showNativeMessageBox: (options: Parameters<typeof window.electronAPI.showNativeMessageBox>[0]) =>
          window.electronAPI!.showNativeMessageBox(options),
        updateProjectFileConfig: (path: string, patch: Record<string, unknown>) =>
          window.electronAPI!.updateProjectFileConfig(path, patch),
      };

      // eslint-disable-next-line no-console
      console.info('[entity-db-check] running check for project', {
        projectFilePath,
        projectRoot: rootPath,
        projectDatabaseId: config?.entityDatabaseId,
        entitiesPath: store.entitiesPath,
      });

      const checkResult = await runEntityDatabaseCheck(
        store,
        {
          projectDatabaseId: config?.entityDatabaseId,
          projectRoot: rootPath,
          projectFilePath,
        },
        checkApi,
      );

      // eslint-disable-next-line no-console
      console.info('[entity-db-check] check completed', { status: checkResult.status, databaseId: checkResult.databaseId });

      // Replay any merge/delete orders recorded elsewhere (other machine, fresh
      // clone, a tree the eager crawl couldn't see). Idempotent; safe to run on
      // every open.
      try {
        const result = await applyPendingOrders(store);
        if (result.ordersApplied > 0 && (result.summary?.filesChanged ?? 0) > 0) {
          // eslint-disable-next-line no-console
          console.info(
            `[entity-orders] applied ${result.ordersApplied} order(s); ` +
              `updated ${result.summary?.filesChanged} file(s) in this project.`,
          );
        }
      } catch {
        // never block project open on order replay
      }

      // Gentle orphan check: after orders have converged, surface corpus keys
      // that resolve to nothing — but only the genuine orphans (stray files from
      // another edition are reported separately and never auto-stripped).
      try {
        const report = await sweepProjectOrphans(store, checkApi, rootPath);
        if (report.orphanKeyCount > 0) {
          const strayNote =
            report.strayFiles.length > 0
              ? `\n\n${report.strayFiles.length} file(s) appear to belong to a different project database and were left untouched.`
              : '';
          const { response } = await window.electronAPI!.showNativeMessageBox({
            type: 'warning',
            title: 'Unresolved entity keys found',
            message: `${report.orphanKeyCount} tag key(s) in ${report.orphanFiles.length} file(s) no longer match any entity in this database.`,
            detail:
              'This usually means the database was rolled back or hand-edited. You can strip these keys (tags are kept), or cancel and restore from Time Machine instead.' +
              strayNote,
            buttons: ['Cancel', 'Strip orphan keys'],
            defaultId: 0,
            cancelId: 0,
          });
          if (response === 1) {
            const purged = await purgeReportedOrphans(checkApi, report);
            // eslint-disable-next-line no-console
            console.info(`[orphan-sweep] stripped ${purged} orphan key(s).`);
          }
        }
      } catch {
        // never block project open on the orphan sweep
      }
    })();
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
