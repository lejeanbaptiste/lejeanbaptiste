import { Typography } from '@mui/material';

export const Test = ({ children }: { children: React.ReactNode }) => {
  return (
    <Typography color="success" variant="h1">
      {children}
      oia
    </Typography>
  );
};
