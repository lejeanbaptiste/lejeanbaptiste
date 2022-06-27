import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import { Box, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import Tooltip, { tooltipClasses } from '@mui/material/Tooltip';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../overmind';
const options = [
    { name: 'light', Icon: Brightness7Icon },
    { name: 'auto', Icon: Brightness4Icon },
    { name: 'dark', Icon: DarkModeIcon },
];
const StyledToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
    '& .MuiToggleButtonGroup-grouped': {
        margin: theme.spacing(0.5),
        border: 0,
        '&.Mui-disabled': { border: 0 },
        '&:not(:first-of-type)': {
            borderRadius: theme.shape.borderRadius,
        },
        '&:first-of-type': {
            borderRadius: theme.shape.borderRadius,
        },
    },
}));
const StyledToolTip = styled(({ className, ...props }) => (React.createElement(Tooltip, { ...props, classes: { popper: className } })))(({ theme }) => ({
    [`& .${tooltipClasses.tooltip}`]: {
        textTransform: 'capitalize !important',
    },
    [`& .${tooltipClasses.tooltipPlacementBottom}`]: {
        marginTop: '10px !important',
    },
}));
const ThemeAppearance = () => {
    const { t } = useTranslation();
    const { setThemeAppearance } = useActions().ui;
    const { themeAppearance } = useAppState().ui;
    const changePaletteMode = (event, value) => {
        if (!value || value === themeAppearance)
            return;
        setThemeAppearance(value);
    };
    return (React.createElement(Stack, { direction: "row", alignItems: "center" },
        React.createElement(SettingsBrightnessIcon, { sx: { mx: 1, height: 18, width: 18 } }),
        React.createElement(Typography, null, t('ui:appearance')),
        React.createElement(Box, { flexGrow: 1 }),
        React.createElement(Stack, { direction: "row" },
            React.createElement(StyledToggleButtonGroup, { "aria-label": "appearance", exclusive: true, size: "small", onChange: changePaletteMode, value: themeAppearance }, options.map(({ name, Icon }) => (React.createElement(ToggleButton, { key: name, color: "primary", "aria-label": name, size: "small", value: t(`ui:${name}`) },
                React.createElement(StyledToolTip, { enterDelay: 1000, title: t(`ui:${name}`) ?? name },
                    React.createElement(Icon, { sx: { height: 16, width: 16 } })))))))));
};
export default ThemeAppearance;
//# sourceMappingURL=ThemeAppearance.js.map