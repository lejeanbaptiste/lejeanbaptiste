import { Stack, Typography } from '@mui/material';

export interface SectionProps extends React.PropsWithChildren {
  description?: React.ReactNode;
  endDecorator?: React.ReactNode;
  id: string;
  title: React.ReactNode;
}

export const Section = ({ children, description, endDecorator, id, title }: SectionProps) => {
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
        alignItems="flex-start"
        px={1}
        py={0.75}
        borderBottom="1px solid"
        borderColor="divider"
        bgcolor="rgba(0, 0, 0, 0.02)"
      >
        <Stack>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.92rem' }}>
            {title}
          </Typography>
          {description && (
            <Typography
              color="textSecondary"
              variant="caption"
              sx={{ lineHeight: 1.3, mt: 0.25, maxWidth: 520 }}
            >
              {description}
            </Typography>
          )}
        </Stack>
        {endDecorator}
      </Stack>
      <Stack px={1} py={0.75} spacing={0.5}>
        {children}
      </Stack>
    </Stack>
  );
};
