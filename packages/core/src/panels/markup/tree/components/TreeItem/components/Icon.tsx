import HorizontalRuleRoundedIcon from '@mui/icons-material/HorizontalRuleRounded';
import { Box, Icon as MuiIcon, SvgIconTypeMap, useTheme, type PaletteMode } from '@mui/material';
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
  const { palette } = useTheme();

  const inverseThemeMode: PaletteMode = useMemo(
    () => (palette.mode === 'light' ? 'dark' : 'light'),
    [palette.mode],
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
              : palette.primary[selected ? inverseThemeMode : palette.mode],
        }}
      />
    </Box>
  );
};
