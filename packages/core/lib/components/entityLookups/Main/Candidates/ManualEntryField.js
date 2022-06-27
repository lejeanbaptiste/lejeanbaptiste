import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, FormControl, FormHelperText, IconButton, Input, InputAdornment, InputLabel, Typography, } from '@mui/material';
import React, { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { useActions, useAppState } from '../../../../overmind';
const ManualEntryField = ({ setAuthorityInView }) => {
    const { isUriValid, manualInput } = useAppState().lookups;
    const { setManualInput, setSelected } = useActions().lookups;
    const { ref, inView, entry } = useInView({
        /* Optional options */
        threshold: 0,
    });
    useEffect(() => {
        if (entry)
            setAuthorityInView({ id: entry.target.id, inView });
    }, [inView]);
    const handleChange = (event) => {
        const value = event.target.value;
        setManualInput(value);
    };
    const handleclick = () => {
        setSelected();
    };
    return (React.createElement(Box, { ref: ref, id: "other", px: 0.5, pb: 1 },
        React.createElement(Box, { sx: {
                px: 1,
                borderBottomWidth: 1,
                borderBottomStyle: 'solid',
                borderBottomColor: ({ palette }) => palette.grey[700],
                backgroundColor: ({ palette }) => {
                    return palette.mode === 'dark' ? palette.grey[800] : palette.background.paper;
                },
            } },
            React.createElement(Typography, { sx: {
                    color: ({ palette }) => palette.text.secondary,
                    fontSize: '0.875rem',
                    lineHeight: 2.5,
                    textTransform: 'uppercase',
                } }, "Other / Manual Input")),
        React.createElement(Box, { my: 1.5, ml: 2, pr: 2 },
            React.createElement(FormControl, { fullWidth: true, variant: "standard" },
                React.createElement(InputLabel, { htmlFor: "manual-uri" }, "URI"),
                React.createElement(Input, { endAdornment: React.createElement(InputAdornment, { position: "end" }, manualInput !== '' && isUriValid && (React.createElement(IconButton, { "aria-label": "open-manual-uri", size: "small", target: "_blank", href: manualInput },
                        React.createElement(OpenInNewIcon, { fontSize: "inherit" })))), fullWidth: true, error: !isUriValid, id: "manual-uri", onClick: handleclick, onChange: handleChange, value: manualInput }),
                !isUriValid && (React.createElement(FormHelperText, { error: !isUriValid, id: "uri-error-text" }, "Must be a valid URI"))))));
};
export default ManualEntryField;
//# sourceMappingURL=ManualEntryField.js.map