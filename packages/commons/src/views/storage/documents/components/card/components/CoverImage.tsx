import { Box, Stack, useTheme } from '@mui/material';
import { motion, type Variants } from 'framer-motion';
import React from 'react';

interface SampleCardProps {
  expanded: boolean;
  image: string;
  width?: number;
}

export const CoverImage = ({ expanded, image, width = 250 }: SampleCardProps) => {
  const { spacing } = useTheme();

  const screenshotVariant: Variants = {
    default: {
      width: width - width / 10,
      marginTop: spacing(1.5),
      paddingInline: spacing(1),
      height: 115,
      borderBottomLeftRadius: 4,
      borderBottomRightRadius: 4,
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
    },
    hover: {
      width: width,
      marginTop: 0,
      paddingInline: 0,
      height: 130,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      borderTopLeftRadius: 2,
      borderTopRightRadius: 2,
    },
  };

  return (
    <Stack width={width} alignItems="center" height={130} overflow="hidden">
      <Stack
        component={motion.div}
        overflow="hidden"
        initial={{ height: 0, y: 130 }}
        animate={{ height: 130, y: 0, transition: { delay: 0.5, type: 'tween' } }}
        exit={{ height: 0, y: 130, transition: { type: 'tween' } }}
      >
        <Box
          width={width - width / 10}
          height={115}
          mt={1.5}
          mx={1}
          sx={{
            borderTopLeftRadius: 4,
            borderTopRightRadius: 4,
            backgroundImage: `url(${image})`,
            backgroundPositionX: 'center',
            backgroundPositionY: 'top',
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
            boxShadow: 'rgb(189, 187, 187) 0px 0px 3px 0px',
          }}
          component={motion.div}
          variants={screenshotVariant}
          animate={expanded ? 'hover' : 'default'}
          initial="default"
        />
      </Stack>
    </Stack>
  );
};
