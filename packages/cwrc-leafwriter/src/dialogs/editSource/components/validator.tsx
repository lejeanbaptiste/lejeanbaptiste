import CheckIcon from '@mui/icons-material/Check';
import EditNoteIcon from '@mui/icons-material/EditNote';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { useAtomValue } from 'jotai';
import { useAnimate } from 'motion/react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useValidation } from '../hooks/useValidation';
import { xmlValidityAtom } from '../store';

export const Validator = () => {
  const [scope, animate] = useAnimate();
  const { t } = useTranslation();
  const xmlValidity = useAtomValue(xmlValidityAtom);
  const { checkValidity } = useValidation();

  useEffect(() => {
    if (xmlValidity.valid) animatedCheckMark();
  }, [xmlValidity.valid]);

  const animatedCheckMark = async () => {
    if (!scope.current) return;
    await animate('svg', { opacity: 0, x: 30 }, { duration: 0 });
    await animate('svg', { opacity: 1, x: 0 }, { duration: 0.5 });
    await animate('svg', { opacity: 0, x: 30 }, { duration: 0.5, delay: 4 });
  };

  const handleChecKDocument = () => {
    const validity = checkValidity();
    if (validity.valid) animatedCheckMark();
  };

  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      {xmlValidity.valid ? (
        <Box ref={scope}>
          <CheckIcon sx={{ opacity: 0 }} />
        </Box>
      ) : (
        <Stack direction="row" alignItems="center" spacing={1}>
          <WarningAmberIcon />
          <Typography align="right" color="error" variant="body2">
            {xmlValidity.error.message}
          </Typography>
        </Stack>
      )}
      <Tooltip placement="top" title={t('LW.check_well-formedness')}>
        <IconButton onClick={handleChecKDocument} sx={{ borderRadius: 2 }}>
          <EditNoteIcon />
        </IconButton>
      </Tooltip>
    </Stack>
  );
};
