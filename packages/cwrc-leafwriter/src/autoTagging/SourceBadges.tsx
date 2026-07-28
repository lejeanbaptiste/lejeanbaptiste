import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { ReactElement } from 'react';
import norbertMini from '../../../../apps/commons/src/assets/images/norbert-mini.png';
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
    case 'norbert':
      return (
        <Box
          component="img"
          src={norbertMini}
          alt=""
          sx={{ width: 14, height: 14, objectFit: 'contain', display: 'block' }}
        />
      );
    default:
      return null;
  }
};

/** Same "Local"/"Central" labels and colors as OWN_DATABASE_BADGE in dialogs/autoTagging/index.tsx. */
const OWN_DATABASE_LABEL: Partial<Record<string, { label: string; color: string; bg: string }>> = {
  pedb: { label: 'Local', color: '#0b5fa5', bg: '#e3f0fb' },
  cedb: { label: 'Central', color: '#7a3ea1', bg: '#f2e8f8' },
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
        const ownDatabase = OWN_DATABASE_LABEL[part.toLowerCase()];
        return (
          <Tooltip
            key={part}
            title={ownDatabase ? `${ownDatabase.label} entity database` : part}
            arrow
          >
            {icon ??
              (ownDatabase ? (
                <Typography
                  component="span"
                  variant="caption"
                  sx={{
                    fontSize: 10,
                    lineHeight: 1.4,
                    px: 0.5,
                    borderRadius: '8px',
                    color: ownDatabase.color,
                    bgcolor: ownDatabase.bg,
                  }}
                >
                  {ownDatabase.label}
                </Typography>
              ) : (
                <Typography component="span" variant="caption" sx={{ fontSize: 10, lineHeight: 1 }}>
                  {part}
                </Typography>
              ))}
          </Tooltip>
        );
      })}
    </Box>
  );
};
