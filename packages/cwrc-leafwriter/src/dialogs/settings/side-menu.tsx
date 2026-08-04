import { Box, MenuItem, MenuList } from '@mui/material';
import { useTranslation } from 'react-i18next';

export type MenuItemProps = {
  id: string;
  label: string;
  hide?: boolean;
};

interface SideMenuProps {
  items: MenuItemProps[];
  activeId: string;
  onChange: (id: string) => void;
}

export const SideMenu = ({ items, activeId, onChange }: SideMenuProps) => {
  const { t } = useTranslation();

  return (
    <Box
      aria-label={t('LW.commons.side_menu')}
      minWidth={148}
      mt={0.75}
      gap={0.25}
      ml={-0.25}
      sx={{
        alignSelf: 'stretch',
        overflowY: 'auto',
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        pr: 0.5,
        '& .MuiMenuList-root': {
          py: 0,
        },
      }}
    >
      <MenuList>
        {items
          .filter(({ hide }) => !hide)
          .map(({ id, label }) => (
            <MenuItem
              key={id}
              dense
              onClick={() => onChange(id)}
              selected={activeId === id}
              sx={{
                borderRadius: 1,
                fontSize: '0.875rem',
                minHeight: 26,
                mx: 0.25,
                my: 0.15,
                py: 0.1,
                '&.Mui-selected': {
                  bgcolor: 'action.selected',
                  fontWeight: 600,
                },
                '&.Mui-selected:hover': {
                  bgcolor: 'action.selected',
                },
              }}
            >
              {label}
            </MenuItem>
          ))}
      </MenuList>
    </Box>
  );
};
