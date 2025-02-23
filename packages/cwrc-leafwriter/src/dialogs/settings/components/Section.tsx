import { Stack, Typography } from '@mui/material';

export interface SectionProps extends React.PropsWithChildren {
  endDecorator?: React.ReactNode;
  id: string;
  title: React.ReactNode;
}

export const Section = ({ children, endDecorator, id, title }: SectionProps) => {
  return (
    <Stack id={id}>
      <Stack
        direction="row"
        justifyContent="space-between"
        mt={1.5}
        px={2}
        py={0.5}
        borderBottom="1px solid"
      >
        <Typography variant="subtitle1" sx={{ textTransform: 'capitalize' }}>
          {title}
        </Typography>
        {endDecorator}
      </Stack>
      <Stack px={1} spacing={1}>
        {children}
      </Stack>
    </Stack>
  );
};
