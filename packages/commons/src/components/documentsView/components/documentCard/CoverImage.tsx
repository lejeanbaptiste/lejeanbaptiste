import { Box, Stack, useTheme } from '@mui/material';
import { motion, type Variants } from 'framer-motion';
import React from 'react';

interface SampleCardProps {
  hover: boolean;
  image: string;
  width?: number;
}

export const CoverImage = ({ hover, image, width = 250 }: SampleCardProps) => {
  const { palette, spacing } = useTheme();

  const screenshotVariant: Variants = {
    default: { width: width - width / 10, marginTop: spacing(1.5), paddingInline: spacing(1) },
    hover: { width: width, marginTop: 0, paddingInline: 0 },
  };

  return (
    <Stack
      width={width}
      alignItems="center"
      sx={{
        backgroundColor: palette.mode === 'dark' ? palette.grey[800] : palette.grey[100],
      }}
      component={motion.div}
      overflow="hidden"
      initial={{ height: 0 }}
      animate={{ height: 130 }}
      exit={{ height: 0 }}
    >
      <Box
        width={width - width / 10}
        height={150}
        mt={1.5}
        mx={1}
        sx={{
          borderTopLeftRadius: 2,
          borderTopRightRadius: 2,
          backgroundImage: `url(${image})`,
          backgroundPositionX: 'center',
          backgroundPositionY: 'top',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
        }}
        component={motion.div}
        variants={screenshotVariant}
        animate={hover ? 'hover' : 'default'}
        initial="default"
      />
    </Stack>
  );
};
