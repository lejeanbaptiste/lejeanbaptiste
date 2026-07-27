import { Alert, Box, Button, CircularProgress, LinearProgress, ListItem, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import {
  isConfiguredMapTileBundle,
  REGIONAL_BUNDLES,
  type MapTileBundleSpec,
} from '../../../../autoTagging/mapView/regionalBundles';

const MAP_TILES_ATTRIBUTION =
  'Basemap data © OpenStreetMap contributors, made available under the Open Database License (ODbL), via Protomaps (protomaps.com).';

type RegionStatus = { id: string; sha256: string; installedAt: string };
type DownloadState = {
  bundleId: string;
  message: string;
  receivedBytes?: number;
  totalBytes?: number | null;
};

export const DesktopMapTilesSettings = () => {
  const [regions, setRegions] = useState<RegionStatus[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const [error, setError] = useState<{ id: string; text: string } | null>(null);
  const [completion, setCompletion] = useState<{ id: string; text: string; severity: 'success' | 'error' } | null>(null);

  const refresh = useCallback(async () => {
    const status = await window.electronAPI?.mapTilesStatus?.();
    setRegions(status?.regions ?? []);
  }, []);

  useEffect(() => {
    void refresh();
    const api = window.electronAPI;
    const disposers: Array<() => void> = [];
    const hydrateDownloads = async () => {
      const snapshot = await api?.mapTilesDownloadStatus?.();
      const next: Record<string, DownloadState> = {};
      for (const item of snapshot?.active ?? []) next[item.bundleId] = item;
      setDownloads(next);
      const activeBundleId = Object.keys(next)[0] ?? null;
      setBusyId(activeBundleId);
    };
    void hydrateDownloads();
    if (api?.onMapTilesProgress) {
      disposers.push(
        api.onMapTilesProgress((progress) => {
          setDownloads((current) => ({
            ...current,
            [progress.bundleId]: progress,
          }));
          setBusyId(progress.bundleId);
        }),
      );
    }
    if (api?.onMapTilesDownloadComplete) {
      disposers.push(
        api.onMapTilesDownloadComplete((result) => {
          setBusyId((current) => (current === result.bundleId ? null : current));
          setDownloads((current) => {
            const { [result.bundleId]: _removed, ...rest } = current;
            return rest;
          });
          if (result.installed) {
            setCompletion({ id: result.bundleId, text: 'Map tiles downloaded and ready for offline use.', severity: 'success' });
          } else {
            setCompletion({ id: result.bundleId, text: result.error ?? 'Map tile download failed.', severity: 'error' });
          }
          void refresh();
        }),
      );
    }
    return () => disposers.forEach((dispose) => dispose());
  }, [refresh]);

  const handleDownload = async (bundle: MapTileBundleSpec) => {
    setError(null);
    setCompletion(null);
    setBusyId(bundle.id);
    try {
      const result = await window.electronAPI?.mapTilesDownloadBackground?.(bundle);
      if (!result?.ok) {
        setError({ id: bundle.id, text: result?.error ?? 'Map tile download is unavailable in this build.' });
        setBusyId(null);
      } else {
        setCompletion({
          id: bundle.id,
          text: 'Download started in the background. You’ll be notified when it finishes.',
          severity: 'success',
        });
      }
    } catch {
      setBusyId(null);
      setDownloads({});
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
          const download = downloads[bundle.id];
          const configured = isConfiguredMapTileBundle(bundle);
          const determinate = typeof download?.receivedBytes === 'number' && typeof download?.totalBytes === 'number' && download.totalBytes > 0;
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
                  disabled={working || !configured}
                  onClick={() => void handleDownload(bundle)}
                >
                  {installed ? 'Re-download' : configured ? 'Download' : 'Not configured'}
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
              {!configured && (
                <Typography variant="caption" color="text.secondary">
                  This bundle cannot be downloaded in the current desktop build.
                </Typography>
              )}
              {working && (
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    {determinate ? (
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, ((download?.receivedBytes ?? 0) / (download?.totalBytes ?? 1)) * 100)}
                        sx={{ flex: 1, height: 4, borderRadius: 1 }}
                      />
                    ) : (
                      <LinearProgress variant="indeterminate" sx={{ flex: 1, height: 4, borderRadius: 1 }} />
                    )}
                    <CircularProgress size={16} thickness={5} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {download?.message ?? 'Working in the background…'}
                    {determinate
                      ? ` ${Math.round(((download?.receivedBytes ?? 0) / (download?.totalBytes ?? 1)) * 100)}%`
                      : ''}
                  </Typography>
                </Box>
              )}
              {error?.id === bundle.id && (
                <Alert severity="error" sx={{ py: 0.25 }}>
                  {error.text}
                </Alert>
              )}
              {completion?.id === bundle.id && (
                <Alert severity={completion.severity} sx={{ py: 0.25 }}>
                  {completion.text}
                </Alert>
              )}
            </Stack>
          );
        })}
      </Stack>
    </ListItem>
  );
};
