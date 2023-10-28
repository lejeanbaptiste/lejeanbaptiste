import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Button, Tooltip } from '@mui/material';
import { useAppState } from '../../overmind';

export const ValdidationErrors = () => {
  const { validationErrors } = useAppState().validator;

  const handleClick = () => window.writer.validate();

  return (
    <Tooltip title="Annotation Mode">
      <Button
        id="annotation-mode-select"
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
