import { useState, type MouseEvent } from 'react';
import { Icon, IconButton as MuiIconButton, Menu, MenuItem, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
// Import directly rather than via the `../../components` barrel: that barrel
// pulls in a large transitive chain (down to ESM-only packages like nanoid)
// that jest's default transform can't parse, which would make this component
// untestable for no reason connected to what it actually needs.
import { StyledToolTip } from '../StyledToolTip';
import { getIcon } from '../../icons';
import { captureEditorSelectionFromEditor } from '../../aiPunctuation/editorSelectionCapture';
import type { PluginToolbarMenuItem } from '../../plugins/pluginExtensions';

import { type MenuItem as ToolbarMenuItem } from './';

/** Toolbar button that opens a dropdown of `menuItems` instead of firing a single action. */
export const MenuButton = ({
  disabled,
  icon,
  menuItems,
  openCalendar,
  title,
  tooltip,
}: ToolbarMenuItem & {
  menuItems: PluginToolbarMenuItem[];
  openCalendar: (notice?: string) => void;
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  let tip = `${tooltip ?? title}`;
  if (disabled) tip += ` - ${t('LW.not supported')}`;

  const openMenu = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const closeMenu = () => setAnchorEl(null);

  return (
    <>
      <StyledToolTip enterDelay={2000} title={tip}>
        <span>
          <MuiIconButton
            aria-label={title}
            aria-haspopup="menu"
            aria-expanded={Boolean(anchorEl)}
            disabled={disabled}
            color="primary"
            onClick={openMenu}
            onMouseDown={(e) => e.preventDefault()}
            size="small"
            sx={[
              {
                width: 34,
                height: 34,
                borderRadius: 1,
                '&:hover': { color: theme.vars.palette.primary.main },
              },
              theme.applyStyles('dark', {
                color: theme.vars.palette.text.primary,
                '&:hover': { color: theme.vars.palette.text.primary },
              }),
            ]}
          >
            <Icon component={getIcon(icon)} fontSize="small" />
          </MuiIconButton>
        </span>
      </StyledToolTip>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeMenu}>
        {menuItems.map((item) => (
          <MenuItem
            key={item.id}
            disabled={item.disabled}
            onMouseDown={(event) => {
              event.preventDefault();
              const editor = window.writer?.editor;
              if (editor?.selection) {
                captureEditorSelectionFromEditor(editor);
              }
            }}
            onClick={() => {
              closeMenu();
              item.onClick({ openCalendar });
            }}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};
