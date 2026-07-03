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
        mt={0.75}
        px={1}
        py={0.25}
        borderBottom="1px solid"
      >
        <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>
          {title}
        </Typography>
        {endDecorator}
      </Stack>
      <Stack px={0.5} spacing={0.25}>
        {children}
      </Stack>
    </Stack>
  );
};
