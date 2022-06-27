import { DialogContent, List, Stack } from '@mui/material';
import React, { useState } from 'react';
import { useAppState } from '../../../overmind';
import CandidateList from './Candidates';
import ManualEntryField from './Candidates/ManualEntryField';
import SideMenu from './SideMenu';
const Main = () => {
    const [authorityInView, setAuthorityInView] = useState([]);
    const { results } = useAppState().lookups;
    const handleSetAuthorityInView = (view) => {
        let InView = [];
        if (view.inView && !authorityInView.includes(view.id)) {
            InView = [...authorityInView, view.id];
        }
        if (!view.inView && authorityInView.includes(view.id)) {
            InView = authorityInView.filter((id) => id !== view.id);
        }
        setAuthorityInView(InView);
    };
    return (React.createElement(Stack, { direction: "row" },
        React.createElement(DialogContent, { sx: { px: 1, pt: 0, pb: 0.5, maxHeight: '65vh' } },
            React.createElement(List, { sx: { '& ul': { padding: 0 } }, subheader: React.createElement("li", null) }, results &&
                [...results].map(([authority, candidates]) => (React.createElement(CandidateList, { key: authority, authority: authority, candidates: candidates, setAuthorityInView: handleSetAuthorityInView })))),
            React.createElement(ManualEntryField, { setAuthorityInView: handleSetAuthorityInView })),
        React.createElement(SideMenu, { authorityInView: authorityInView })));
};
export default Main;
//# sourceMappingURL=index.js.map