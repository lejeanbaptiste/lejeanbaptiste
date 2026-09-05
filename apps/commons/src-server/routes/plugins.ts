import { NextFunction, Request, Response, Router } from 'express';
import {
  readPluginApiState,
  resolvePluginApiStateFilePath,
  type PluginApiState,
} from '../../src/desktop/pluginApiState';
import {
  ALL_ENTITY_KINDS,
  getEntityById,
  isEntityKind,
  readCombinedStatus,
  searchEntities,
} from './pluginEntities';

const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 100;

/**
 * Read-only API for the Word add-in ("connecting to the entity database via Grognard").
 * Reads sibling `entities.sqlite` only — no `entities.xml` fallback.
 * No mutation endpoints exist here on purpose — all entity edits stay in Grognard.
 */
export const pluginsApi = Router();

// Defaults to the word-plugin project's own dev server origin so it works
// out of the box; overridable once the add-in has a real hosted/sideloaded
// origin (GROGNARD_PLUGIN_ADDIN_ORIGIN env var).
const DEFAULT_ADDIN_ORIGIN = 'https://localhost:3100';

pluginsApi.use((req: Request, res: Response, next: NextFunction) => {
  const allowedOrigin = process.env.GROGNARD_PLUGIN_ADDIN_ORIGIN ?? DEFAULT_ADDIN_ORIGIN;
  res.header('Access-Control-Allow-Origin', allowedOrigin);
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

const requireToken = (req: Request, res: Response, next: NextFunction) => {
  const state = readPluginApiState(resolvePluginApiStateFilePath());
  const header = req.header('authorization') ?? '';
  const presented = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!state || !presented || presented !== state.token) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  res.locals.state = state;
  next();
};

pluginsApi.use(requireToken);

/**
 * Search roots in priority order: the currently open project (if any) first,
 * then the central entity database (CEDB) — always included when
 * configured, independent of whether a project is open. A project not being
 * synced to central shouldn't hide its local-only entities, which is why
 * this is project-then-central rather than central-only.
 */
const searchRootsFor = (state: PluginApiState): string[] =>
  [state.projectRoot, state.centralEntitiesFolder].filter((root): root is string => Boolean(root));

pluginsApi.get('/status', async (_req: Request, res: Response) => {
  const state = res.locals.state as PluginApiState;
  const roots = searchRootsFor(state);
  const status = await readCombinedStatus(roots);
  res.json({
    projectOpen: Boolean(state.projectRoot),
    projectRoot: state.projectRoot,
    centralConfigured: Boolean(state.centralEntitiesFolder),
    ...status,
  });
});

pluginsApi.get('/entities/search', async (req: Request, res: Response) => {
  const state = res.locals.state as PluginApiState;
  const roots = searchRootsFor(state);

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) {
    res.status(400).json({ error: 'missing_query' });
    return;
  }

  const kindParam = typeof req.query.kind === 'string' ? req.query.kind : null;
  let kinds = ALL_ENTITY_KINDS;
  if (kindParam) {
    if (!isEntityKind(kindParam)) {
      res.status(400).json({ error: 'invalid_kind' });
      return;
    }
    kinds = [kindParam];
  }

  const limitParam = Number(req.query.limit);
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(limitParam, MAX_SEARCH_LIMIT)
      : DEFAULT_SEARCH_LIMIT;

  const results = await searchEntities(roots, q, kinds, limit);
  res.json({ results });
});

pluginsApi.get('/entities/:id', async (req: Request, res: Response) => {
  const state = res.locals.state as PluginApiState;
  const roots = searchRootsFor(state);

  const entity = await getEntityById(roots, String(req.params.id));
  if (!entity) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json(entity);
});
