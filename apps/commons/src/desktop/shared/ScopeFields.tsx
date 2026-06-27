import { FormControl, InputLabel, MenuItem, Select, TextField } from '@mui/material';
import { SEARCH_SCOPE_LABELS, type SearchScope } from './searchScope';

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
}: ScopeFieldsProps) => (
  <>
    <FormControl fullWidth size="small">
      <InputLabel id={scopeLabelId}>Scope</InputLabel>
      <Select
        labelId={scopeLabelId}
        label="Scope"
        value={scope}
        onChange={(event) => onScopeChange(event.target.value as SearchScope)}
        sx={{ fontSize: '0.8125rem' }}
      >
        {(Object.keys(SEARCH_SCOPE_LABELS) as SearchScope[]).map((value) => (
          <MenuItem key={value} value={value} sx={{ fontSize: '0.8125rem' }}>
            {SEARCH_SCOPE_LABELS[value]}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
    {scope === 'custom' && (
      <TextField
        fullWidth
        size="small"
        placeholder="/path/to/folder"
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
