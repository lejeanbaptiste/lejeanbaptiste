import fs from 'fs/promises';
import path from 'path';
import {
  exportEntitiesXml,
  importEntitiesXml,
  backfillDecisionTargetsFromXml,
  computeEntityContentHash,
  replaceEntityContentBetween,
  type XmlImportReport,
} from './xmlCodec';
import {
  EntitySqliteRepository,
  type SqliteEntityKind,
  type SqliteEntityCandidateRecord,
  type SqliteEntityLookupResult,
  type SqliteEntityPanelSummary,
  type SqliteDuplicateGroup,
  type AddNameInput,
  type UpdateNamesByTextInput,
  type SetUserEntityDateInput,
  type SetUserWorkDateInput,
  type SetWorkTypeInput,
  type AddLabeledValueInput,
  type NobleTitleMutationInput,
  type SetUserWorkAuthorsInput,
  type AuthorityRefInput,
  type SqliteConcordanceAssociation,
  type SqliteConcordanceImportResult,
  type DecisionTargetBackfillReport,
  type CreatePopulatedEntityInput,
  type SqliteMergeResult,
  type AuthorityBackfillPatch,
  type AuthorityBackfillPatchResult,
  type XmlExtractedRefreshInput,
  type XmlExtractedRefreshResult,
  type SqliteEntityNote,
  type SqliteEntityRelation,
  type SqliteValueStatus,
} from './repository';

export interface EntitySqliteReadRequest {
  databasePath: string;
  kind: SqliteEntityKind;
  query: string;
}

export interface EntitySqliteGetRequest {
  databasePath: string;
  entityId: string;
}

export type EntitySqlitePanelGetRequest = EntitySqliteGetRequest;

export interface EntitySqliteCandidatesRequest {
  databasePath: string;
  kind: SqliteEntityKind;
}

export interface EntitySqliteListIdsRequest {
  databasePath: string;
  kind?: SqliteEntityKind;
}

export interface EntitySqliteXmlRequest {
  databasePath: string;
}

export interface EntitySqliteImportXmlRequest extends EntitySqliteXmlRequest {
  xml: string;
}

export interface EntitySqliteUpdateNamesRequest extends UpdateNamesByTextInput {
  databasePath: string;
}

export interface EntitySqliteTombstoneNamesRequest {
  databasePath: string;
  entityId: string;
  text: string;
  reason?: string;
}

export interface EntitySqliteUpdateDescriptionRequest {
  databasePath: string;
  entityId: string;
  description: string | null;
}

export interface EntitySqliteUpdateSubtypeRequest {
  databasePath: string;
  entityId: string;
  subtype: string | null;
}

export interface EntitySqliteNotesRequest {
  databasePath: string;
  entityId: string;
}

export interface EntitySqliteSetNoteRequest extends EntitySqliteNotesRequest {
  xml: string;
}

export interface EntitySqliteRemoveNameRequest {
  databasePath: string;
  entityId: string;
  text: string;
}

export interface EntitySqliteAddNameRequest extends AddNameInput {
  databasePath: string;
}

export interface EntitySqliteSetUserEntityDateRequest extends SetUserEntityDateInput {
  databasePath: string;
}

export interface EntitySqliteSetUserWorkDateRequest extends SetUserWorkDateInput {
  databasePath: string;
}

export interface EntitySqliteSetWorkTypeRequest extends SetWorkTypeInput {
  databasePath: string;
}

export interface EntitySqliteAddLabeledValueRequest extends AddLabeledValueInput {
  databasePath: string;
}

export interface EntitySqliteNobleTitleRequest {
  databasePath: string;
  entityId: string;
  input: NobleTitleMutationInput;
}

export interface EntitySqliteUpdateNobleTitleRequest extends EntitySqliteNobleTitleRequest {
  key: string;
}

export interface EntitySqliteSetUserWorkAuthorsRequest extends SetUserWorkAuthorsInput {
  databasePath: string;
}

export interface EntitySqliteAuthorityRefRequest extends AuthorityRefInput {
  databasePath: string;
}

