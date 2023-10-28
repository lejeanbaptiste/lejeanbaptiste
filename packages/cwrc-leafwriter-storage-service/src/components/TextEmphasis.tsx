import { useTheme } from '@mui/material/styles';
import Typography, { type TypographyProps } from '@mui/material/Typography';

interface TextEmphasis extends TypographyProps {
  color?: 'primary' | 'secondary' | 'info' | 'warning' | 'error' | 'inherit';
  disablePadding?: boolean;
  variation?: 'filled' | 'outlined' | 'text';
}

export const TextEmphasis = ({
  color = 'inherit',
  children,
  disablePadding = false,
  variation = 'text',
  ...props
}: TextEmphasis) => {
  const { palette } = useTheme();

  const accentColor =
    color === 'inherit'
      ? 'inherit'
      : palette.mode === 'light'
      ? palette[color].dark
      : palette[color].light;

  const textColor = variation === 'filled' ? palette.background.paper : accentColor;

  return (
    <Typography
      component="span"
      sx={{
        bgcolor: variation === 'filled' ? accentColor : 'inherent',
        borderWidth: variation === 'outlined' ? 1 : 0,
        borderStyle: variation === 'outlined' ? 'solid' : 'none',
        color: textColor,
      }}
      mx={props.mx ? props.mx : disablePadding ? 0 : variation === 'text' ? 0 : 0.5}
      px={props.px ? props.px : variation === 'text' ? 0 : 0.5}
      py={props.py ? props.py : variation === 'text' ? 0 : 0.25}
      borderRadius={props.borderRadius ? props.borderRadius : 1}
      borderColor={
        props.borderColor ? props.borderColor : variation === 'outlined' ? accentColor : 'inherent'
      }
      fontWeight={props.fontWeight ? props.fontWeight : 700}
      variant="inherit"
    >
      {children}
    </Typography>
  );
};
