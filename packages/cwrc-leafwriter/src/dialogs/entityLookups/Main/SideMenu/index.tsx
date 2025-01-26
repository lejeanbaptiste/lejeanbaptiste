import { Box, Button, ButtonGroup } from '@mui/material';
import { useRef } from 'react';
import { useAppState } from '../../../../overmind';
import type { Authority } from '../../../../types';
import Badge from './Badge';

interface SideMenuProps {
  authorityInView: string[];
}

const SideMenu = ({ authorityInView }: SideMenuProps) => {
  const { results } = useAppState().lookups;
  const refElemennt = useRef<HTMLDivElement>();

  const handleClick = (authority: Authority | string) => {
    refElemennt.current?.parentElement
      ?.querySelector?.(`#${authority}`)
      ?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <Box ref={refElemennt} minWidth={120} mt={2}>
      {results && (
        <ButtonGroup
          aria-label="Side menu"
          orientation="vertical"
          size="small"
          sx={{ alignItems: 'flex-end', gap: 0.5 }}
        >
          {[...results].map(([authority, candidates]) => (
            <Button
              color={authorityInView.includes(authority) ? 'primary' : 'inherit'}
              disabled={candidates.length === 0}
              key={authority}
              onClick={() => handleClick(authority)}
              sx={{ textTransform: 'uppecase' }}
              variant="text"
            >
              {authority}
              <Badge count={candidates.length} />
            </Button>
          ))}
          <Button
            color={authorityInView.includes('other') ? 'primary' : 'inherit'}
            onClick={() => handleClick('other')}
            sx={{ textTransform: 'uppecase' }}
            variant="text"
          >
            Other
          </Button>
        </ButtonGroup>
      )}
    </Box>
  );
};

export default SideMenu;