export interface EntitySqliteAssertionRequest {
  databasePath: string;
  entityId: string;
  key: string;
}

export interface EntitySqliteRenamePrimaryNameRequest {
  databasePath: string;
  entityId: string;
  text: string;
}

export interface EntitySqliteSetRomanizedNameRequest {
  databasePath: string;
  entityId: string;
  text: string;
  language?: string;
}

export interface EntitySqliteAutoCleanNamesRequest {
  databasePath: string;
}

export interface EntitySqliteAutoCleanNamesResult {
  dedupedNames: number;
  removedNan: number;
  removedInvalidFamilyGiven: number;
  removedUntyped: number;
  promotedRomanizations: number;
}

export interface EntitySqliteApplyConcordanceRequest {
  databasePath: string;
  associations: SqliteConcordanceAssociation[];
}

export interface EntitySqliteRejectConcordanceRequest {
  databasePath: string;
  association: SqliteConcordanceAssociation;
  entityId?: string;
  reason?: string;
}

export interface EntitySqliteMarkDuplicateIntentionalRequest {
  databasePath: string;
  entityIds: string[];
}

export interface EntitySqliteBackfillDecisionTargetsRequest {
  databasePath: string;
}

export interface EntitySqliteSoftDeleteRequest {
  databasePath: string;
  entityId: string;
}

export interface EntitySqliteMergeRequest {
  databasePath: string;
  keepId: string;
  dropIds: string[];
}

export interface EntitySqliteCreateRelationRequest {
  databasePath: string;
  subjectEntityId: string;
  objectEntityId: string;
  relationType: string;
  symmetric?: boolean;
  reference?: string | null;
}

export interface EntitySqliteListRelationsRequest {
  databasePath: string;
  entityId: string;
}

export interface EntitySqliteUpdateRelationStatusRequest {
  databasePath: string;
  relationId: number;
  status: SqliteValueStatus;
}

export interface EntitySqliteCreatePopulatedRequest extends CreatePopulatedEntityInput {
  databasePath: string;
}

export interface EntitySqliteGetCentralIdRequest {
  databasePath: string;
  entityId: string;
  userStableId: string;
}

export interface EntitySqliteSetCentralMappingRequest {
  databasePath: string;
  entityId: string;
  userStableId: string;
  centralId: string;
}

export interface EntitySqliteFindByAuthorityRequest {
  databasePath: string;
  kind: SqliteEntityKind;
  type: string;
  value: string;
}

export interface EntitySqliteFindByNameDatesRequest {
  databasePath: string;
  kind: SqliteEntityKind;
  name: string;
  startYear?: number | null;
  endYear?: number | null;
}

export interface EntitySqliteForceRejectAssertionRequest {
  databasePath: string;
  entityId: string;
  key: string;
}

const DECISION_TARGET_BACKFILL_META = 'decision_targets_backfill_v1';

const repositories = new Map<string, EntitySqliteRepository>();

/** Shared, process-wide open repository per `entities.sqlite` path. */
export const repositoryFor = (databasePath: string): EntitySqliteRepository => {
  const existing = repositories.get(databasePath);
  if (existing) return existing;
  const repository = new EntitySqliteRepository(databasePath);
  repositories.set(databasePath, repository);
  return repository;
};

const validDatabasePath = (databasePath: string): boolean =>
  path.basename(databasePath).toLowerCase() === 'entities.sqlite';

export async function searchEntitySqlite(
  request: EntitySqliteReadRequest & { limit?: number },
): Promise<SqliteEntityLookupResult[] | null> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  try {
    await fs.access(request.databasePath);
  } catch {
    return null;
  }
  return repositoryFor(request.databasePath).searchNames(
    request.kind,
    request.query,
    request.limit ?? 20,
  );
}

export async function getEntitySqlite(
  request: EntitySqliteGetRequest,
): Promise<SqliteEntityPanelSummary | null> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  try {
    await fs.access(request.databasePath);
  } catch {
    return null;
  }
  return repositoryFor(request.databasePath).getPanelSummary(request.entityId);
}

