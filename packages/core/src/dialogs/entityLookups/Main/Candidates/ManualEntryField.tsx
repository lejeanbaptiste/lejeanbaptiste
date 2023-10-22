import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Box,
  FormControl,
  FormHelperText,
  IconButton,
  Input,
  InputAdornment,
  InputLabel,
  Typography,
  useTheme,
} from '@mui/material';
import { useEffect, type ChangeEvent } from 'react';
import { useInView } from 'react-intersection-observer';
import { useActions, useAppState } from '../../../../overmind';

interface ManualEntryFieldProps {
  setAuthorityInView: (view: { id: string; inView: boolean }) => void;
}

const ManualEntryField = ({ setAuthorityInView }: ManualEntryFieldProps) => {
  const { isUriValid, manualInput } = useAppState().lookups;
  const { setManualInput, setSelected } = useActions().lookups;

  const { palette } = useTheme();

  const { ref, inView, entry } = useInView({
    /* Optional options */
    threshold: 0,
  });

  useEffect(() => {
    if (entry) setAuthorityInView({ id: entry.target.id, inView });
  }, [inView]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setManualInput(value);
  };

  const handleclick = () => {
    setSelected();
  };

  return (
    <Box ref={ref} id="other" px={0.5} pb={1}>
      <Box
        sx={{
          px: 1,
          borderBottomWidth: 1,
          borderBottomStyle: 'solid',
          borderBottomColor: palette.grey[700],
          bgcolor: palette.mode === 'dark' ? palette.grey[800] : palette.background.paper,
        }}
      >
        <Typography
          sx={{
            color: palette.text.secondary,
            fontSize: '0.875rem',
            lineHeight: 2.5,
            textTransform: 'uppercase',
          }}
        >
          Other / Manual Input
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
                    size="small"
                    target="_blank"
                    href={manualInput}
                  >
                    <OpenInNewIcon fontSize="inherit" />
                  </IconButton>
                )}
              </InputAdornment>
            }
            fullWidth
            error={!isUriValid}
            id="manual-uri"
            onClick={handleclick}
            onChange={handleChange}
            value={manualInput}
          />

          {!isUriValid && (
            <FormHelperText error={!isUriValid} id="uri-error-text">
              Must be a valid URI
            </FormHelperText>
          )}
        </FormControl>
      </Box>
    </Box>
  );
};

export default ManualEntryField;
