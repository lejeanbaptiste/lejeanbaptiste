import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Box, Divider, Icon, MenuItem, Stack, Typography } from '@mui/material';
import { getIcon } from '@src/assets/icons';
import { bindFocus, bindHover, usePopupState } from 'material-ui-popup-state/hooks';
import React, { useContext, useEffect, useState } from 'react';
import { CascadingContext } from '.';
import { CascadingMenu } from './CascadingMenu';
import { Item, type ItemProps } from './Item';
import { useMenu, type ItemType } from './useMenu';

export interface SubMenuProps {
  hide?: boolean;
  icon?: string;
  popupId: string;
  title?: string;
  type?: ItemType;
  [key: string]: any;
}

export const SubMenu = ({ hide, icon, title, popupId, ...props }: SubMenuProps) => {
  const { parentPopupState } = useContext(CascadingContext);
  const popupState = usePopupState({
    popupId,
    variant: 'popover',
    parentPopupState,
  });

  const { getOptions } = useMenu();

  const [options, setOptions] = useState<(ItemProps | 'divider' | SubMenuProps)[]>([]);

  useEffect(() => {
    if (popupId) setOptions(getOptions(popupId));
  }, []);

  return (
    <>
      <MenuItem
        dense
        {...bindHover(popupState)}
        {...bindFocus(popupState)}
        sx={{ mx: 0.5, px: 0.75, borderRadius: 1 }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          width="100%"
          gap={1.5}
          mx={0.5}
          my={0.5}
        >
          {/* LEFT ICON */}
          {icon && <Icon component={getIcon(icon)} fontSize="small" />}

          {/* LABEL */}
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
              {title}
            </Typography>
          </Box>

          {/* RIGHT */}
          <ChevronRightIcon />
        </Stack>
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
    </>
  );
};
