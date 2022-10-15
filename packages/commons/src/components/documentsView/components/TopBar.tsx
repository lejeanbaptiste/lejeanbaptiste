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
import { AnimationControls, motion } from 'framer-motion';
import React, { type FC, type MouseEvent } from 'react';
import { DisplayLayout } from '..';

const ENABLE_GRID = true;

interface TopBarProps {
  animationControl?: AnimationControls;
  displayLayout?: DisplayLayout;
  onChangeDisplayLayout: (value: DisplayLayout) => void;
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

// const SMALL_WIDTH = 400;

export const TopBar: FC<TopBarProps> = ({
  animationControl,
  displayLayout = 'list',
  onChangeDisplayLayout,
  title,
}) => {
  const changeDisplayLayout = (_event: MouseEvent<HTMLElement>, value: DisplayLayout) => {
    if (!value) return;
    onChangeDisplayLayout(value);
  };

  const isLoading = !title;

  const titleVariants = {
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
              aria-label="display layout"
              size="small"
              onChange={changeDisplayLayout}
              value={displayLayout}
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
