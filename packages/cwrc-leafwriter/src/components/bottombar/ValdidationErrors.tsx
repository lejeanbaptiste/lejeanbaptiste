import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Button, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAppState } from '../../overmind';

export const ValdidationErrors = () => {
  const { validationErrors } = useAppState().validator;
  const { t } = useTranslation();

  const handleClick = () => window.writer.validate();

  return (
    <Tooltip title={t('LW.panels.validation')}>
      <Button
        id="validation-errors"
        color="warning"
        onClick={handleClick}
        size="small"
        startIcon={<WarningAmberIcon />}
      >
        {validationErrors}
      </Button>
    </Tooltip>
  );
};
