import { Stack } from '@mui/material';
import { BugReport } from './bug-report';

export const StatusBar = () => {
  return (
    <Stack justifyContent="center" alignItems="center" mt={5}>
      <BugReport />
    </Stack>
  );
};
