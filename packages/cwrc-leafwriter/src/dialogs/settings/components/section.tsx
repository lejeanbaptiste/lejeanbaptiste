import { Stack, Typography } from '@mui/material';

export interface SectionProps extends React.PropsWithChildren {
  endDecorator?: React.ReactNode;
  id: string;
  title: React.ReactNode;
}

export const Section = ({ children, endDecorator, id, title }: SectionProps) => {
  return (
    <Stack
      id={id}
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2.5,
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        px={1}
        py={0.75}
        borderBottom="1px solid"
        borderColor="divider"
        bgcolor="rgba(0, 0, 0, 0.02)"
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.92rem' }}>
          {title}
        </Typography>
        {endDecorator}
      </Stack>
      <Stack px={1} py={0.75} spacing={0.5}>
        {children}
      </Stack>
    </Stack>
  );
};
