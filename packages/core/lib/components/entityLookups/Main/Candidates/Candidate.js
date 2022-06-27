import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { IconButton, ListItem, ListItemButton, ListItemText } from '@mui/material';
import React, { useState } from 'react';
import { useActions, useAppState } from '../../../../overmind';
const Candidate = ({ description, id, name, repository, uri }) => {
    const { closeEntityLookupsDialog } = useActions().ui;
    const { selected } = useAppState().lookups;
    const { setSelected, processSelected } = useActions().lookups;
    const [hover, setHover] = useState(false);
    const handleOnClick = () => {
        const entry = { id, uri, name, repository };
        setSelected(entry);
    };
    const handleOnDoubleClick = () => {
        if (uri !== selected?.uri)
            return;
        const link = processSelected();
        if (!link)
            return;
        closeEntityLookupsDialog(link);
    };
    return (React.createElement(ListItem, { dense: true, disablePadding: true, onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false), secondaryAction: React.createElement(IconButton, { "aria-label": "open-uri", edge: "end", size: "small", target: "_blank", href: uri }, hover && React.createElement(OpenInNewIcon, { fontSize: "inherit" })), selected: selected?.uri === uri, sx: { my: 0.5 }, onClick: handleOnClick, onDoubleClick: handleOnDoubleClick },
        React.createElement(ListItemButton, { sx: { borderRadius: 1 } },
            React.createElement(ListItemText, { primary: name, secondary: description && React.createElement("span", { dangerouslySetInnerHTML: { __html: description } }) }))));
};
export default Candidate;
//# sourceMappingURL=Candidate.js.map