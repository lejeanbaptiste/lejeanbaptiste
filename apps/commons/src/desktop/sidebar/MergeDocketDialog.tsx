import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import type { NameField } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/reconcile';
import type { EntityStore } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityStore';
import { computeMergeDocket, resolveMergeSuggestion, type MergeDocketEntry, type MergeDocketSide } from '../entityDb/bridge';

interface Props {
  open: boolean;
  onClose: () => void;
  centralStore: EntityStore | null;
  /** Called after a suggestion is merged or ignored, so the parent can reload and update the badge count. */
  onChanged?: () => void;
}

const nameLabel = (name: NameField): string => (name.type ? `${name.text} (${name.type})` : name.text);

const dateLabel = (side: MergeDocketSide): string | null => {
  const { startYear, endYear } = side.fields;
  if (startYear == null && endYear == null) return null;
  return `${startYear ?? '?'}–${endYear ?? '?'}`;
};

const SideColumn = ({ side }: { side: MergeDocketSide }) => (
  <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
    <Typography variant="subtitle2" noWrap>
      {side.fields.names[0]?.text ?? side.id}
    </Typography>
    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
      {side.id}
    </Typography>

    <Box>
      <Typography variant="caption" color="text.secondary" component="div">
        Names
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={0.5}>
        {side.fields.names.length === 0 ? (
          <Typography variant="caption" color="text.disabled">
            —
          </Typography>
        ) : (
          side.fields.names.map((name, index) => (
            <Chip key={`${name.text}-${index}`} size="small" label={nameLabel(name)} />
          ))
        )}
      </Stack>
    </Box>

    {dateLabel(side) && (
      <Box>
        <Typography variant="caption" color="text.secondary" component="div">
          Dates
        </Typography>
        <Typography variant="body2">{dateLabel(side)}</Typography>
      </Box>
    )}

    {side.fields.description && (
      <Box>
        <Typography variant="caption" color="text.secondary" component="div">
          Description
        </Typography>
        <Typography variant="body2">{side.fields.description}</Typography>
      </Box>
    )}

    <Box>
      <Typography variant="caption" color="text.secondary" component="div">
        Linked authorities
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={0.5}>
        {side.fields.authorities.length === 0 ? (
          <Typography variant="caption" color="text.disabled">
            —
          </Typography>
        ) : (
          side.fields.authorities.map((auth, index) => (
            <Chip
              key={`${auth.type}-${auth.value}-${index}`}
              size="small"
              variant="outlined"
              label={`${auth.type}: ${auth.value}`}
            />
          ))
        )}
      </Stack>
    </Box>
  </Stack>
);

const DocketRow = ({
  entry,
  busy,
  onResolve,
}: {
  entry: MergeDocketEntry;
  busy: boolean;
  onResolve: (decision: { action: 'ignore' } | { action: 'merge'; keepId: string }) => void;
}) => {
  const [keepId, setKeepId] = useState(entry.sides[0].id);

  return (
    <Box sx={{ py: 1.5 }}>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
        These two central entities might be the same — a linked project merged their project-side
        counterparts.
      </Typography>
      <RadioGroup
        value={keepId}
        onChange={(event) => setKeepId(event.target.value)}
        sx={{ display: 'block' }}
      >
        <Stack direction="row" spacing={2}>
          {entry.sides.map((side) => (
            <Stack key={side.id} direction="row" spacing={0.5} alignItems="flex-start" sx={{ flex: 1, minWidth: 0 }}>
              <Radio size="small" value={side.id} sx={{ p: 0, mt: 0.25 }} />
              <SideColumn side={side} />
            </Stack>
          ))}
        </Stack>
      </RadioGroup>
      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
        <Button
          size="small"
          variant="contained"
          disabled={busy}
          onClick={() => onResolve({ action: 'merge', keepId })}
        >
          Merge, keep {keepId === entry.sides[0].id ? entry.sides[0].fields.names[0]?.text ?? entry.sides[0].id : entry.sides[1].fields.names[0]?.text ?? entry.sides[1].id}
        </Button>
        <Button size="small" variant="outlined" disabled={busy} onClick={() => onResolve({ action: 'ignore' })}>
          Ignore
        </Button>
      </Stack>
    </Box>
  );
};

/**
 * The merge docket: central-database merge suggestions raised when a linked
 * project merged two entities that mapped the same user to different
 * central ids. Nothing here is applied automatically — the user reviews a
 * side-by-side comparison and picks Merge (an ordinary central Absorb) or
 * Ignore (recorded, so it never resurfaces) for each.
 */
export const MergeDocketDialog = ({ open, onClose, centralStore, onChanged }: Props) => {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<MergeDocketEntry[]>([]);

  const refresh = useCallback(async () => {
    if (!centralStore) return;
    setLoading(true);
    setError(null);
    try {
      setEntries(await computeMergeDocket(centralStore));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [centralStore]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    void refresh();
  }, [open, refresh]);

  const resolve = async (
    suggestionId: string,
    decision: { action: 'ignore' } | { action: 'merge'; keepId: string; dropId: string },
  ) => {
    if (!centralStore) return;
    setBusy(true);
    setError(null);
    try {
      await resolveMergeSuggestion(centralStore, suggestionId, decision);
      await refresh();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Merge docket</DialogTitle>
      <DialogContent dividers>
        {!centralStore && <Alert severity="info">No central database folder is configured (App Settings).</Alert>}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {loading && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 2 }}>
            <CircularProgress size={18} />
            <Typography variant="body2">Loading…</Typography>
          </Stack>
        )}
        {!loading && centralStore && entries.length === 0 && !error && (
          <Typography variant="body2" color="text.secondary">
            Nothing pending — every merge suggestion has been reviewed.
          </Typography>
        )}
        {!loading &&
          entries.map((entry, index) => (
            <Box key={entry.suggestionId}>
              {index > 0 && <Divider />}
              <DocketRow
                entry={entry}
                busy={busy}
                onResolve={(decision) =>
                  void resolve(
                    entry.suggestionId,
                    decision.action === 'ignore'
                      ? { action: 'ignore' }
                      : {
                          action: 'merge',
                          keepId: decision.keepId,
                          dropId: entry.sides.find((side) => side.id !== decision.keepId)!.id,
                        },
                  )
                }
              />
            </Box>
          ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
