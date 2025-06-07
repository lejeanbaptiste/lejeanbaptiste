import Box, { BoxProps } from '@mui/material/Box';
import { useColorScheme } from '@mui/material/styles';

interface LogoProps extends BoxProps {
  height?: CSSStyleDeclaration['height'] | number;
  size?: 'large' | 'small';
  variant?: 'horizontal' | 'vertical';
}

export const Logo = ({
  height = 'auto',
  size = 'large',
  variant = 'horizontal',
  ...props
}: LogoProps) => {
  const { mode, systemMode } = useColorScheme();

  const themeMode = systemMode ?? mode ?? 'light';

  return (
    <Box display="flex" {...props}>
      <img
        alt="LEAF-Writer"
        height={height}
        src={`/assets/logo/logo-${variant}-${size}-${themeMode}.png`}
      />
    </Box>
  );
};
