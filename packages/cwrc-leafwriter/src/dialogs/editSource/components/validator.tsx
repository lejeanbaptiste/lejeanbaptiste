import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { useAtomValue } from 'jotai';
import { useAnimate } from 'motion/react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { IoMdCheckmark } from 'react-icons/io';
import { RiErrorWarningLine } from 'react-icons/ri';
import { TbPencilCheck } from 'react-icons/tb';
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
          <IoMdCheckmark style={{ opacity: 0 }} />
        </Box>
      ) : (
        <Stack direction="row" alignItems="center" spacing={1}>
          <RiErrorWarningLine />
          <Typography align="right" color="error" variant="body2">
            {xmlValidity.error.message}
          </Typography>
        </Stack>
      )}
      <Tooltip placement="top" title={t('LW.check_well-formedness')}>
        <IconButton onClick={handleChecKDocument} sx={{ borderRadius: 2 }}>
          <TbPencilCheck strokeWidth={1.5} />
        </IconButton>
      </Tooltip>
    </Stack>
  );
};
