import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
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
import { useAppState } from '@src/overmind';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

type SaveType = 'save' | 'pullRequest';

interface SaveOption {
  label: string;
  value: SaveType;
}

export interface Props {
  enabled: boolean;
  onSelect: (value: string) => void;
}

export const SaveOptions = ({ enabled, onSelect }: Props) => {
  const { resource } = useAppState().common;
  const { isSaving } = useAppState().cloud;

  const { t } = useTranslation();

  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const saveOptions: SaveOption[] = [
    { label: t('SS.commons.save'), value: 'save' },
    { label: t('SS.footer.pull_request'), value: 'pullRequest' },
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
      <ButtonGroup aria-label="split save button" ref={anchor} size="small" variant="outlined">
        <Button
          data-testid="save"
          disabled={!enabled || resource?.filename === ''}
          loading={isSaving}
          onClick={() => handleClick(saveOptions.at(selectedIndex)?.value)}
          title={t('SS.commons.save').toString()}
          size="small"
          variant="outlined"
        >
          {saveOptions.at(selectedIndex)?.label}
        </Button>
        <Button
          aria-controls={open ? 'split-button-menu' : undefined}
          aria-expanded={open ? 'true' : undefined}
          aria-haspopup="menu"
          aria-label="select save option"
          data-testid="save-options-button"
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
            <Paper sx={{ mr: 1 }} data-testid="save:footer:save-options-dialog">
              <ClickAwayListener onClickAway={handleClose}>
                <MenuList id="split-button-menu">
                  {saveOptions.map(({ label, value }, index) => (
                    <MenuItem
                      key={value}
                      data-testid={`save-options:${value}-button`}
                      disabled={!enabled || resource?.filename === '' || isSaving}
                      onClick={() => handleSelect(index, value)}
                      selected={index === selectedIndex}
                      // sx={{ textTransform: 'uppercase' }}
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