export async function getEntitySqlitePanelSummary(
  request: EntitySqlitePanelGetRequest,
): Promise<SqliteEntityPanelSummary | null> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  try {
    await fs.access(request.databasePath);
  } catch {
    return null;
  }
  return repositoryFor(request.databasePath).getPanelSummary(request.entityId);
}

export async function getEntitySqliteDatabaseId(databasePath: string): Promise<string | null> {
  if (!validDatabasePath(databasePath)) throw new Error('Invalid entity SQLite database path.');
  try {
    await fs.access(databasePath);
  } catch {
    return null;
  }
  return repositoryFor(databasePath).getDatabaseId();
}

export async function listEntitySqliteIds(
  request: EntitySqliteListIdsRequest,
): Promise<string[] | null> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  try {
    await fs.access(request.databasePath);
  } catch {
    return null;
  }
  return repositoryFor(request.databasePath).listEntityIds(request.kind);
}

export async function listEntitySqlitePanelSummaries(
  request: EntitySqliteListIdsRequest,
): Promise<SqliteEntityPanelSummary[] | null> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  try {
    await fs.access(request.databasePath);
  } catch {
    return null;
  }
  const repository = repositoryFor(request.databasePath);
  return repository.listPanelSummaries(request.kind, repository.listConcordanceRejections());
}

export async function listEntitySqliteAuthorityDuplicates(
  databasePath: string,
): Promise<SqliteDuplicateGroup[] | null> {
  if (path.basename(databasePath).toLowerCase() !== 'entities.sqlite')
    throw new Error('Invalid entity SQLite database path.');
  try {
    await fs.access(databasePath);
  } catch {
    return null;
  }
  await backfillEntitySqliteDecisionTargets({ databasePath });
  return repositoryFor(databasePath).listAuthorityDuplicates();
}

export async function applyEntitySqliteConcordance(
  request: EntitySqliteApplyConcordanceRequest,
): Promise<SqliteConcordanceImportResult> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).applyConcordanceAssociations(request.associations);
}

export async function rejectEntitySqliteConcordance(
  request: EntitySqliteRejectConcordanceRequest,
): Promise<boolean> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).rejectConcordance(
    request.association,
    request.entityId,
    request.reason,
  );
}

export async function markEntitySqliteDuplicateIntentional(
  request: EntitySqliteMarkDuplicateIntentionalRequest,
): Promise<boolean> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).markDuplicateIntentional(request.entityIds);
}

/**
 * One-time repair: copy `@target` from the sibling `entities.xml` into
 * `entity_decisions.target_refs` when an earlier import dropped them.
 */
export async function backfillEntitySqliteDecisionTargets(
  request: EntitySqliteBackfillDecisionTargetsRequest,
): Promise<DecisionTargetBackfillReport | null> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  try {
    await fs.access(request.databasePath);
  } catch {
    return null;
  }
  const repository = repositoryFor(request.databasePath);
  if (repository.getMetadata(DECISION_TARGET_BACKFILL_META) === 'done') {
    return { updated: 0, inserted: 0, unchanged: 0 };
  }
  const xmlPath = request.databasePath.replace(/entities\.sqlite$/i, 'entities.xml');
  // No initializer: every path out of the `catch` below returns, so `xml` is
  // definitely assigned by the time it is read.
  let xml: string;
  try {
    xml = await fs.readFile(xmlPath, 'utf-8');
    if (xml.charCodeAt(0) === 0xfeff) xml = xml.slice(1);
  } catch {
    repository.setMetadata(DECISION_TARGET_BACKFILL_META, 'done');
    return { updated: 0, inserted: 0, unchanged: 0 };
  }
  const report = backfillDecisionTargetsFromXml(repository, xml);
  repository.setMetadata(DECISION_TARGET_BACKFILL_META, 'done');
  return report;
}

export async function listEntitySqliteCandidates(
  request: EntitySqliteCandidatesRequest,
): Promise<SqliteEntityCandidateRecord[] | null> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  try {
    await fs.access(request.databasePath);
  } catch {
    return null;
  }
  return repositoryFor(request.databasePath).listCandidateRecords(request.kind);
}

