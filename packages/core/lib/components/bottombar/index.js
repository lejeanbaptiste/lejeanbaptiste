import { Box, Link, Paper, Stack } from '@mui/material';
import React from 'react';
import AnnotationMode from './AnnotationMode';
import EditorMode from './EditorMode';
import Schema from './Schema';
const BottomBar = () => {
    const version = 'dev'; //webpackEnv?.LEAFWRITER_VERSION ?? '';
    return (React.createElement(Paper, { elevation: 0, square: true, sx: {
            width: '100%',
            backgroundColor: ({ palette }) => palette.mode === 'dark' ? palette.background.paper : '#f5f5f5',
        } },
        React.createElement(Stack, { direction: "row", alignItems: "center", spacing: 2, px: 2 },
            React.createElement(EditorMode, null),
            React.createElement(AnnotationMode, null),
            React.createElement(Schema, null),
            React.createElement(Box, { flexGrow: 1 }),
            React.createElement(Link, { color: "text.secondary", variant: "caption", href: `https://github.com/cwrc/CWRC-WriterBase/releases/tag/v${version}`, rel: "noopener", target: "_blank", title: "GitHub Release Notes" }, `LEAF-Writer ${version}`),
            React.createElement(Link, { color: "text.secondary", variant: "caption", href: "https://www.tiny.cloud", target: "_blank", rel: "noopener", title: "Powered by Tiny" }, "Powered by Tiny"))));
};
export default BottomBar;
//# sourceMappingURL=index.js.map