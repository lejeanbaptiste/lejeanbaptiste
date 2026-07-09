import {
  Alert,
  Box,
  Button,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { useAtom } from 'jotai';
import { RESET } from 'jotai/utils';
import { resolutionAtom } from './store';
import { useEntityLookup } from './useEntityLookup';

/**
 * Resolve-on-select interstitial: shown between picking an authority record
 * and closing the dialog when the record maps onto an existing entity
 * (confirm) or onto several (conflict chooser). No entities.xml write has
 * happened while this panel is up.
 */
export const ResolutionPanel = () => {
  const [resolution, setResolution] = useAtom(resolutionAtom);
  const { confirmPendingLink, linkWithoutDatabase, resolveConflict } = useEntityLookup();

  if (!resolution) return null;

  const cancel = () => setResolution(RESET);

  if (resolution.status === 'resolving') {
    return (
      <Box px={2} py={1}>
        <Typography color="textSecondary" variant="body2">
          Checking the entity database…
        </Typography>
        <LinearProgress sx={{ mt: 0.5 }} />
      </Box>
    );
  }

  if (resolution.status === 'confirm') {
    const { plan, input } = resolution;
    return (
      <Alert
        severity="info"
        sx={{ mx: 2, my: 1, alignItems: 'flex-start' }}
        action={
          <Stack direction="row" spacing={1}>
            <Button onClick={cancel} size="small">
              Cancel
            </Button>
            <Button
              onClick={() => void confirmPendingLink(input)}
              size="small"
              variant="contained"
            >
              Link
            </Button>
          </Stack>
        }
      >
        <Typography variant="body2">
          This record matches an existing entity:{' '}
          <strong>{plan.entityName}</strong>{' '}
          <Typography component="span" sx={{ fontFamily: 'monospace' }} variant="caption">
            ({plan.key})
          </Typography>
          {plan.description ? ` — ${plan.description}` : ''}
        </Typography>
        {plan.addIdnos.length > 0 && (
          <Typography color="textSecondary" variant="caption">
            Linking will also attach: {plan.addIdnos.map((idno) => `${idno.type} ${idno.value}`).join(', ')}
          </Typography>
        )}
      </Alert>
    );
  }

  if (resolution.status === 'conflict') {
    const { candidates, input } = resolution;
    return (
      <Alert severity="warning" sx={{ mx: 2, my: 1 }}>
        <Typography variant="body2">
          This record matches several entities in the database. Choose which one to link — the
          conflict will be flagged for curation in the entity panel.
        </Typography>
        <List dense disablePadding sx={{ mt: 0.5 }}>
          {candidates.map((candidate) => (
            <ListItemButton
              key={candidate.key}
              onClick={() =>
                void resolveConflict(candidate.key, candidate.name, candidates, input)
              }
              sx={{ borderRadius: 1 }}
            >
              <ListItemText
                primary={
                  <>
                    {candidate.name}{' '}
                    <Typography
                      component="span"
                      sx={{ fontFamily: 'monospace' }}
                      variant="caption"
                    >
                      ({candidate.key})
                    </Typography>
                  </>
                }
                secondary={candidate.description}
              />
            </ListItemButton>
          ))}
        </List>
        <Button onClick={cancel} size="small">
          Cancel
        </Button>
      </Alert>
    );
  }

  // error
  return (
    <Alert
      severity="error"
      sx={{ mx: 2, my: 1 }}
      action={
        <Stack direction="row" spacing={1}>
          <Button onClick={cancel} size="small">
            Cancel
          </Button>
          <Button onClick={linkWithoutDatabase} size="small">
            Link URI only
          </Button>
        </Stack>
      }
    >
      <Typography variant="body2">
        Could not update the entity database: {resolution.message}
      </Typography>
    </Alert>
  );
};
