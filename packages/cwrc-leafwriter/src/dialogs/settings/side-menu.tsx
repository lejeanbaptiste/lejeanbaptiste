import { Box, MenuItem, MenuList } from '@mui/material';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

export type MenuItemProps = {
  id: string;
  label: string;
  hide?: boolean;
};

interface SideMenuProps {
  items: MenuItemProps[];
}

export const SideMenu = ({ items }: SideMenuProps) => {
  const { t } = useTranslation();
  const refElemennt = useRef<HTMLDivElement>();

  const handleClick = (section: string) => {
    refElemennt.current?.parentElement
      ?.querySelector?.(`#${section}`)
      ?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <Box
      ref={refElemennt}
      aria-label={t('LW.commons.side_menu')}
      minWidth={148}
      mt={0.75}
      gap={0.25}
      ml={-0.25}
      sx={{
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
              onClick={() => handleClick(id)}
              sx={{
                borderRadius: 1,
                fontSize: '0.875rem',
                minHeight: 26,
                mx: 0.25,
                my: 0.15,
                py: 0.1,
              }}
            >
              {label}
            </MenuItem>
          ))}
      </MenuList>
    </Box>
  );
};
