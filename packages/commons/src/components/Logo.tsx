import { Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import Box, { BoxProps } from '@mui/material/Box';
import React, { FC } from 'react';

interface LogoProps extends BoxProps {
  height?: string | number;
  type?: 'standard' | 'icon';
}

const Logo: FC<LogoProps> = ({ height = 'auto', type = 'standard', ...props }) => {
  const { breakpoints, palette } = useTheme();
  const isMobile = useMediaQuery(breakpoints.down('sm'));
  const filename = palette.mode === 'dark' ? 'cwrclogo-white.png' : 'cwrclogo-black.png';

  return (
    <Box {...props}>
      {type === 'standard' ? (
        <Stack direction="row">
          <img alt="Leaf-Writer" height={height} src={`/assets/logo/${filename}`} />
          <Typography
            component="h1"
            sx={{ ml: '1rem', fontWeight: 400 }}
            variant={isMobile ? 'h4' : 'h2'}
          >
            LEAF-Writer
          </Typography>
        </Stack>
      ) : (
        <img alt="Leaf-Writer" height={height} src={`/assets/logo/${filename}`} />
      )}
    </Box>
  );
};

export default Logo;
