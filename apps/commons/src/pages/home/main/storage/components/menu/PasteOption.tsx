import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import { Stack, TextField, useTheme } from '@mui/material';
import { useActions } from '@src/overmind';
import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

interface PasteOptionProps {
  disabled?: boolean;
}

export const PasteOption = ({ disabled }: PasteOptionProps) => {
  const { t } = useTranslation();
  const { palette } = useTheme();

  const { openStorageDialog } = useActions().storage;

  const [pasteHover, setPasteHover] = useState(false);

  const onChageTextfield = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const pastedText = event.target.value;
    event.target.value = '';
    openStorageDialog({ resource: pastedText, source: 'paste', type: 'load' });
  };

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      py={1}
      pl={2}
      pr={1}
      onMouseOver={() => setPasteHover(true)}
      onMouseOut={() => setPasteHover(false)}
    >
      <ContentPasteIcon
        sx={{
          color: disabled
            ? palette.action.disabled
            : pasteHover
              ? palette.primary.light
              : 'text.secondary',
        }}
      />
      <TextField
        color="primary"
        disabled={disabled}
        InputLabelProps={{ sx: { fontSize: '0.8rem' } }}
        InputProps={{
          sx: {
            fontSize: '0.8rem',
            fieldset: {
              borderColor: `light-dark(${palette.grey[300]}, ${palette.grey[800]})`,
            },
          },
        }}
        label={t('LWC.storage.paste_your_XML_here')}
        onChange={onChageTextfield}
        size="small"
        sx={{
          '& fieldset': {
            borderColor: pasteHover ? palette.primary.main : 'inherit',
          },
        }}
      />
    </Stack>
  );
};
