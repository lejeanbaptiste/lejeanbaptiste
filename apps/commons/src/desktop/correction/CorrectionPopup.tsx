import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Box,
  Button,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { CorrectionPopupMode } from './useCorrectionController';
import type { SchemaAttributeDetail } from '../tagging/attributeSuggestions';
import { useClampedPopupPosition } from '../tagging/clampPopupPosition';

export interface CorrectionPopupProps {
  addAttrName: string;
  anchor: { left: number; top: number } | null;
  availableAttributes: SchemaAttributeDetail[];
  cert: string;
  corrText: string;
  errorMessage: string | null;
  extraAttributes: Record<string, string>;
  mode: CorrectionPopupMode;
  onAddAttribute: () => void;
  onApply: () => void;
  onClose: () => void;
  onExtraAttributeChange: (name: string, value: string) => void;
  onRemoveAttribute: (name: string) => void;
  onRemoveMarkup: () => void;
  onPopupKeyDown: (event: React.KeyboardEvent) => void;
  open: boolean;
  setAddAttrName: (value: string) => void;
  setCert: (value: string) => void;
  setCorrText: (value: string) => void;
  sicText: string;
  typeLabel: string;
}

export const CorrectionPopup = ({
  addAttrName,
  anchor,
  availableAttributes,
  cert,
  corrText,
  errorMessage,
  extraAttributes,
  mode,
  onAddAttribute,
  onApply,
  onClose,
  onExtraAttributeChange,
  onRemoveAttribute,
  onRemoveMarkup,
  onPopupKeyDown,
  open,
  setAddAttrName,
  setCert,
  setCorrText,
  sicText,
  typeLabel,
}: CorrectionPopupProps) => {
  const { t } = useTranslation();
  const correctionInputRef = useRef<HTMLInputElement>(null);
  const extraAttrNames = Object.keys(extraAttributes);
  const { ref: popupRef, left, top } = useClampedPopupPosition(anchor, open, [
    addAttrName,
    availableAttributes.length,
    cert,
    corrText,
    errorMessage,
    extraAttrNames.length,
    mode,
  ]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => correctionInputRef.current?.focus());
    }
  }, [open]);

  if (!open || !anchor) return null;

  return (
    <Paper
      ref={popupRef}
      elevation={8}
      onKeyDown={onPopupKeyDown}
      sx={{
        position: 'fixed',
        left,
        top,
        zIndex: 1400,
        width: 300,
        maxHeight: 420,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          px: 1,
          py: 0.5,
        }}
      >
        <Typography variant="subtitle2">{t('LWC.desktop.correction.title')}</Typography>
        <IconButton size="small" onClick={onClose} aria-label={t('LWC.commons.close')}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Stack spacing={1} sx={{ p: 1, overflow: 'auto', flex: 1 }}>
        {errorMessage ? (
          <Alert severity="error" sx={{ py: 0, '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
            {errorMessage}
          </Alert>
        ) : null}

        <TextField
          fullWidth
          size="small"
          label={t('LWC.desktop.correction.selected_text')}
          value={sicText}
          InputProps={{ readOnly: true }}
          inputProps={{ 'aria-readonly': true }}
        />

        <TextField
          inputRef={correctionInputRef}
          fullWidth
          size="small"
          label={t('LWC.desktop.correction.correction')}
          value={corrText}
          onChange={(event) => setCorrText(event.target.value)}
          inputProps={{ autoComplete: 'off', spellCheck: 'true' }}
        />

        <TextField
          fullWidth
          size="small"
          label={t('LWC.desktop.correction.type')}
          value={typeLabel}
          InputProps={{ readOnly: true }}
          inputProps={{ 'aria-readonly': true }}
        />

        <TextField
          fullWidth
          size="small"
          label={t('LWC.desktop.correction.cert')}
          value={cert}
          onChange={(event) => setCert(event.target.value)}
          inputProps={{ autoComplete: 'off' }}
        />

        {extraAttrNames.map((name) => (
          <Box key={name} sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start' }}>
            <TextField
              fullWidth
              size="small"
              label={name}
              value={extraAttributes[name] ?? ''}
              onChange={(event) => onExtraAttributeChange(name, event.target.value)}
              inputProps={{ autoComplete: 'off' }}
            />
            <IconButton
              size="small"
              onClick={() => onRemoveAttribute(name)}
              aria-label={t('LWC.desktop.correction.remove_attribute', { name })}
              sx={{ mt: 0.5 }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}

        {availableAttributes.length > 0 ? (
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-end' }}>
            <TextField
              select
              fullWidth
              size="small"
              label={t('LWC.desktop.correction.add_attribute')}
              value={addAttrName}
              onChange={(event) => setAddAttrName(event.target.value)}
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">
                <em>{t('LWC.desktop.correction.choose_attribute')}</em>
              </MenuItem>
              {availableAttributes.map((attr) => (
                <MenuItem key={attr.name} value={attr.name} disabled={Boolean(attr.invalid)}>
                  {attr.name}
                </MenuItem>
              ))}
            </TextField>
            <Button
              size="small"
              variant="outlined"
              onClick={onAddAttribute}
              disabled={!addAttrName.trim()}
              sx={{ mb: 0.25, flexShrink: 0, fontSize: '0.7rem' }}
            >
              {t('LWC.desktop.correction.add')}
            </Button>
          </Box>
        ) : null}
      </Stack>

      <Box sx={{ p: 0.75, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        <Button size="small" variant="contained" onClick={onApply} sx={{ fontSize: '0.75rem' }}>
          {t('LWC.desktop.correction.ok')}
        </Button>
        <Button size="small" onClick={onClose} sx={{ fontSize: '0.75rem' }}>
          {t('LWC.desktop.correction.cancel')}
        </Button>
        {mode === 'edit' ? (
          <Button
            size="small"
            color="warning"
            onClick={onRemoveMarkup}
            sx={{ fontSize: '0.75rem', ml: 'auto' }}
          >
            {t('LWC.desktop.correction.remove_markup')}
          </Button>
        ) : null}
      </Box>
    </Paper>
  );
};
