import { bindMenu } from 'material-ui-popup-state/hooks';
import HoverMenu from 'material-ui-popup-state/HoverMenu';
import React, { useContext, useMemo } from 'react';
import { CascadingContext } from '.';
import { useMenu } from './useMenu';

//@ts-ignore
export const CascadingMenu = ({ popupState, ...props }) => {
  const { MIN_WIDTH } = useMenu();

  const { rootPopupState } = useContext(CascadingContext);
  
  const context = useMemo(
    () => ({
      rootPopupState: rootPopupState || popupState,
      parentPopupState: popupState,
    }),
    [rootPopupState, popupState]
  );

  return (
    <CascadingContext.Provider value={context}>
      <HoverMenu
        MenuListProps={{ dense: true, sx: { minWidth: MIN_WIDTH, py: 0.5, borderRadius: 1 } }}
        {...props}
        {...bindMenu(popupState)}
      />
    </CascadingContext.Provider>
  );
};
