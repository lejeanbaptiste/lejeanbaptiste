import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material';
import { nanoid } from 'nanoid';
import { useState } from 'react';
import { useActions } from '../overmind';
import type { MissingAssetType } from '../../../../packages/cwrc-leafwriter/src/utilities/chineseAssetStatus';
import type { ChineseAssetsDialogProps } from './type';

const assetLabels: Record<MissingAssetType, string> = {
  authorityPacks: 'Authority packs',
  mapTiles: 'Map tiles',
  plugins: 'Language plugins',
  scriptNormalization: 'Script conversion (OpenCC)',
};

/** Desktop-hosted version of the Chinese optional-assets chooser.
 * It intentionally uses the commons dialog store, which is available before
 * the embedded LEAF-Writer editor has been initialized. */
export const ChineseAssetsDialog = ({
  missingAssets = [],
  id = nanoid(),
  onClose,
  open = true,
}: ChineseAssetsDialogProps) => {
  const { closeDialog } = useActions().ui;
  const [selected, setSelected] = useState<Set<MissingAssetType>>(new Set(missingAssets));

  const close = async (action: 'cancel' | 'download') => {
    closeDialog(id);
    await onClose?.(action, { selected: action === 'download' ? Array.from(selected) : [] });
  };

  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogTitle>Chinese Project Resources</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2}>
          <Typography variant="body2" color="textSecondary">
            Your project uses Chinese as its source language. Download the resources that will
            enhance your editing experience.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {missingAssets.map((asset) => (
              <FormControlLabel
                key={asset}
                control={
                  <Checkbox
                    checked={selected.has(asset)}
                    onChange={() =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (next.has(asset)) next.delete(asset);
                        else next.add(asset);
                        return next;
                      })
                    }
                  />
                }
                label={assetLabels[asset]}
              />
            ))}
          </Box>
          <Typography variant="caption" color="textSecondary">
            You can download these resources at any time from Settings.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => void close('cancel')} color="inherit">
          Skip
        </Button>
        <Button onClick={() => void close('download')} variant="contained">
          Download
        </Button>
      </DialogActions>
    </Dialog>
  );
};
