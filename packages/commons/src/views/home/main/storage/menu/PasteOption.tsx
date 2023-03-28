import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import { Stack, TextField, useTheme } from '@mui/material';
import { useActions } from '@src/overmind';
import React, { useState, type ChangeEvent, type FC } from 'react';
import { useTranslation } from 'react-i18next';

interface PasteOptionProps {
  disabled?: boolean;
}

export const PasteOption = ({ disabled }: PasteOptionProps) => {
  const { openStorageDialog } = useActions().storage;

  const { t } = useTranslation('storage');
  const { palette } = useTheme();

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
        color={pasteHover ? 'primary' : 'inherit'}
        sx={{ color: disabled ? palette.action.disabled : 'inheritƒ' }}
      />
      <TextField
        color="primary"
        disabled={disabled}
        InputProps={{
          sx: {
            fontSize: '0.8rem',
            fieldset: {
              borderColor: ({ palette }) =>
                palette.mode === 'dark' ? palette.grey[800] : palette.grey[300],
            },
          },
        }}
        onChange={onChageTextfield}
        placeholder={`${t('commons:or')} ${t('paste_your_XML_here')}`}
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