export async function updateEntitySqliteNames(
  request: EntitySqliteUpdateNamesRequest,
): Promise<number> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).updateNamesByText(request);
}

export async function tombstoneEntitySqliteNames(
  request: EntitySqliteTombstoneNamesRequest,
): Promise<number> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).tombstoneNamesByText(
    request.entityId,
    request.text,
    request.reason,
  );
}

export async function updateEntitySqliteDescription(
  request: EntitySqliteUpdateDescriptionRequest,
): Promise<void> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  repositoryFor(request.databasePath).updateDescription(request.entityId, request.description);
}

export async function updateEntitySqliteSubtype(
  request: EntitySqliteUpdateSubtypeRequest,
): Promise<void> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  repositoryFor(request.databasePath).updateSubtype(request.entityId, request.subtype);
}

export async function getEntitySqliteNotes(
  request: EntitySqliteNotesRequest,
): Promise<SqliteEntityNote[]> {
  return repositoryFor(request.databasePath).getEntityNotes(request.entityId);
}

export async function setEntitySqliteNote(request: EntitySqliteSetNoteRequest): Promise<void> {
  repositoryFor(request.databasePath).setEntityNote(request.entityId, request.xml);
}

export async function removeEntitySqliteName(
  request: EntitySqliteRemoveNameRequest,
): Promise<boolean> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).removeNameByText(request.entityId, request.text);
}

export async function addEntitySqliteName(
  request: EntitySqliteAddNameRequest,
): Promise<import('./repository').SqliteName> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).addName(request);
}

export async function setEntitySqliteUserDate(
  request: EntitySqliteSetUserEntityDateRequest,
): Promise<void> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  repositoryFor(request.databasePath).setUserEntityDate(request);
}

export async function setEntitySqliteUserWorkDate(
  request: EntitySqliteSetUserWorkDateRequest,
): Promise<void> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  repositoryFor(request.databasePath).setUserWorkDate(request);
}

export async function setEntitySqliteWorkType(
  request: EntitySqliteSetWorkTypeRequest,
): Promise<void> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  repositoryFor(request.databasePath).setWorkType(request);
}

export async function addEntitySqliteNationality(
  request: EntitySqliteAddLabeledValueRequest,
): Promise<boolean> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).addNationality(request);
}

export async function addEntitySqliteOrigin(
  request: EntitySqliteAddLabeledValueRequest,
): Promise<boolean> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).addOrigin(request);
}

export async function addEntitySqliteNobleTitle(
  request: EntitySqliteNobleTitleRequest,
): Promise<boolean> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).addNobleTitle(request.entityId, request.input);
}

export async function updateEntitySqliteNobleTitle(
  request: EntitySqliteUpdateNobleTitleRequest,
): Promise<boolean> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).updateNobleTitle(
    request.entityId,
    request.key,
    request.input,
  );
}

export async function setEntitySqliteUserWorkAuthors(
  request: EntitySqliteSetUserWorkAuthorsRequest,
): Promise<void> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  repositoryFor(request.databasePath).setUserWorkAuthors(request);
}

export async function attachEntitySqliteAuthority(
  request: EntitySqliteAuthorityRefRequest,
): Promise<boolean> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).attachAuthority(request);
}

export async function decoupleEntitySqliteAuthority(
  request: EntitySqliteAuthorityRefRequest,
): Promise<number> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).decoupleAuthority(request);
}

export async function rejectEntitySqliteAssertion(
  request: EntitySqliteAssertionRequest,
): Promise<boolean> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).rejectAssertion(request.entityId, request.key);
}

export async function restoreEntitySqliteAssertion(
  request: EntitySqliteAssertionRequest,
): Promise<boolean> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).restoreAssertion(request.entityId, request.key);
}

export async function removeEntitySqliteAssertion(
  request: EntitySqliteAssertionRequest,
): Promise<boolean> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).removeAssertion(request.entityId, request.key);
}

export async function validateEntitySqliteAssertion(
  request: EntitySqliteAssertionRequest,
): Promise<boolean> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).validateAssertion(request.entityId, request.key);
}

