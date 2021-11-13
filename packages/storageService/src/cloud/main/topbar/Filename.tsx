import TuneIcon from '@mui/icons-material/Tune';
import {
  Box,
  IconButton,
  InputAdornment,
  InputBase,
  Paper,
  Stack,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { useActions, useAppState } from '../../../overmind';
import React, {
  ChangeEvent,
  FC,
  FocusEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState
} from 'react';
import { useTranslation } from 'react-i18next';
import SettingsDialog from '../../../components/SettingsDialog';

const Filename: FC = () => {
  const { t } = useTranslation();
  const { resource } = useAppState().common;
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

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    setFilename(inputValue);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    setValue(inputValue);
  };

  const handleKeyPress = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.code !== 'Enter') return;
    setFilename(value);
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
              <IconButton aria-label="open settings" onClick={handleOpenSettings} size="small">
                <TuneIcon fontSize="inherit" />
              </IconButton>
            </InputAdornment>
          }
          fullWidth
          id="filename"
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
        <SettingsDialog
          anchor={container.current}
          onDone={handleCloseSettings}
          open={openSettings}
        />
      )}
    </Stack>
  );
};

export default Filename;
