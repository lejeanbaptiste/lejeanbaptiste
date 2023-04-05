import { GridViewRounded, ViewStream } from '@mui/icons-material';
import {
  Divider,
  Icon,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { AnimationControls, motion, type Variants } from 'framer-motion';
import React, { type MouseEvent } from 'react';
import { Layout } from '..';

const ENABLE_GRID = true;

interface TopBarProps {
  animationControl?: AnimationControls;
  layout?: Layout;
  onLayoutChange: (value: Layout) => void;
  title?: string;
}

const StyledToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
  '& .MuiToggleButtonGroup-grouped': {
    margin: theme.spacing(0.5),
    border: 0,
    '&.Mui-disabled': {
      border: 0,
    },
    '&:not(:first-of-type)': {
      borderRadius: theme.shape.borderRadius,
    },
    '&:first-of-type': {
      borderRadius: theme.shape.borderRadius,
    },
  },
}));

export const TopBar = ({
  animationControl,
  layout = 'list',
  onLayoutChange,
  title,
}: TopBarProps) => {
  const changeLayout = (_event: MouseEvent<HTMLElement>, value: Layout) => {
    if (!value) return;
    onLayoutChange(value);
  };

  const isLoading = !title;

  const titleVariants: Variants = {
    show: { y: 0, opacity: 1 },
    hide: { y: 28, opacity: 0 },
  };

  const options = [
    { icon: ViewStream, value: 'list' },
    { icon: GridViewRounded, value: 'grid' },
  ];

  return (
    <Stack>
      <Stack direction="row" justifyContent="space-between" overflow="hidden" height={28} px={1}>
        <Typography
          fontWeight={700}
          letterSpacing=".15rem"
          textTransform="uppercase"
          ml={1}
          minWidth={100}
          variant="subtitle1"
          component={motion.p}
          animate={animationControl}
          variants={titleVariants}
        >
          {isLoading ? <Skeleton variant="rounded" height={24} width={100} /> : title}
        </Typography>

        {ENABLE_GRID && !isLoading && (
          <Stack direction="row">
            <StyledToggleButtonGroup
              exclusive
              aria-label="layout"
              size="small"
              onChange={changeLayout}
              value={layout}
            >
              {options.map(({ icon, value }) => (
                <ToggleButton key={value} aria-label={value} color="primary" value={value}>
                  <Icon component={icon} fontSize="inherit" />
                </ToggleButton>
              ))}
            </StyledToggleButtonGroup>
          </Stack>
        )}
      </Stack>
      <Divider
        sx={{
          borderColor: '#999',
          boxShadow: '2px 0px 2px 0px rgb(0 0 0 / 15%)',
        }}
      />
    </Stack>
  );
};
