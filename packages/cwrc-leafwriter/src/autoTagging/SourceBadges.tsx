import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { ReactElement } from 'react';
import { CbdbIcon, ChgisIcon, DilaIcon } from '../icons/custom/AuthoritySource';
import { WikipediaIcon } from '../icons/custom/Wikipedia';

const ICON_SX = { fontSize: 14, display: 'block' } as const;

const sourceIcon = (label: string): ReactElement | null => {
  switch (label.toLowerCase()) {
    case 'wikidata':
    case 'wikipedia':
      return <WikipediaIcon sx={ICON_SX} />;
    case 'dila':
      return <DilaIcon sx={ICON_SX} />;
    case 'cbdb':
      return <CbdbIcon sx={ICON_SX} />;
    case 'chgis':
      return <ChgisIcon sx={ICON_SX} />;
    default:
      return null;
  }
};

/**
 * Compact replacement for the text source pill ("CBDB+DILA+Wikidata"): one
 * small icon per source, tooltipped with its name. Sources without an icon
 * keep their text label so nothing is lost for custom packs.
 */
export const SourceBadges = ({ label }: { label: string }) => {
  const parts = label
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 0.75,
        height: 20,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '10px',
        color: 'text.secondary',
        flexShrink: 0,
      }}
    >
      {parts.map((part) => {
        const icon = sourceIcon(part);
        return (
          <Tooltip key={part} title={part} arrow>
            {icon ?? (
              <Typography component="span" variant="caption" sx={{ fontSize: 10, lineHeight: 1 }}>
                {part}
              </Typography>
            )}
          </Tooltip>
        );
      })}
    </Box>
  );
};
