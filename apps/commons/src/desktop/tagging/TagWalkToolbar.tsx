import { Box, Button, Paper, Typography } from '@mui/material';
import type { TagCommandMode } from './tagCommand';

export interface TagWalkToolbarProps {
  matchCount: number;
  mode: TagCommandMode;
  onApplyStep: () => void;
  onExit: () => void;
  onSkip: () => void;
  searchText: string;
  tagName: string;
}

export const TagWalkToolbar = ({
  matchCount,
  mode,
  onApplyStep,
  onExit,
  onSkip,
  searchText,
  tagName,
}: TagWalkToolbarProps) => (
  <Paper
    elevation={10}
    sx={{
      position: 'fixed',
      bottom: 72,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1500,
      px: 1.5,
      py: 1,
      minWidth: 280,
      maxWidth: 420,
    }}
  >
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
      Walk mode — {mode === 'rename' ? 'rename to' : 'tag as'} <strong>{tagName}</strong>
      {searchText ? ` — "${searchText.length > 32 ? `${searchText.slice(0, 32)}…` : searchText}"` : ''}
    </Typography>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
      {matchCount} remaining · Enter tag · Tab skip · Esc done
    </Typography>
    <Box sx={{ display: 'flex', gap: 0.75 }}>
      <Button size="small" variant="contained" onClick={onApplyStep} sx={{ flex: 1 }}>
        Tag
      </Button>
      <Button size="small" variant="outlined" onClick={onSkip} sx={{ flex: 1 }}>
        Skip
      </Button>
      <Button size="small" onClick={onExit} sx={{ flex: 1 }}>
        Done
      </Button>
    </Box>
  </Paper>
);
