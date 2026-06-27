import { Box, Typography } from '@mui/material';
import type { VisibleSnippet } from './types';

const ellipsisSx = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
};

export const FindSnippetLine = ({ snippet }: { snippet: VisibleSnippet }) => (
  <Typography
    component="span"
    sx={{
      alignItems: 'baseline',
      display: 'flex',
      fontSize: '0.6875rem',
      lineHeight: 1.3,
      minWidth: 0,
      width: '100%',
    }}
  >
    {snippet.prefix ? (
      <Box component="span" sx={{ ...ellipsisSx, flexShrink: 1 }}>
        {snippet.prefix}
      </Box>
    ) : null}
    <Box
      component="mark"
      sx={{
        bgcolor: 'warning.light',
        borderRadius: 0.25,
        color: 'inherit',
        flexShrink: 0,
        px: 0.125,
      }}
    >
      {snippet.match}
    </Box>
    {snippet.suffix ? (
      <Box component="span" sx={{ ...ellipsisSx, flexShrink: 1 }}>
        {snippet.suffix}
      </Box>
    ) : null}
  </Typography>
);

export const formatSnippetLabel = (snippet: VisibleSnippet) =>
  `${snippet.prefix}${snippet.match}${snippet.suffix}`;
