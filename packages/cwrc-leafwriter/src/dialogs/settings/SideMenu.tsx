import { Box, MenuItem, MenuList } from '@mui/material';
import { useRef } from 'react';

export type MenuItemProps = {
  id: string;
  label: string;
  hide?: boolean;
};

interface SideMenuProps {
  items: MenuItemProps[];
}

export const SideMenu = ({ items }: SideMenuProps) => {
  const refElemennt = useRef<HTMLDivElement>();

  const handleClick = (section: string) => {
    refElemennt.current?.parentElement
      ?.querySelector?.(`#${section}`)
      ?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <Box ref={refElemennt} aria-label="Side menu" minWidth={120} mt={2} gap={0.5} ml={-1.5}>
      <MenuList>
        {items
          .filter(({ hide }) => !hide)
          .map(({ id, label }) => (
            <MenuItem
              key={id}
              dense
              onClick={() => handleClick(id)}
              sx={{
                borderTopRightRadius: 4,
                borderBottomRightRadius: 4,
                textTransform: 'capitalize',
              }}
            >
              {label}
            </MenuItem>
          ))}
      </MenuList>
    </Box>
  );
};
