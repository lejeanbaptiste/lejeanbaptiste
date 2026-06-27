import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import { Box, ListItem, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

const getCommonsUiBridge = () =>
  (
    window as Window & {
      __ljbCommonsUi?: {
        encoderName: string;
        setEncoderName: (name: string) => void | Promise<void>;
      };
    }
  ).__ljbCommonsUi;

export const DesktopEncoderName = () => {
  const bridge = getCommonsUiBridge();
  const [encoderName, setEncoderNameLocal] = useState(bridge?.encoderName ?? '');

  useEffect(() => {
    if (!bridge) return;
    setEncoderNameLocal(bridge.encoderName);
  }, [bridge?.encoderName]);

  if (!bridge) return null;

  return (
    <ListItem dense disableGutters sx={{ alignItems: 'flex-start', py: 1 }}>
      <PersonOutlineIcon sx={{ height: 18, width: 18, mx: 1, mt: 1 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2">Encoder name</Typography>
        <Typography color="text.secondary" sx={{ mb: 0.75 }} variant="caption">
          Pre-fills Principal when setting up a new project only.
        </Typography>
        <TextField
          fullWidth
          onBlur={() => void bridge.setEncoderName(encoderName)}
          onChange={(event) => setEncoderNameLocal(event.target.value)}
          placeholder="Your name"
          size="small"
          value={encoderName}
        />
      </Box>
    </ListItem>
  );
};
