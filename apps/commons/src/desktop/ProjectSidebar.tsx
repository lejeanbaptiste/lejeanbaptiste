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
        onClick={() => void handleClick()}
        onDoubleClick={handleDoubleClick}
        sx={{ pl: 1 + depth * 1.5 }}
      >
        <ListItemIcon sx={{ minWidth: 32 }}>
          {node.isDirectory ? (
            <FolderOpenIcon fontSize="small" />
          ) : (
            <InsertDriveFileOutlinedIcon fontSize="small" />
          )}
        </ListItemIcon>
        <ListItemText
          primary={node.name}
          primaryTypographyProps={{ noWrap: true, fontSize: '0.875rem' }}
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

export const ProjectSidebar = () => {
  const { rootPath, tree } = useAppState().project;
  const { openFile, openProjectFolder } = useActions().project;

  return (
    <Box
      sx={{
        width: 260,
        minWidth: 260,
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Button
          fullWidth
          size="small"
          startIcon={<FolderOpenIcon />}
          variant="outlined"
          onClick={() => void openProjectFolder()}
        >
          Open folder
        </Button>
        {rootPath && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 1, wordBreak: 'break-all' }}
          >
            {rootPath}
          </Typography>
        )}
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
