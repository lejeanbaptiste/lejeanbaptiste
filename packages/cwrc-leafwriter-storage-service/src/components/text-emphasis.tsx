import { useTheme } from '@mui/material/styles';
import Typography, { type TypographyProps } from '@mui/material/Typography';

interface TextEmphasis extends TypographyProps {
  color?: 'primary' | 'secondary' | 'info' | 'warning' | 'error';
  disablePadding?: boolean;
  variation?: 'filled' | 'outlined' | 'text';
}

export const TextEmphasis = ({
  color,
  children,
  disablePadding = false,
  variation = 'text',
  ...props
}: TextEmphasis) => {
  const theme = useTheme();

  const accentColor = color ? theme.palette[color].main : theme.palette.text.primary;

  return (
    <Typography
      borderColor={(props.borderColor ?? variation === 'outlined') ? accentColor : 'inherent'}
      borderRadius={props.borderRadius ?? 1}
      component="span"
      fontWeight={props.fontWeight ?? 700}
      mx={props.mx ?? (disablePadding ? 0 : variation === 'text' ? 0 : 0.5)}
      px={props.px ?? (variation === 'text' ? 0 : 0.5)}
      py={props.py ?? (variation === 'text' ? 0 : 0.25)}
      sx={[
        { color: accentColor },
        variation === 'filled'
          ? { backgroundColor: accentColor, color: theme.palette.background.paper }
          : { backgroundColor: 'inherent', color: accentColor },
        variation === 'outlined'
          ? { borderWidth: 1, borderStyle: 'solid' }
          : { borderWidth: 0, borderStyle: 'none' },
      ]}
      variant="inherit"
    >
      {children}
    </Typography>
  );
};
