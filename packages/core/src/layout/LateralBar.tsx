import { Icon, Paper, Stack, ToggleButton, Tooltip } from '@mui/material';
import React, { MouseEvent } from 'react';
import { ToggleButtonGroup } from '../components';
import { getIcon, IconLeafWriter } from '../icons';
import { useActions, useAppState } from '../overmind';
import type { PanelId, Side } from '../types';

type LateralBarProps = {
  side: Capitalize<Side>;
};

export const LateralBar = ({ side }: LateralBarProps) => {
  const { layout } = useAppState().ui;
  const { changePanel } = useActions().ui;

  const _side = side.toLowerCase() as Side;

  const handleChange = (event: MouseEvent<HTMLElement>, panelId: PanelId) => {
    changePanel({ side: _side, panelId });
  };

  return (
    <>
      {!layout[`outer${side}`]?.hide && (
        <Stack width={40}>
          <Paper
            elevation={5}
            square
            sx={{
              height: '100%',
              bgcolor: ({ palette }) =>
                palette.mode === 'dark' ? palette.background.paper : '#f5f5f5',
            }}
          >
            <ToggleButtonGroup
              exclusive
              onChange={handleChange}
              orientation="vertical"
              value={layout[_side]?.activePanel}
            >
              {layout[`outer${side}`]?.items.map(({ id, label }) => (
                <ToggleButton key={id} size="small" value={id}>
                  <Tooltip placement={side === 'Left' ? 'right' : 'left'} title={label}>
                    <Icon component={getIcon(id as IconLeafWriter)} fontSize="inherit" />
                  </Tooltip>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Paper>
        </Stack>
      )}
    </>
  );
};
