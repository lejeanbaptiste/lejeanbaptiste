import { Box, TextField } from '@mui/material';
import { useField } from 'formik';
import type { LocalAuthorityServiceConfig } from '../../../types';

export const BasicInformation = ({ editing = false }: { editing?: boolean }) => {
  const [name_field, name_meta] = useField<LocalAuthorityServiceConfig['name']>('name');
  const [description_field] = useField<LocalAuthorityServiceConfig['description']>('description');

  return (
    <Box>
      <TextField
        autoFocus
        disabled={editing}
        error={name_meta.touched && Boolean(name_meta.error)}
        helperText={name_meta.error ?? ' '}
        id="name"
        label="Name"
        margin="dense"
        name="name"
        onBlur={name_field.onBlur}
        onChange={name_field.onChange}
        required
        size="small"
        sx={{ minWidth: 300 }}
        type="text"
        variant="outlined"
        value={name_field.value}
      />
      <TextField
        fullWidth
        id="description"
        label="Description"
        margin="dense"
        minRows={3}
        multiline
        name="description"
        onChange={description_field.onChange}
        size="small"
        type="text"
        variant="outlined"
        value={description_field.value}
      />
    </Box>
  );
};
