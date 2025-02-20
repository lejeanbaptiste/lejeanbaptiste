import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import { Stack, TextField } from '@mui/material';
import { useActions } from '@src/overmind';
import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

interface PasteOptionProps {
  disabled?: boolean;
}

export const PasteOption = ({ disabled }: PasteOptionProps) => {
  const { t } = useTranslation();

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
        sx={[
          { color: (theme) => theme.vars.palette.text.secondary },
          !!disabled && { color: (theme) => theme.vars.palette.action.disabled },
          pasteHover && { color: (theme) => theme.vars.palette.primary.light },
        ]}
      />
      <TextField
        color="primary"
        disabled={disabled}
        label={t('LWC.storage.paste_your_XML_here')}
        onChange={onChageTextfield}
        size="small"
        slotProps={{
          input: {
            sx: [
              {
                fontSize: '0.8rem',
                fieldset: { borderColor: (theme) => theme.vars.palette.grey[800] },
              },
              (theme) =>
                theme.applyStyles('dark', {
                  fieldset: { borderColor: theme.vars.palette.grey[300] },
                }),
            ],
          },
          inputLabel: {
            sx: { fontSize: '0.8rem' },
          },
        }}
        sx={[
          pasteHover && {
            '& fieldset': { borderColor: (theme) => theme.vars.palette.primary.main },
          },
        ]}
      />
    </Stack>
  );
};