export async function acceptEntitySqliteDateAssertion(
  request: EntitySqliteAssertionRequest,
): Promise<boolean> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).acceptDateAssertion(request.entityId, request.key);
}

export async function acceptEntitySqliteDescriptionAssertion(
  request: EntitySqliteAssertionRequest,
): Promise<boolean> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).acceptDescriptionAssertion(
    request.entityId,
    request.key,
  );
}

export async function renameEntitySqlitePrimaryName(
  request: EntitySqliteRenamePrimaryNameRequest,
): Promise<boolean> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).renamePrimaryName(request.entityId, request.text);
}

export async function setEntitySqliteRomanizedName(
  request: EntitySqliteSetRomanizedNameRequest,
): Promise<void> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  repositoryFor(request.databasePath).setRomanizedName(
    request.entityId,
    request.text,
    request.language,
  );
}

export async function autoCleanEntitySqliteNames(
  request: EntitySqliteAutoCleanNamesRequest,
): Promise<EntitySqliteAutoCleanNamesResult> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).autoCleanNames();
}

export async function softDeleteEntitySqlite(
  request: EntitySqliteSoftDeleteRequest,
): Promise<boolean> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).softDeleteEntity(request.entityId);
}

export async function mergeEntitySqlite(
  request: EntitySqliteMergeRequest,
): Promise<SqliteMergeResult> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).mergeEntities(request.keepId, request.dropIds);
}

export async function createEntitySqliteRelation(
  request: EntitySqliteCreateRelationRequest,
): Promise<number> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).createRelation({
    subjectEntityId: request.subjectEntityId,
    objectEntityId: request.objectEntityId,
    relationType: request.relationType,
    symmetric: request.symmetric,
    reference: request.reference,
  });
}

export async function listEntitySqliteRelations(
  request: EntitySqliteListRelationsRequest,
): Promise<SqliteEntityRelation[]> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).listRelationsForEntity(request.entityId);
}

export async function updateEntitySqliteRelationStatus(
  request: EntitySqliteUpdateRelationStatusRequest,
): Promise<boolean> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).updateRelationStatus(
    request.relationId,
    request.status,
  );
}

export async function createPopulatedEntitySqlite(
  request: EntitySqliteCreatePopulatedRequest,
): Promise<unknown> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  const { databasePath: _databasePath, ...input } = request;
  return repositoryFor(request.databasePath).createPopulatedEntity(input);
}

export async function applyEntitySqliteAuthorityBackfillPatch(
  request: AuthorityBackfillPatch & { databasePath: string },
): Promise<AuthorityBackfillPatchResult> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  const { databasePath: _databasePath, ...patch } = request;
  return repositoryFor(request.databasePath).applyAuthorityBackfillPatch(patch);
}

export async function reconcileEntitySqliteXmlExtractedData(
  request: XmlExtractedRefreshInput & { databasePath: string },
): Promise<XmlExtractedRefreshResult> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  const { databasePath: _databasePath, ...input } = request;
  return repositoryFor(request.databasePath).reconcileXmlExtractedData(input);
}

export async function getEntitySqliteContentHash(request: {
  databasePath: string;
  entityId: string;
}): Promise<string | null> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  try {
    await fs.access(request.databasePath);
  } catch {
    return null;
  }
  return computeEntityContentHash(repositoryFor(request.databasePath), request.entityId);
}

export async function replaceEntitySqliteContent(request: {
  sourceDatabasePath: string;
  sourceEntityId: string;
  targetDatabasePath: string;
  targetEntityId: string;
}): Promise<{ changed: boolean }> {
  if (
    !validDatabasePath(request.sourceDatabasePath) ||
    !validDatabasePath(request.targetDatabasePath)
  ) {
    throw new Error('Invalid entity SQLite database path.');
  }
  const source = repositoryFor(request.sourceDatabasePath);
  const target = repositoryFor(request.targetDatabasePath);
  const result = replaceEntityContentBetween(
    source,
    request.sourceEntityId,
    target,
    request.targetEntityId,
  );
  return { changed: result.changed };
}

