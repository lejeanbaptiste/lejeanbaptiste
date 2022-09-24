import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Box, Divider, Icon, MenuItem, Stack, Typography } from '@mui/material';
import { getIcon } from '@src/utilities';
import { bindFocus, bindHover, usePopupState } from 'material-ui-popup-state/hooks';
import React, { useContext, useEffect, useState } from 'react';
import { CascadingContext } from '.';
import { CascadingMenu } from './CascadingMenu';
import { Item, type IItem } from './Item';
import { useMenu, type ItemType } from './useMenu';

export interface ISubMenu {
  icon?: string;
  popupId: string;
  title?: string;
  type?: ItemType;
  [key: string]: any;
}

export const SubMenu = ({ icon, title, popupId, ...props }: ISubMenu) => {
  const { parentPopupState } = useContext(CascadingContext);
  const popupState = usePopupState({
    popupId,
    variant: 'popover',
    parentPopupState,
  });

  const { getOptions } = useMenu();

  const [options, setOptions] = useState<(IItem | 'divider' | ISubMenu)[]>([]);

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
          if ('popupId' in item) return <SubMenu key={index} {...(item as ISubMenu)} />;
          return <Item key={index} {...(item as IItem)} />;
        })}
      </CascadingMenu>
    </>
  );
};
