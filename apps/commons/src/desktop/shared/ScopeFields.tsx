import { FormControl, InputLabel, MenuItem, Select, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { SEARCH_SCOPE_LABEL_KEYS, type SearchScope } from './searchScope';

interface ScopeFieldsProps {
  customPath: string;
  onCustomPathChange: (value: string) => void;
  onEnter?: () => void;
  onScopeChange: (scope: SearchScope) => void;
  scope: SearchScope;
  scopeLabelId: string;
}

export const ScopeFields = ({
  scope,
  onScopeChange,
  customPath,
  onCustomPathChange,
  onEnter,
  scopeLabelId,
}: ScopeFieldsProps) => {
  const { t } = useTranslation();

  return (
    <>
      <FormControl fullWidth size="small">
        <InputLabel id={scopeLabelId}>{t('LWC.desktop.scope_fields.scope')}</InputLabel>
        <Select
          labelId={scopeLabelId}
          label={t('LWC.desktop.scope_fields.scope')}
          value={scope}
          onChange={(event) => onScopeChange(event.target.value as SearchScope)}
          sx={{ fontSize: '0.8125rem' }}
        >
          {(Object.keys(SEARCH_SCOPE_LABEL_KEYS) as SearchScope[]).map((value) => (
            <MenuItem key={value} value={value} sx={{ fontSize: '0.8125rem' }}>
              {t(SEARCH_SCOPE_LABEL_KEYS[value])}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {scope === 'custom' && (
        <TextField
          fullWidth
          size="small"
          placeholder={t('LWC.desktop.scope_fields.folder_placeholder')}
          value={customPath}
          onChange={(event) => onCustomPathChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onEnter?.();
          }}
          slotProps={{ input: { sx: { fontSize: '0.8125rem' } } }}
        />
      )}
    </>
  );
};
