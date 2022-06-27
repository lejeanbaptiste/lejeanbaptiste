import TranslateIcon from '@mui/icons-material/Translate';
import { Box, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../overmind';
import { supportedLanguages } from '../../utilities/util';
const StyledToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
    '& .MuiToggleButtonGroup-grouped': {
        margin: theme.spacing(0.5),
        border: 0,
        '&.Mui-disabled': {
            border: 0,
        },
        '&:not(:first-of-type)': {
            borderRadius: theme.shape.borderRadius,
        },
        '&:first-of-type': {
            borderRadius: theme.shape.borderRadius,
        },
    },
}));
const Language = () => {
    const { t, i18n } = useTranslation();
    const { language } = useAppState().ui;
    const { switchLanguage } = useActions().ui;
    const changeLanguage = (event, code) => {
        if (!code)
            code = language.code;
        switchLanguage(code);
        i18n.changeLanguage(code);
    };
    return (React.createElement(Stack, { direction: "row", alignItems: "center" },
        React.createElement(TranslateIcon, { sx: { mx: 1, height: 18, width: 18 } }),
        React.createElement(Typography, null, t('ui:language')),
        React.createElement(Box, { flexGrow: 1 }),
        React.createElement(Stack, { direction: "row" },
            React.createElement(StyledToggleButtonGroup, { "aria-label": "language", exclusive: true, onChange: changeLanguage, value: language.code }, Array.from(supportedLanguages.values()).map(({ code, shortName }) => (React.createElement(ToggleButton, { key: code, "aria-label": shortName, color: "primary", size: "small", sx: { height: 28 }, value: code }, shortName)))))));
};
export default Language;
//# sourceMappingURL=Language.js.map