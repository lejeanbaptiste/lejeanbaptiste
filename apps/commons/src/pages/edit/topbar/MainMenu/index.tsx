import MenuIcon from '@mui/icons-material/Menu';
import { Box, Divider, IconButton, Stack } from '@mui/material';
import { Logo } from '@src/components';
import { useAppState } from '@src/overmind';
import { bindFocus, bindMenu, bindTrigger, usePopupState } from 'material-ui-popup-state/hooks';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import { createContext } from 'react';
import { CascadingMenu, Item, SubMenu, type ItemProps, type SubMenuProps } from './components';

import { useMenu } from './useMenu';

export { useMenu } from './useMenu';

export type CascadingContextProps = {
  parentPopupState: ReturnType<typeof usePopupState> | null;
  rootPopupState: ReturnType<typeof usePopupState> | null;
};

export const CascadingContext = createContext<CascadingContextProps>({
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

  const handleMenuLogoClick = () => {
    window.open(window.location.origin, '_blank');
    handleMenuClick();
  };

  const handleMenuClick = () => popupState.close();

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
      <AnimatePresence>
        <CascadingMenu
          anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
          popupState={popupState}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          {...bindMenu(popupState)}
          slotProps={{
            paper: {
              sx: { top: '8px !important', left: '18px !important' },
            },
          }}
          onPointerDown={handleMenuClick}
        >
          <Stack direction="row" mx={1} mt={2} mb={2} alignItems="center" justifyContent="center">
            <Logo
              height={24}
              onPointerDown={handleMenuLogoClick}
              size="small"
              sx={{ cursor: 'pointer' }}
            />
          </Stack>
          {mainMenuOptions
            .filter((item) => {
              if (typeof item === 'string') return item;
              if (!item.hide) return item;
            })
            .map((item, index, arr) => {
              if (item === 'divider' && arr[index - 1] === 'divider') return null; // Do not duplicate dividers
              if (item === 'divider') return <Divider key={index} sx={{ my: 0.5 }} />;
              if ('popupId' in item) return <SubMenu key={index} {...(item as SubMenuProps)} />;
              return <Item key={index} {...(item as ItemProps)} />;
            })}
        </CascadingMenu>
      </AnimatePresence>
    </Box>
  );
};
