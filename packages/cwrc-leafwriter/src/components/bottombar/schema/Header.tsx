import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Box, IconButton, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface HeaderProps {
  onClickAdd: (action: 'add') => void;
  onClickRefresh: () => void;
  refreshDisabled?: boolean;
}

export const Header = ({ onClickAdd, onClickRefresh, refreshDisabled }: HeaderProps) => {
  const { t } = useTranslation();

  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      mt={-0.5}
      mb={0.5}
      px={0.5}
      sx={{ cursor: 'default', backgroundColor: ({ palette }) => palette.action.hover }}
    >
      <Box height={1.5} width={1.5} p="3px" />
      <Typography sx={{ cursor: 'default', textTransform: 'capitalize' }} variant="caption">
        {t('LW.commons.schemas')}
      </Typography>
      <Box display="flex" gap={0.25}>
        <IconButton
          aria-label={t('LW.commons.refresh').toString()}
          disabled={refreshDisabled}
          onClick={onClickRefresh}
          size="small"
        >
          <RefreshIcon sx={{ height: 12, width: 12 }} />
        </IconButton>
        <IconButton
          aria-label={t('LW.commons.add').toString()}
          onClick={() => onClickAdd('add')}
          size="small"
        >
          <AddIcon sx={{ height: 12, width: 12 }} />
        </IconButton>
      </Box>
    </Box>
  );
};
