import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { LoadingButton } from '@mui/lab';
import {
  Button,
  ButtonGroup,
  ClickAwayListener,
  Grow,
  MenuItem,
  MenuList,
  Paper,
  Popper,
} from '@mui/material';
import { useAppState } from '../overmind';
import React, { FC, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

type SaveType = 'save' | 'pullRequest';

interface ISaveOption {
  label: string;
  value: SaveType;
}

export interface Props {
  enabled: boolean;
  onSelect: (value: string) => void;
}

const SaveOptions: FC<Props> = ({ enabled, onSelect }) => {
  const { t } = useTranslation();
  const { resource } = useAppState().common;
  const { isSaving } = useAppState().cloud;

  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const saveOptions: ISaveOption[] = [
    { label: t('commons:save'), value: 'save' },
    { label: t('footer:save_as_pull_request'), value: 'pullRequest' },
  ];

  const handleToggle = () => setOpen((prevOpen) => !prevOpen);

  const handleClose = (event: Event) => {
    if (anchor.current && anchor.current.contains(event.target as HTMLElement)) {
      return;
    }

    setOpen(false);
  };

  const handleSelect = async (index: number, value: string) => {
    setSelectedIndex(index);
    setOpen(false);
    onSelect(value);
  };

  const handleClick = (value?: string) => {
    if (!value) value = saveOptions.at(selectedIndex)?.value;
    if (!value) return;
    onSelect(value);
  };

  return (
    <>
      <ButtonGroup variant="contained" ref={anchor} aria-label="split save button">
        <LoadingButton
          disabled={!enabled || resource?.filename === ''}
          loading={isSaving}
          onClick={() => handleClick(saveOptions.at(selectedIndex)?.value)}
        >
          {saveOptions.at(selectedIndex)?.label}
        </LoadingButton>
        <Button
          aria-controls={open ? 'split-button-menu' : undefined}
          aria-expanded={open ? 'true' : undefined}
          aria-haspopup="menu"
          aria-label="select save option"
          disabled={!enabled || resource?.filename === '' || isSaving}
          onClick={handleToggle}
          size="small"
        >
          <ArrowDropDownIcon />
        </Button>
      </ButtonGroup>
      <Popper open={open} anchorEl={anchor.current} role={undefined} transition disablePortal>
        {({ TransitionProps, placement }) => (
          <Grow
            {...TransitionProps}
            style={{ transformOrigin: placement === 'bottom' ? 'center top' : 'center bottom' }}
          >
            <Paper sx={{ mr: 1 }}>
              <ClickAwayListener onClickAway={handleClose}>
                <MenuList id="split-button-menu">
                  {saveOptions.map(({ label, value }, index) => (
                    <MenuItem
                      key={value}
                      disabled={!enabled || resource?.filename === '' || isSaving}
                      onClick={() => handleSelect(index, value)}
                      selected={index === selectedIndex}
                      sx={{ textTransform: 'uppercase' }}
                    >
                      {label}
                    </MenuItem>
                  ))}
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>
    </>
  );
};

export default SaveOptions;
