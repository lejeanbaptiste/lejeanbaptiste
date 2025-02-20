import { Stack, Tooltip, Typography } from '@mui/material';

export interface LabelProps {
  documentation?: string;
  fullName?: string;
  invalid?: boolean;
  name: string;
}

export const Label = ({ documentation, fullName, invalid, name }: LabelProps) => {
  return (
    <Stack sx={{ flexGrow: 1 }}>
      <Tooltip enterDelay={1500} title={documentation}>
        <Typography color={invalid ? 'textSecondary' : 'textPrimary'} variant="body2">
          {name}
        </Typography>
      </Tooltip>
      {fullName && (
        <Typography color="textSecondary" textTransform="capitalize" variant="caption">
          {fullName}
        </Typography>
      )}
    </Stack>
  );
};
