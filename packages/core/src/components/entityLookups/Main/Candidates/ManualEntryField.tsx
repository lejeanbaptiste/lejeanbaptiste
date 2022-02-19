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
} from '@mui/material';
import { useActions, useAppState } from '@src/overmind';
import React, { ChangeEvent, FC, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';

interface ManualEntryFieldProps {
  setAuthorityInView: (view: { id: string; inView: boolean }) => void;
}

const ManualEntryField: FC<ManualEntryFieldProps> = ({ setAuthorityInView }) => {
  const { isUriValid, manualInput } = useAppState().lookups;
  const { setManualInput, setSelected } = useActions().lookups;

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
          borderBottomColor: ({ palette }) => palette.grey[700],
          backgroundColor: ({ palette }) => {
            return palette.mode === 'dark' ? palette.grey[800] : palette.background.paper;
          },
        }}
      >
        <Typography
          sx={{
            color: ({ palette }) => palette.text.secondary,
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
