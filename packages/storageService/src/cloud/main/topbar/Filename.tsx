import TuneIcon from '@mui/icons-material/Tune';
import {
  Box,
  IconButton,
  InputAdornment,
  InputBase,
  Paper,
  Stack,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, {
  type ChangeEvent,
  type FC,
  type FocusEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { SaveSettingsDialog } from '../../../dialogs';
import { useActions, useAppState } from '../../../overmind';

const Filename: FC = () => {
  const { t } = useTranslation();
  const { allowAllFileTypes, allowedFileTypes, resource } = useAppState().common;
  const { setFilename } = useActions().common;
  const { saveDocument } = useActions().cloud;
  const [value, setValue] = useState<string>('');
  const [openSettings, setOpenSettings] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  const theme = useTheme();
  const isSM = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    if (resource?.filename && resource.filename !== value) setValue(resource.filename);
  }, [resource?.filename]);

  useEffect(() => {
    setValue(resource?.filename ?? '');
  }, []);

  const addFileExtension = (fileName: string) => {
    if (allowAllFileTypes) return fileName;
    if (!allowedFileTypes || allowedFileTypes.length === 0) return fileName;

    //TODO saving wih different extension if allowed
    const extension = allowedFileTypes[0];

    if (fileName.endsWith(`.${extension}`)) return fileName;

    return `${fileName}.${extension}`;
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    const inputValue = addFileExtension(event.target.value);
    setFilename(inputValue);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    let inputValue = event.target.value;
    setValue(inputValue);
  };

  const handleKeyPress = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.code !== 'Enter') return;
    const inputValue = addFileExtension(value);
    setFilename(inputValue);
    await saveDocument();
  };

  const handleOpenSettings = () => setOpenSettings(true);
  const handleCloseSettings = () => setOpenSettings(false);

  return (
    <Stack direction="row" pb={0.5}>
      <Box flexGrow={1} />
      <Paper ref={container} elevation={3} sx={{ p: 0.5, width: isSM ? '100%' : 400 }}>
        <InputBase
          endAdornment={
            <InputAdornment position="end">
              <IconButton
                aria-label="open settings"
                onClick={handleOpenSettings}
                size="small"
                data-testid="save:open-settings-button"
              >
                <TuneIcon fontSize="inherit" />
              </IconButton>
            </InputAdornment>
          }
          fullWidth
          id="filename"
          inputProps={{ 'data-testid': 'save:filename-input' }}
          onBlur={handleBlur}
          onChange={handleChange}
          onKeyPress={handleKeyPress}
          placeholder={t('cloud:breadcrumbs:filename')}
          sx={{ px: 1.5, flex: 1 }}
          value={value}
        />
      </Paper>
      <Box flexGrow={1} />
      {openSettings && (
        <SaveSettingsDialog
          anchor={container.current}
          onDone={handleCloseSettings}
          open={openSettings}
        />
      )}
    </Stack>
  );
};

export default Filename;
