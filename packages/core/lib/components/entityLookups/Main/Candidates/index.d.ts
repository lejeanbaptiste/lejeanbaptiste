import { type FC } from 'react';
import type { Authority, IResult } from '../../types';
interface CandidateListProps {
    authority: Authority;
    candidates: IResult[];
    setAuthorityInView: (view: {
        id: string;
        inView: boolean;
    }) => void;
}
declare const CandidateList: FC<CandidateListProps>;
export default CandidateList;
//# sourceMappingURL=index.d.ts.map