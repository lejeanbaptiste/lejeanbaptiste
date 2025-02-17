import {
  Box,
  FormControl,
  FormHelperText,
  IconButton,
  Input,
  InputAdornment,
  InputLabel,
  Typography,
} from '@mui/material';
import { useAtom, useAtomValue } from 'jotai';
import { useResetAtom } from 'jotai/utils';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RxExternalLink } from 'react-icons/rx';
import { useInView } from 'react-intersection-observer';
import { isUriValidAtom, manualInputAtom, selectedAtom } from '../store';

interface ManualEntryFieldProps {
  setAuthorityInView: (view: { id: string; inView: boolean }) => void;
}

export const ManualEntryField = ({ setAuthorityInView }: ManualEntryFieldProps) => {
  const { t } = useTranslation();

  const isUriValid = useAtomValue(isUriValidAtom);
  const [manualInput, setManualInput] = useAtom(manualInputAtom);
  const resetSelected = useResetAtom(selectedAtom);

  const { ref, inView, entry } = useInView({
    /* Optional options */
    threshold: 0,
  });

  useEffect(() => {
    if (entry) setAuthorityInView({ id: entry.target.id, inView });
  }, [inView]);

  return (
    <Box ref={ref} id="other">
      <Box
        sx={[
          {
            px: 1,
            backgroundColor: (theme) => theme.vars.palette.background.paper,
            borderBottomWidth: 1,
            borderBottomStyle: 'solid',
            borderBottomColor: (theme) => theme.vars.palette.grey[700],
          },
          (theme) =>
            theme.applyStyles('dark', {
              backgroundColor: theme.vars.palette.grey[900],
            }),
        ]}
      >
        <Typography
          sx={{
            color: (theme) => theme.vars.palette.text.secondary,
            fontSize: '0.875rem',
            lineHeight: 2.5,
            textTransform: 'uppercase',
          }}
        >
          {t('LW.commons.other')} / {t('LW.commons.manual input')}
        </Typography>
      </Box>
      <Box my={1.5} ml={2} pr={2}>
        <FormControl fullWidth variant="standard">
          <InputLabel htmlFor="manual-uri">URI</InputLabel>
          <Input
            endAdornment={
              <InputAdornment position="end">
                {manualInput !== '' && isUriValid && (
                  <IconButton
                    aria-label="open-manual-uri"
                    href={manualInput}
                    size="small"
                    target="_blank"
                  >
                    <RxExternalLink fontSize="inherit" />
                  </IconButton>
                )}
              </InputAdornment>
            }
            error={!isUriValid}
            fullWidth
            id="manual-uri"
            onClick={() => resetSelected()}
            onChange={(event) => setManualInput(event.target.value)}
            value={manualInput}
          />

          {!isUriValid && (
            <FormHelperText error={!isUriValid} id="uri-error-text">
              {t('LW.commons.must be a valid URI')}
            </FormHelperText>
          )}
        </FormControl>
      </Box>
    </Box>
  );
};
