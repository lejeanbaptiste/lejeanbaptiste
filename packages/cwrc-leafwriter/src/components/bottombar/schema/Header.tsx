import AddIcon from '@mui/icons-material/Add';
import { Box, IconButton, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface HeaderProps {
  onClickAdd: (action: 'add') => void;
}

export const Header = ({ onClickAdd }: HeaderProps) => {
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
        {t('commons.schemas')}
      </Typography>
      <IconButton
        aria-label={t('LW.commons.add').toString()}
        onClick={() => onClickAdd('add')}
        size="small"
      >
        <AddIcon sx={{ height: 12, width: 12 }} />
      </IconButton>
    </Box>
  );
};
