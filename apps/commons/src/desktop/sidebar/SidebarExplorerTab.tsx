import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import {
  Box,
  Button,
  Collapse,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import { useActions, useAppState } from '@src/overmind';
import type { FileTreeNode } from '@src/overmind/project/state';
import { useState } from 'react';

interface TreeNodeProps {
  depth: number;
  node: FileTreeNode;
  onOpenFile: (filePath: string) => void;
}

const TreeNode = ({ depth, node, onOpenFile }: TreeNodeProps) => {
  const { loadDirectoryChildren } = useActions().project;
  const [open, setOpen] = useState(depth === 0);

  const handleClick = async () => {
    if (node.isDirectory) {
      if (!node.childrenLoaded) {
        await loadDirectoryChildren(node.path);
        setOpen(true);
        return;
      }
      setOpen((value) => !value);
      return;
    }
    onOpenFile(node.path);
  };

  const handleDoubleClick = () => {
    if (!node.isDirectory) onOpenFile(node.path);
  };

  return (
    <>
      <ListItemButton
        dense
        onClick={() => void handleClick()}
        onDoubleClick={handleDoubleClick}
        sx={{
          pl: 1 + depth * 1.5,
          py: 0.125,
          minHeight: 26,
        }}
      >
        <ListItemIcon sx={{ minWidth: 26 }}>
          {node.isDirectory ? (
            <FolderOpenIcon sx={{ fontSize: 16 }} />
          ) : (
            <InsertDriveFileOutlinedIcon sx={{ fontSize: 16 }} />
          )}
        </ListItemIcon>
        <ListItemText
          primary={node.name}
          sx={{ my: 0 }}
          primaryTypographyProps={{ noWrap: true, fontSize: '0.8125rem', lineHeight: 1.2 }}
        />
      </ListItemButton>
      {node.isDirectory && node.children && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          <List disablePadding>
            {node.children.map((child) => (
              <TreeNode key={child.path} depth={depth + 1} node={child} onOpenFile={onOpenFile} />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
};

export const SidebarExplorerTab = () => {
  const { tree } = useAppState().project;
  const { openFile, openProject } = useActions().project;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Button
          fullWidth
          size="small"
          startIcon={<FolderOpenIcon />}
          variant="outlined"
          onClick={() => void openProject()}
        >
          Open folder…
        </Button>
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {tree.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            Open a folder to browse XML files.
          </Typography>
        ) : (
          <List dense disablePadding>
            {tree.map((node) => (
              <TreeNode
                key={node.path}
                depth={0}
                node={node}
                onOpenFile={(filePath) => void openFile(filePath)}
              />
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
};
