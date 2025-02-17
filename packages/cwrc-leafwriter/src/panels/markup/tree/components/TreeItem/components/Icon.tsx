import HorizontalRuleRoundedIcon from '@mui/icons-material/HorizontalRuleRounded';
import {
  Box,
  Icon as MuiIcon,
  SvgIconTypeMap,
  useColorScheme,
  useTheme,
  type PaletteMode,
} from '@mui/material';
import { OverridableComponent } from '@mui/material/OverridableComponent';
import { useMemo } from 'react';

type IconProps = {
  color?: string;
  icon?: OverridableComponent<SvgIconTypeMap<{}, 'svg'>> & { muiName: string };
  isEntity?: boolean;
  selected?: boolean;
};

export const Icon = ({
  color = 'inherit',
  icon,
  isEntity = false,
  selected = false,
}: IconProps) => {
  const theme = useTheme();
  const { mode, systemMode } = useColorScheme();

  const inverseThemeMode: PaletteMode = useMemo(
    () => (mode === 'dark' || (mode === 'system' && systemMode === 'dark') ? 'light' : 'dark'),
    [mode, systemMode],
  );

  return (
    <Box display="flex" alignItems="center" justifyContent="center" width={18} height={18} px={0.5}>
      <MuiIcon
        component={icon ? icon : HorizontalRuleRoundedIcon}
        sx={{
          height: 12,
          width: 12,
          color:
            isEntity && selected
              ? color
              : theme.palette.primary[selected ? inverseThemeMode : theme.palette.mode],
        }}
      />
    </Box>
  );
};
