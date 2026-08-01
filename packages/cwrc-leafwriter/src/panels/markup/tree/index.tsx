import RefreshIcon from '@mui/icons-material/Refresh';
import { Box, IconButton, Tooltip } from '@mui/material';
import { useSetAtom } from 'jotai';
import { useEffect, useState } from 'react';
import { useAppState } from '../../../overmind';
import type { MarkupTreeSyncMode } from '../../../overmind/ui/state';
import { SortableTree } from './SortableTree';
import { allowDndAtom, displayTextNodesAtom } from './store';

export const Tree = ({ syncMode }: { syncMode: Exclude<MarkupTreeSyncMode, 'off'> }) => {
  const { markupPanel } = useAppState().ui;
  const [refreshVersion, setRefreshVersion] = useState(0);

  const allowDND = useSetAtom(allowDndAtom);
  const displayTextNodes = useSetAtom(displayTextNodesAtom);

  useEffect(() => {
    allowDND(markupPanel.allowDragAndDrop);
    displayTextNodes(markupPanel.showTextNodes);
  }, [markupPanel.allowDragAndDrop, markupPanel.showTextNodes]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {syncMode === 'manual' && (
        <Box sx={{ display: 'flex', alignItems: 'center', px: 0.5, pb: 0.5, flexShrink: 0 }}>
          <Tooltip title="Refresh markup tree">
            <IconButton size="small" onClick={() => setRefreshVersion((version) => version + 1)}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <SortableTree refreshVersion={refreshVersion} syncMode={syncMode} />
      </Box>
    </Box>
  );
};
