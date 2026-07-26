import { Alert, Box, Button, LinearProgress, ListItem, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import {
  REGIONAL_BUNDLES,
  type MapTileBundleSpec,
} from '../../../../autoTagging/mapView/regionalBundles';

const MAP_TILES_ATTRIBUTION =
  'Basemap data © OpenStreetMap contributors, made available under the Open Database License (ODbL), via Protomaps (protomaps.com).';

type RegionStatus = { id: string; sha256: string; installedAt: string };

export const DesktopMapTilesSettings = () => {
  const [regions, setRegions] = useState<RegionStatus[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; text: string } | null>(null);

  const refresh = useCallback(async () => {
    const status = await window.electronAPI?.mapTilesStatus?.();
    setRegions(status?.regions ?? []);
  }, []);

  useEffect(() => {
    void refresh();
    const api = window.electronAPI;
    if (!api?.onMapTilesProgress) return;
    return api.onMapTilesProgress((progress) => setProgressMessage(progress.message));
  }, [refresh]);

  const handleDownload = async (bundle: MapTileBundleSpec) => {
    setError(null);
    setBusyId(bundle.id);
    try {
      const result = await window.electronAPI?.mapTilesDownload?.(bundle);
      if (!result?.ok) {
        setError({ id: bundle.id, text: result?.error ?? 'Map tile download is unavailable in this build.' });
      }
      await refresh();
    } finally {
      setBusyId(null);
      setProgressMessage(null);
    }
  };

  const handleRemove = async (bundle: MapTileBundleSpec) => {
    setError(null);
    setBusyId(bundle.id);
    try {
      const result = await window.electronAPI?.mapTilesRemove?.(bundle.id);
      if (!result?.ok) setError({ id: bundle.id, text: result?.error ?? 'Could not remove map tiles.' });
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', px: 0, py: 1.5 }}>
      <Stack spacing={1.5} width="100%">
        <Box>
          <Typography variant="subtitle2">Offline map tiles (optional)</Typography>
          <Typography variant="body2" color="text.secondary">
            Download a regional basemap for comparing place-name candidates on a map. Downloaded
            once, used entirely offline afterward.
          </Typography>
        </Box>

        <Alert severity="info" sx={{ py: 0.5 }}>
          {MAP_TILES_ATTRIBUTION}
        </Alert>

        {REGIONAL_BUNDLES.map((bundle) => {
          const installed = regions.find((r) => r.id === bundle.id);
          const working = busyId === bundle.id;
          return (
            <Stack key={bundle.id} spacing={0.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" sx={{ minWidth: 90 }}>
                  {bundle.label}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                  {installed
                    ? `installed · ${new Date(installed.installedAt).toLocaleDateString()}`
                    : 'not installed'}
                </Typography>
                <Button
                  size="small"
                  variant={installed ? 'outlined' : 'contained'}
                  disabled={working}
                  onClick={() => void handleDownload(bundle)}
                >
                  {installed ? 'Re-download' : 'Download'}
                </Button>
                {installed && (
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    disabled={working}
                    onClick={() => void handleRemove(bundle)}
                  >
                    Remove
                  </Button>
                )}
              </Stack>
              {working && progressMessage && (
                <Box>
                  <LinearProgress />
                  <Typography variant="caption" color="text.secondary">
                    {progressMessage}
                  </Typography>
                </Box>
              )}
              {error?.id === bundle.id && (
                <Alert severity="error" sx={{ py: 0.25 }}>
                  {error.text}
                </Alert>
              )}
            </Stack>
          );
        })}
      </Stack>
    </ListItem>
  );
};
