import { Autocomplete, Chip, TextField } from '@mui/material';

interface AiTagChipPickerProps {
  options: string[];
  value: string[];
  disabled?: boolean;
  onChange: (tags: string[]) => void;
}

/** Multi-select tag field with schema-backed autocomplete and free-text entry. */
export function AiTagChipPicker({ options, value, disabled, onChange }: AiTagChipPickerProps) {
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
          label="Tag types"
          placeholder={value.length === 0 ? 'persName, placeName…' : undefined}
          helperText="Pick from the schema or type a tag name."
        />
      )}
    />
  );
}
