import { Stack, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useState } from 'react';
import { useWindowSize } from 'react-use';
import { CreateFolderDialog, CreateRepoDialog } from '../../dialogs';
import { Collection } from './collection';
import { Topbar } from './topbar';

export const Main = () => {
  const theme = useTheme();
  const isSM = useMediaQuery(theme.breakpoints.down('sm'));
  const isMD = useMediaQuery(theme.breakpoints.down('md'));

  const [openRepoDialog, setOpenRepoDialog] = useState(false);
  const [openFolderDialog, setOpenFolderDialog] = useState(false);

  const [topBarHeight, setTopBarHeight] = useState(0);
  const { width, height } = useWindowSize();
  const heighBase = isSM
    ? height - 32 - topBarHeight // 32px (heigh of side bar stacked on top of main section)
    : isMD
    ? height - topBarHeight
    : 600 - topBarHeight + 8;
  const [collectionHeight, setCollectionHeight] = useState(heighBase);

  useEffect(() => {
    setCollectionHeight(heighBase - topBarHeight);
  }, [height, width, topBarHeight]);

  const updateTopBarSize = (rect: DOMRect) => {
    setTopBarHeight(rect.height);
  };

  const toggleCreateDialog = (type: 'repo' | 'folder') => {
    type === 'repo' ? setOpenRepoDialog(true) : setOpenFolderDialog(true);
  };

  const handleCloseRepoDialog = () => setOpenRepoDialog(false);
  const handleCloseFolderDialog = () => setOpenFolderDialog(false);

  return (
    <Stack width="100%" ml={isSM ? 0 : 2} pr={isSM ? 0 : 2}>
      <Topbar onChangeSize={updateTopBarSize} onOpenCreateDialog={toggleCreateDialog} />
      <Collection height={collectionHeight} />
      {openRepoDialog && (
        <CreateRepoDialog
          open={openRepoDialog}
          onCancel={handleCloseRepoDialog}
          onCreate={handleCloseRepoDialog}
        />
      )}
      {openFolderDialog && (
        <CreateFolderDialog
          open={openFolderDialog}
          onCancel={handleCloseFolderDialog}
          onCreate={handleCloseFolderDialog}
        />
      )}
    </Stack>
  );
};
