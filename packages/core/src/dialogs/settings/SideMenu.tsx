import { Box, Button, ButtonGroup } from '@mui/material';
import React, { useRef } from 'react';

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
    <Box ref={refElemennt} minWidth={120} mt={2}>
      <ButtonGroup
        aria-label="Side menu"
        orientation="vertical"
        size="small"
        sx={{ alignItems: 'flex-start', gap: 0.5 }}
      >
        {items
          .filter(({ hide }) => !hide)
          .map(({ id, label }) => (
            <Button
              key={id}
              fullWidth
              onClick={() => handleClick(id)}
              sx={{ justifyContent: 'flex-start' }}
              variant="text"
            >
              {label}
            </Button>
          ))}
      </ButtonGroup>
    </Box>
  );
};

export default SideMenu;
