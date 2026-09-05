import DeleteIcon from '@mui/icons-material/Delete';
import {
  Box,
  CircularProgress,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EntityKind } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entities';
import { entityStoreFromDesktop } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityStore';
import { EntityLookupField, type EntityLookupValue } from '../EntityLookupField';

interface RelationTypeDef {
  id: string;
  activeLabelKey: string;
  passiveLabelKey: string;
  symmetric: boolean;
}

/** Fixed starter vocabulary — domain-neutral, not specific to any one entity kind. */
const RELATION_TYPES: RelationTypeDef[] = [
  {
    id: 'broader',
    activeLabelKey: 'LWC.desktop.sidebar.database.relations.broader_active',
    passiveLabelKey: 'LWC.desktop.sidebar.database.relations.broader_passive',
    symmetric: false,
  },
  {
    id: 'influence',
    activeLabelKey: 'LWC.desktop.sidebar.database.relations.influence_active',
    passiveLabelKey: 'LWC.desktop.sidebar.database.relations.influence_passive',
    symmetric: false,
  },
  {
    id: 'discussion',
    activeLabelKey: 'LWC.desktop.sidebar.database.relations.discussion_active',
    passiveLabelKey: 'LWC.desktop.sidebar.database.relations.discussion_passive',
    symmetric: false,
  },
  {
    id: 'association',
    activeLabelKey: 'LWC.desktop.sidebar.database.relations.association_active',
    passiveLabelKey: 'LWC.desktop.sidebar.database.relations.association_passive',
    symmetric: true,
  },
];

const TARGET_KIND_OPTIONS: EntityKind[] = ['thing', 'person', 'place', 'org', 'work', 'office'];

/** Matches `teiTagForCandidate` in autoTagging/authority.ts — drives which packs/lists get searched. */
const LOOKUP_TAG_FOR_KIND: Record<EntityKind, string> = {
  person: 'persName',
  place: 'placeName',
  org: 'orgName',
  work: 'title',
  office: 'roleName',
  thing: 'rs',
};

const entityTypeLabelKey = (kind: EntityKind): string =>
  `LWC.desktop.sidebar.database.entity_types.${kind === 'org' ? 'organization' : kind}`;

interface RelationRow {
  id: number;
  relationType: string;
  isSubject: boolean;
  otherEntityId: string | null;
  otherEntityName: string | null;
}

interface EntityRelationsEditorProps {
  entityId: string;
  disabled?: boolean;
}

/**
 * Typed cross-entity relations (subject → object, e.g. "influenced" /
 * "influenced by"), backed by the generic `entity_relations` table. Create,
 * list (both directions), and soft-remove only — no in-place type edits and
 * no graph view in this first pass.
 */
export const EntityRelationsEditor = ({ entityId, disabled }: EntityRelationsEditorProps) => {
  const { t } = useTranslation();
  const [relations, setRelations] = useState<RelationRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [relationType, setRelationType] = useState(RELATION_TYPES[0]!.id);
  const [targetKind, setTargetKind] = useState<EntityKind>('thing');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const store = entityStoreFromDesktop();
    if (!store) return;
    setLoading(true);
    try {
      const rows = await store.sqliteListRelations(entityId);
      setRelations(rows);
    } catch {
      setError(t('LWC.desktop.sidebar.database.relations.load_failed'));
    } finally {
      setLoading(false);
    }
  }, [entityId, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeDef = RELATION_TYPES.find((def) => def.id === relationType) ?? RELATION_TYPES[0]!;

  const handlePicked = useCallback(
    (value: EntityLookupValue) => {
      if (!value.key || value.key === entityId) return;
      void (async () => {
        const store = entityStoreFromDesktop();
        if (!store) return;
        setError(null);
        try {
          await store.sqliteCreateRelation({
            subjectEntityId: entityId,
            objectEntityId: value.key!,
            relationType,
            symmetric: activeDef.symmetric,
          });
          await refresh();
        } catch {
          setError(t('LWC.desktop.sidebar.database.relations.add_failed'));
        }
      })();
    },
    [activeDef.symmetric, entityId, refresh, relationType, t],
  );

  const handleRemove = useCallback(
    (relationId: number) => {
      void (async () => {
        const store = entityStoreFromDesktop();
        if (!store) return;
        try {
          await store.sqliteUpdateRelationStatus(relationId, 'withdrawn');
          await refresh();
        } catch {
          setError(t('LWC.desktop.sidebar.database.relations.remove_failed'));
        }
      })();
    },
    [refresh, t],
  );

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
        {t('LWC.desktop.sidebar.database.relations.title')}
      </Typography>

      {loading && <CircularProgress size={16} sx={{ my: 1, display: 'block' }} />}

      {!loading && relations && relations.length > 0 && (
        <Stack spacing={0.5} sx={{ mb: 1 }}>
          {relations.map((relation) => {
            const def = RELATION_TYPES.find((candidate) => candidate.id === relation.relationType);
            const label = def
              ? t(relation.isSubject ? def.activeLabelKey : def.passiveLabelKey)
              : relation.relationType;
            return (
              <Stack key={relation.id} direction="row" alignItems="center" spacing={0.5}>
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {label} — {relation.otherEntityName ?? relation.otherEntityId}
                </Typography>
                <Tooltip title={t('LWC.desktop.sidebar.database.relations.remove')}>
                  <span>
                    <IconButton
                      size="small"
                      disabled={disabled}
                      onClick={() => handleRemove(relation.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            );
          })}
        </Stack>
      )}

      {error && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mb: 0.5 }}>
          {error}
        </Typography>
      )}

      <Stack direction="row" spacing={0.5} sx={{ mb: 0.5 }}>
        <TextField
          select
          size="small"
          label={t('LWC.desktop.sidebar.database.relations.type_label')}
          value={relationType}
          onChange={(event) => setRelationType(event.target.value)}
          disabled={disabled}
          sx={{ minWidth: 140 }}
        >
          {RELATION_TYPES.map((def) => (
            <MenuItem key={def.id} value={def.id}>
              {t(def.activeLabelKey)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t('LWC.desktop.sidebar.database.relations.target_kind_label')}
          value={targetKind}
          onChange={(event) => setTargetKind(event.target.value as EntityKind)}
          disabled={disabled}
          sx={{ minWidth: 120 }}
        >
          {TARGET_KIND_OPTIONS.map((kind) => (
            <MenuItem key={kind} value={kind}>
              {t(entityTypeLabelKey(kind))}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <EntityLookupField
        kind={targetKind}
        tag={LOOKUP_TAG_FOR_KIND[targetKind]}
        label={t('LWC.desktop.sidebar.database.relations.add_target_label')}
        mode="single"
        values={[]}
        disabled={disabled}
        onChange={() => {}}
        onPersistedChange={handlePicked}
      />
    </Box>
  );
};