export async function getEntitySqliteCentralId(
  request: EntitySqliteGetCentralIdRequest,
): Promise<string | null> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  try {
    await fs.access(request.databasePath);
  } catch {
    return null;
  }
  return repositoryFor(request.databasePath).getCentralId(request.entityId, request.userStableId);
}

export async function setEntitySqliteCentralMapping(
  request: EntitySqliteSetCentralMappingRequest,
): Promise<boolean> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).setCentralMapping(
    request.entityId,
    request.userStableId,
    request.centralId,
  );
}

export async function clearEntitySqliteCentralMapping(
  request: EntitySqliteGetCentralIdRequest,
): Promise<boolean> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).clearCentralMapping(
    request.entityId,
    request.userStableId,
  );
}

export async function listEntitySqliteMappingsByCentralIds(request: {
  databasePath: string;
  userStableId: string;
  centralIds: string[];
}): Promise<{ projectEntityId: string; centralId: string; label: string | null }[]> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  try {
    await fs.access(request.databasePath);
  } catch {
    return [];
  }
  return repositoryFor(request.databasePath).listMappingsByCentralIds(
    request.userStableId,
    request.centralIds,
  );
}

export async function listEntitySqliteAllCentralMappings(request: {
  databasePath: string;
  userStableId: string;
}): Promise<{ projectEntityId: string; centralId: string }[]> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  try {
    await fs.access(request.databasePath);
  } catch {
    return [];
  }
  return repositoryFor(request.databasePath).listAllCentralMappingsForUser(request.userStableId);
}

export async function listEntitySqliteLinkedCentralIds(request: {
  databasePath: string;
  userStableId: string;
}): Promise<string[] | null> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  try {
    await fs.access(request.databasePath);
  } catch {
    return null;
  }
  return repositoryFor(request.databasePath).listLinkedCentralIds(request.userStableId);
}

export async function countEntitySqliteUnlinked(request: {
  databasePath: string;
  userStableId: string;
}): Promise<number | null> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  try {
    await fs.access(request.databasePath);
  } catch {
    return null;
  }
  return repositoryFor(request.databasePath).countUnlinkedForUser(request.userStableId);
}

export async function countEntitySqliteEntities(request: {
  databasePath: string;
}): Promise<number | null> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  try {
    await fs.access(request.databasePath);
  } catch {
    return null;
  }
  return repositoryFor(request.databasePath).countActiveEntities();
}

export async function findEntitySqliteByAuthority(
  request: EntitySqliteFindByAuthorityRequest,
): Promise<string[]> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  try {
    await fs.access(request.databasePath);
  } catch {
    return [];
  }
  return repositoryFor(request.databasePath).findAllEntityIdsByAuthority(
    request.kind,
    request.type,
    request.value,
  );
}

export async function findEntitySqliteByNameDates(
  request: EntitySqliteFindByNameDatesRequest,
): Promise<string | null> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  try {
    await fs.access(request.databasePath);
  } catch {
    return null;
  }
  return repositoryFor(request.databasePath).findEntityIdByNameDates(
    request.kind,
    request.name,
    request.startYear,
    request.endYear,
  );
}

export async function forceRejectEntitySqliteAssertion(
  request: EntitySqliteForceRejectAssertionRequest,
): Promise<boolean> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return repositoryFor(request.databasePath).forceRejectAssertion(request.entityId, request.key);
}

export async function exportEntitySqliteXml(
  request: EntitySqliteXmlRequest,
): Promise<string | null> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  try {
    await fs.access(request.databasePath);
  } catch {
    return null;
  }
  return exportEntitiesXml(repositoryFor(request.databasePath));
}

export async function importEntitySqliteXml(
  request: EntitySqliteImportXmlRequest,
): Promise<XmlImportReport> {
  if (!validDatabasePath(request.databasePath))
    throw new Error('Invalid entity SQLite database path.');
  return importEntitiesXml(repositoryFor(request.databasePath), request.xml, { replace: true });
}

export function closeEntitySqliteReadRepositories(): void {
  for (const repository of repositories.values()) repository.close();
  repositories.clear();
}
