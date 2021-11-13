import { Icon, Paper, ToggleButton, ToggleButtonGroup, Tooltip, useTheme } from '@mui/material';
import React, { FC, MouseEvent, useEffect, useState } from 'react';
import type { StorageSource, SuportedProviders } from '../@types/types';
import { useActions, useAppState } from '../overmind';
import { getIcon } from '../utilities/icons';

type Source = StorageSource | SuportedProviders;

const SidePanel: FC = () => {
  const theme = useTheme();
  const { name: providerName, providers } = useAppState().cloud;
  const { source, sources } = useAppState().common;
  const { changeProvider } = useActions().cloud;
  const { setSource } = useActions().common;
  const [active, setActive] = useState<Source>(source);

  useEffect(() => {
    source === 'cloud' && providerName ? setActive(providerName) : setActive(source);
  }, []);

  useEffect(() => {
    source === 'cloud' && providerName ? setActive(providerName) : setActive(source);
  }, [source]);

  const handleChange = (event: MouseEvent<HTMLElement>, value: string) => {
    if (!value) return;
    setActive(value as Source);

    const provider = providers.find((name) => name === value);
    const _source = provider ? 'cloud' : value;
    setSource(_source as StorageSource);

    if (provider) changeProvider(provider);
  };

  return (
    <Paper elevation={2} square>
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
    </Paper>
  );
};

export default SidePanel;
