import { Box, Divider, MenuItem } from '@mui/material';
import type { IconName } from '@src/icons';
import { motion, type Variants } from 'framer-motion';
import { bindFocus, bindHover, usePopupState } from 'material-ui-popup-state/hooks';
import { useContext, useEffect, useState } from 'react';
import { CascadingContext } from '..';
import { useMenu, type ItemType } from '../useMenu';
import { CascadingMenu, type CascadingMenuProps } from './CascadingMenu';
import { Content } from './Content';
import { Item, type ItemProps } from './Item';

export interface SubMenuProps extends CascadingMenuProps {
  hide?: boolean;
  icon?: IconName;
  label: string;
  popupId: string;
  type?: ItemType;
}

export const SubMenu = ({ hide, icon, label, popupId, ...props }: SubMenuProps) => {
  const { parentPopupState } = useContext(CascadingContext);
  const popupState = usePopupState({
    popupId,
    variant: 'popover',
    parentPopupState,
  });

  const { getOptions } = useMenu();

  const [options, setOptions] = useState<(ItemProps | 'divider' | SubMenuProps)[]>([]);

  useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    const opts = await getOptions(popupId);
    if (popupId) setOptions(opts);
  };

  const variants: Variants = {
    visible: { height: 'auto', opacity: 1 },
    hidden: { height: 0, opacity: 0 },
  };

  return (
    <Box
      component={motion.div}
      variants={variants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      transition={{ type: 'tween' }}
      overflow="hidden"
    >
      <MenuItem
        dense
        {...bindHover(popupState)}
        {...bindFocus(popupState)}
        sx={{ justifyContent: 'space-between', mx: 0.5, px: 0.75, gap: 1.5, borderRadius: 1 }}
      >
        <Content {...{ icon, hasChildren: true }}>{label}</Content>
      </MenuItem>
      <CascadingMenu
        {...props}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        popupState={popupState}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {options.map((item, index) => {
          if (item === 'divider') return <Divider key={index} />;
          if (item?.hide === true) return '';
          if ('popupId' in item) return <SubMenu key={index} {...(item as SubMenuProps)} />;
          return <Item key={index} {...(item as ItemProps)} />;
        })}
      </CascadingMenu>
    </Box>
  );
};
