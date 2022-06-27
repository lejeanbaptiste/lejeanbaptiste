import { Box, ListSubheader } from '@mui/material';
import React, { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import Candidate from './Candidate';
const CandidateList = ({ authority, candidates, setAuthorityInView }) => {
    const { ref, inView, entry } = useInView({
        /* Optional options */
        threshold: 0,
    });
    useEffect(() => {
        if (entry)
            setAuthorityInView({ id: entry.target.id, inView });
    }, [inView]);
    return (React.createElement(Box, { ref: ref, id: authority, sx: { maxWidth: '90%' } },
        React.createElement(ListSubheader, { id: authority, className: "authority-lookup-list", sx: {
                borderBottomWidth: 1,
                borderBottomStyle: 'solid',
                borderBottomColor: ({ palette }) => palette.grey[500],
                backgroundColor: ({ palette }) => {
                    return palette.mode === 'dark' ? palette.grey[800] : palette.background.paper;
                },
                lineHeight: 2.5,
                textTransform: 'uppercase',
            } }, authority),
        candidates.map((candidate) => (React.createElement(Candidate, { key: candidate.uri, ...candidate })))));
};
export default CandidateList;
//# sourceMappingURL=index.js.map