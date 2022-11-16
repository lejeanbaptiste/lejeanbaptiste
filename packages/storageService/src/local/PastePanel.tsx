import { Box, TextField, useMediaQuery, useTheme } from '@mui/material';
import React, { ChangeEvent, FC, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../overmind';

export const PastePanel: FC = () => {
  const { t } = useTranslation();
  const { setResource } = useActions().local;
  const { resource } = useAppState().common;

  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [text, setText] = useState<string | undefined>('');
  const ref = useRef<HTMLTextAreaElement>();

  useEffect(() => {
    setText(resource?.content);
  }, []);

  const onChageOnPastePanel = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const text = event.target.value;
    setText(text);
    updateResource(text);
  };

  const updateResource = (text: string) => setResource({ content: text });

  return (
    <Box p={2}>
      <TextField
        autoFocus
        fullWidth
        inputRef={ref}
        inputProps={{
          'data-testid': 'paste_panel-input',
        }}
        multiline
        onChange={onChageOnPastePanel}
        placeholder={`${t('local:paste_document_here')}`}
        rows={mobile ? 0 : 19}
        value={text}
      />
    </Box>
  );
};
