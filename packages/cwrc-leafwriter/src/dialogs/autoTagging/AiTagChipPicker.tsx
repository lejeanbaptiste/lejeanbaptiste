import { Autocomplete, Chip, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface AiTagChipPickerProps {
  options: string[];
  value: string[];
  disabled?: boolean;
  onChange: (tags: string[]) => void;
}

/** Multi-select tag field with schema-backed autocomplete and free-text entry. */
export function AiTagChipPicker({ options, value, disabled, onChange }: AiTagChipPickerProps) {
  const { t } = useTranslation();

  return (
    <Autocomplete
      multiple
      freeSolo
      size="small"
      disabled={disabled}
      options={options}
      value={value}
      onChange={(_event, next) => {
        const tags = next
          .map((item) => (typeof item === 'string' ? item.trim() : item))
          .filter((item): item is string => Boolean(item));
        onChange([...new Set(tags)]);
      }}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => (
          <Chip {...getTagProps({ index })} key={`${option}-${index}`} label={option} size="small" />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={t('LW.autoTagging.tag_types')}
          placeholder={value.length === 0 ? t('LW.autoTagging.tag_types_placeholder') : undefined}
          helperText={t('LW.autoTagging.tag_types_helper')}
        />
      )}
    />
  );
}
