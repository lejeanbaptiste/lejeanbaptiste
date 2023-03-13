import MenuIcon from '@mui/icons-material/Menu';
import { Box, Divider, IconButton, Stack } from '@mui/material';
import { Logo } from '@src/components';
import { useAppState } from '@src/overmind';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { bindFocus, bindMenu, bindTrigger, usePopupState } from 'material-ui-popup-state/hooks';
import React, { createContext } from 'react';
import { CascadingMenu } from './CascadingMenu';
import { Item, type ItemProps } from './Item';
import { SubMenu, type SubMenuProps } from './SubMenu';
import { useMenu } from './useMenu';

export { useMenu } from './useMenu';

export const CascadingContext = createContext({
  parentPopupState: null,
  rootPopupState: null,
});

export const MainMenu = () => {
  const { resource } = useAppState().editor;

  const { mainMenuOptions } = useMenu();

  const popupState = usePopupState({
    popupId: 'mainMenu',
    variant: 'popover',
  });

  const logoVariants: Variants = {
    visible: { height: 'auto', opacity: 1 },
    hidden: { height: 0, opacity: 0 },
  };

  const menuButtonVariants: Variants = {
    visible: { width: 'auto', opacity: 1 },
    hidden: { width: 0, opacity: 0 },
  };

  return (
    <Box sx={{ mr: 1 }}>
      <Stack direction="row" alignItems="center">
        <Box
          mr={2}
          component={motion.div}
          variants={menuButtonVariants}
          initial="hidden"
          animate={resource ? 'visible' : 'hidden'}
          sx={{ overflow: 'hidden' }}
        >
          <AnimatePresence mode="wait">
            {resource && (
              <IconButton
                aria-label="Main Menu"
                size="medium"
                {...bindFocus(popupState)}
                {...bindTrigger(popupState)}
              >
                <MenuIcon fontSize="inherit" />
              </IconButton>
            )}
          </AnimatePresence>
        </Box>
        <AnimatePresence mode="wait">
          <Box
            component={motion.div}
            variants={logoVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ type: 'tween' }}
          >
            <Logo height={24} size="small" />
          </Box>
        </AnimatePresence>
      </Stack>
      <CascadingMenu
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        popupState={popupState}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        {...bindMenu(popupState)}
      >
        {mainMenuOptions
          .filter((item) => {
            if (typeof item === 'string') return item;
            if (!item.hide) return item;
          })
          .map((item, index, arr) => {
            if (item === 'divider' && arr[index - 1] === 'divider') return null; // Do not duplicate dividers
            if (item === 'divider') return <Divider key={index} />;
            if ('popupId' in item) return <SubMenu key={index} {...(item as SubMenuProps)} />;
            return <Item key={index} {...(item as ItemProps)} />;
          })}
      </CascadingMenu>
    </Box>
  );
};
