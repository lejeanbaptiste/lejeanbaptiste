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
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { nanoid } from 'nanoid';
import { useActions } from '../../overmind';
import type { ChineseAssetsDialogProps } from '../type';
import type { MissingAssetType } from '../../utilities/chineseAssetStatus';

const assetLabels: Record<MissingAssetType, { en: string; zh: string }> = {
  authorityPacks: { en: 'Authority packs', zh: '权威人物数据库' },
  mapTiles: { en: 'Map tiles', zh: '地图瓦片' },
  plugins: { en: 'Language plugins', zh: '语言插件' },
  scriptNormalization: {
    en: 'Script conversion (OpenCC — Hans & shinjitai)',
    zh: '字形转换（OpenCC — 简繁与日文新字体）',
  },
};

export const ChineseAssetsDialog = ({
  missingAssets = [],
  id = nanoid(),
  onClose,
  open = true,
}: ChineseAssetsDialogProps) => {
  const { i18n } = useTranslation();
  const { closeDialog } = useActions().ui;
  const [selected, setSelected] = useState<Set<MissingAssetType>>(new Set(missingAssets));

  const isZh = i18n.language.startsWith('zh');

  const handleToggle = (asset: MissingAssetType) => {
    const newSelected = new Set(selected);
    if (newSelected.has(asset)) {
      newSelected.delete(asset);
    } else {
      newSelected.add(asset);
    }
    setSelected(newSelected);
  };

  const handleDownload = async () => {
    closeDialog(id);
    await onClose?.('download', { selected: Array.from(selected) });
  };

  const handleCancel = async () => {
    closeDialog(id);
    await onClose?.('cancel', { selected: [] });
  };

  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogTitle>{isZh ? '中文项目资源下载' : 'Chinese Project Resources'}</DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2}>
          <Typography variant="body2" color="textSecondary">
            {isZh
              ? '您打开的项目使用中文作为源语言。以下资源将增强编辑体验：'
              : 'Your project uses Chinese as the source language. The following resources will enhance your editing experience:'}
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {missingAssets.map((asset) => (
              <FormControlLabel
                key={asset}
                control={
                  <Checkbox checked={selected.has(asset)} onChange={() => handleToggle(asset)} />
                }
                label={isZh ? assetLabels[asset].zh : assetLabels[asset].en}
              />
            ))}
          </Box>

          <Typography variant="caption" color="textSecondary">
            {isZh
              ? '您可以随时从"设置"菜单中下载这些资源。'
              : 'You can download these resources anytime from the Settings menu.'}
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCancel} color="inherit">
          {isZh ? '跳过' : 'Skip'}
        </Button>
        <Button onClick={handleDownload} variant="contained" color="primary">
          {isZh ? '下载' : 'Download'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
