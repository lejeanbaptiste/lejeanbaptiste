import { Box, TextField, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../overmind';

export const PastePanel = () => {
  const { setResource } = useActions().local;
  const { resource } = useAppState().common;

  const { t } = useTranslation('LWStorageService');

  const { breakpoints } = useTheme();
  const mobile = useMediaQuery(breakpoints.down('sm'));

  const [text, setText] = useState<string>('');
  const ref = useRef<HTMLTextAreaElement>();

  useEffect(() => {
    if (resource?.content) setText(resource.content);
  }, []);

  const onChageOnPastePanel = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const text = event.target.value;
    setText(text);
    setResource({ content: text });
  };

  return (
    <Box p={2}>
      <TextField
        autoFocus
        fullWidth
        inputRef={ref}
        inputProps={{ 'data-testid': 'paste_panel-input' }}
        multiline
        onChange={onChageOnPastePanel}
        placeholder={`${t('local.paste_document_here')}`}
        rows={mobile ? 0 : 19}
        value={text}
      />
    </Box>
  );
};
