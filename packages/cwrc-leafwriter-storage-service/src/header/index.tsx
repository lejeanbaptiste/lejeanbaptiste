import { Box, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { useAnimate } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppState } from '../overmind';

interface Props {
  label?: string;
}

export const Header = ({ label }: Props) => {
  const { name: providerName } = useAppState().cloud;
  const { dialogType, source } = useAppState().common;
  const [scope, animate] = useAnimate<HTMLSpanElement>();

  const { t } = useTranslation();

  const [title, setTitle] = useState('');

  useEffect(() => {
    if (scope.current) changeTitle();
  }, [source, providerName]);

  const changeTitle = async () => {
    if (!scope.current) return;
    await animate(scope.current!, { x: -100 });

    setTitle(source === 'cloud' && providerName ? providerName : source);

    if (!scope.current) return;
    animate(scope.current!, { x: 0 });
  };

  return (
    <Grid container alignItems="center" data-testid="header" px={2} py={1} minHeight={49}>
      <Grid size={{ xs: 4 }}>
        <Typography
          ref={scope}
          data-testid="header-source"
          sx={{ textTransform: 'capitalize' }}
          variant="subtitle1"
        >
          {title}
        </Typography>
      </Grid>

      <Grid size={{ xs: 4 }}>
        <Typography
          color="primary"
          data-testid="header-dialog-title"
          sx={{ textTransform: 'capitalize' }}
          textAlign="center"
          variant="h6"
        >
          {label ? label : t(`SS.commons.${dialogType}`)}
        </Typography>
      </Grid>

      <Grid size={{ xs: 4 }}>
        <Box flexGrow={1} />
      </Grid>
    </Grid>
  );
};
