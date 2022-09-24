import SettingsIcon from '@mui/icons-material/Settings';
import {
  Icon,
  IconButton,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  useTheme,
} from '@mui/material';
import React, { FC, MouseEvent, useEffect, useRef, useState } from 'react';
import SettingsDialog from '../components/SettingsDialog';
import { useActions, useAppState } from '../overmind';
import type { StorageSource, SuportedProviders } from '../types';
import { getIcon } from '../utilities';

type Source = StorageSource | SuportedProviders;

const SidePanel: FC = () => {
  const theme = useTheme();
  const { name: providerName, providers } = useAppState().cloud;
  const { source, sources } = useAppState().common;
  const { changeProvider } = useActions().cloud;
  const { setSource } = useActions().common;
  const [active, setActive] = useState<Source>(source);
  const [openSettings, setOpenSettings] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    source === 'cloud' && providerName ? setActive(providerName) : setActive(source);
  }, []);

  useEffect(() => {
    source === 'cloud' && providerName ? setActive(providerName) : setActive(source);
  }, [source]);

  const handleChange = (_event: MouseEvent<HTMLElement>, value: string) => {
    if (!value) return;
    setActive(value as Source);

    const provider = providers.find((name) => name === value);
    const _source = provider ? 'cloud' : value;
    setSource(_source as StorageSource);

    if (provider) changeProvider(provider);
  };

  const handleOpenSettings = () => setOpenSettings(true);
  const handleCloseSettings = () => setOpenSettings(false);

  return (
    <Paper data-testid="source_panel" elevation={2} ref={container} square>
      <Stack alignItems="center" justifyContent="space-between" height="100%" pb={1}>
        <ToggleButtonGroup
          color="primary"
          exclusive
          onChange={handleChange}
          orientation="vertical"
          size="small"
          sx={{
            '& .MuiToggleButtonGroup-grouped': {
              margin: theme.spacing(0.5),
              border: 0,
              '&.Mui-disabled': { border: 0 },
              '&:not(:first-of-type)': { borderRadius: 1 },
              '&:first-of-type': { borderRadius: 1 },
            },
          }}
          value={active}
        >
          {sources.map(({ value, label, icon }) => (
            <ToggleButton data-testid={`source_panel-${value}`} key={value} value={value}>
              <Tooltip enterDelay={1000} placement="right" title={label}>
                <Icon component={getIcon(icon)} />
              </Tooltip>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <IconButton
          data-testid="source_panel-settings_button"
          onClick={handleOpenSettings}
          size="small"
          sx={{ borderRadius: 1 }}
          title="settings"
        >
          <SettingsIcon />
        </IconButton>
      </Stack>
      <SettingsDialog anchor={container.current} onDone={handleCloseSettings} open={openSettings} />
    </Paper>
  );
};

export default SidePanel;
