import { ListItem, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const bridge = getCommonsUiBridge();
  const [encoderName, setEncoderNameLocal] = useState(bridge?.encoderName ?? '');

  useEffect(() => {
    if (!bridge) return;
    setEncoderNameLocal(bridge.encoderName);
  }, [bridge?.encoderName]);

  if (!bridge) return null;

  return (
    <ListItem dense disableGutters sx={{ py: 0.25 }}>
      <TextField
        fullWidth
        label={t('LW.desktop.settings.user_name')}
        onBlur={() => void bridge.setEncoderName(encoderName)}
        onChange={(event) => setEncoderNameLocal(event.target.value)}
        placeholder={t('LW.desktop.settings.your_name')}
        size="small"
        value={encoderName}
      />
    </ListItem>
  );
};
