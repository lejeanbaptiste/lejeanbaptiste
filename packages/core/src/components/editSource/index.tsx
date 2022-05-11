import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import { useActions, useAppState } from '../../overmind';
import React, { FC, Suspense, useEffect, useState } from 'react';
const Editor = React.lazy(() => import('./Editor'));

export interface IEditSourceDialogProps {
  content?: string;
  open: boolean;
}

const EditSourceDialog: FC = () => {
  const [originalContent, setOriginalContent] = useState('');
  const [content, setContent] = useState('');
  const { editSourceProps } = useAppState().ui;
  const { closeEditSourceDialog, processEditSource } = useActions().ui;

  useEffect(() => {
    if (editSourceProps.content) setContent(editSourceProps.content);
    if (editSourceProps.content) setOriginalContent(editSourceProps.content);
  }, [editSourceProps.content]);

  const handleUpdateContent = (value: string) => {
    setContent(value);
  };

  const handleClose = () => {
    closeEditSourceDialog();
  };

  const handleOk = () => {
    if (content === originalContent) {
      closeEditSourceDialog();
      return;
    }

    processEditSource(content);
  };

  const Progress = () => (
    <Box display="flex" height={600} width="100%" alignItems="center" justifyContent="center">
      <CircularProgress sx={{ width: '100%' }} />
    </Box>
  );

  return (
    <Dialog aria-labelledby="edit-source-title" fullWidth maxWidth="lg" open={editSourceProps.open}>
      <DialogTitle
        id="edit-source-title"
        sx={{ textAlign: 'center', fontSize: '1rem', padding: 0 }}
      >
        Edit Source
      </DialogTitle>
      <DialogContent sx={{ minHeight: 600, padding: 0 }}>
        <Suspense fallback={<Progress />}>
          {editSourceProps.content && (
            <Editor content={editSourceProps.content} updateContent={handleUpdateContent} />
          )}
        </Suspense>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button autoFocus onClick={handleClose} variant="outlined">
          Cancel
        </Button>
        <Button onClick={handleOk} variant="contained">
          Ok
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditSourceDialog;
