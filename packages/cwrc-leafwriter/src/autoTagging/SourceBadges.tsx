import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { ReactElement } from 'react';
import {
  BdrcIcon,
  CbdbIcon,
  ChgisIcon,
  DilaIcon,
  NorbertIcon,
  ViafIcon,
} from '../icons/custom/AuthoritySource';
import { WikipediaIcon } from '../icons/custom/Wikipedia';

const ICON_SX = { fontSize: 14, display: 'block' } as const;

const sourceIcon = (label: string): ReactElement | null => {
  switch (label.toLowerCase()) {
    case 'wikidata':
    case 'wikipedia':
      return <WikipediaIcon sx={ICON_SX} />;
    case 'dila':
      return <DilaIcon sx={ICON_SX} />;
    case 'bdrc':
      return <BdrcIcon />;
    case 'cbdb':
      return <CbdbIcon sx={ICON_SX} />;
    case 'chgis':
      return <ChgisIcon sx={ICON_SX} />;
    case 'viaf':
      return <ViafIcon />;
    case 'norbert':
      return <NorbertIcon />;
    default:
      return null;
  }
};

/** Same "Local"/"Central" labels and colors as OWN_DATABASE_BADGE in dialogs/autoTagging/index.tsx. */
const OWN_DATABASE_LABEL: Partial<Record<string, { label: string; color: string; bg: string }>> = {
  pedb: { label: 'Local', color: '#0b5fa5', bg: '#e3f0fb' },
  cedb: { label: 'Central', color: '#7a3ea1', bg: '#f2e8f8' },
  'entity-file': { label: 'Local', color: '#0b5fa5', bg: '#e3f0fb' },
  'central-database': { label: 'Central', color: '#7a3ea1', bg: '#f2e8f8' },
};

/**
 * Compact replacement for the text source pill ("CBDB+DILA+Wikidata"): one
 * small icon per source, tooltipped with its name. Sources without an icon
 * keep their text label so nothing is lost for custom packs.
 */
export const SourceBadges = ({ label, compact = false }: { label: string; compact?: boolean }) => {
  const parts = label
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  const grouped = parts.reduce<{ label: string; count: number }[]>((result, part) => {
    const existing = result.find((entry) => entry.label.toLowerCase() === part.toLowerCase());
    if (existing) existing.count += 1;
    else result.push({ label: part, count: 1 });
    return result;
  }, []);

  return (
    <Box
      component="span"
      aria-label={`Sources: ${label}`}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        ...(compact
          ? { px: 0, height: 16 }
          : {
              px: 0.75,
              height: 20,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: '10px',
            }),
        color: 'text.secondary',
        flexShrink: 0,
      }}
    >
      {grouped.map(({ label: part, count }) => {
        const icon = sourceIcon(part);
        const ownDatabase = OWN_DATABASE_LABEL[part.toLowerCase()];
        return (
          <Tooltip
            key={part}
            title={ownDatabase ? `${ownDatabase.label} entity database` : part}
            arrow
          >
            <Box component="span" sx={{ position: 'relative', display: 'inline-flex' }}>
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
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{ fontSize: 10, lineHeight: 1 }}
                  >
                    {part}
                  </Typography>
                ))}
              {count > 1 && (
                <Typography
                  component="span"
                  sx={{
                    position: 'absolute',
                    top: -2,
                    right: -5,
                    minWidth: 11,
                    height: 11,
                    px: 0.25,
                    borderRadius: '6px',
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    fontSize: 8,
                    lineHeight: '11px',
                    textAlign: 'center',
                    fontWeight: 700,
                  }}
                >
                  {count}
                </Typography>
              )}
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
};
