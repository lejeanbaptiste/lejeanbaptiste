import 'jquery-ui/ui/effect';
import 'jquery-ui/ui/widgets/button';
import 'jquery-ui/ui/widgets/selectmenu';
import 'jquery-ui/ui/widgets/tooltip';
import Writer from '../../../Writer';
interface EntitiesListProps {
    parentId: string;
    writer: Writer;
}
/**
 * @class EntitiesList
 * @fires Writer#entitiesListInitialized
 * @param {Object} config destructured
 * @param {Writer} config.writer
 * @param {String} config.parentId
 */
declare class EntitiesList {
    readonly id: string;
    readonly $entities: JQuery<HTMLElement>;
    readonly writer: Writer;
    enabled: boolean;
    isConvert: boolean;
    updatePending: boolean;
    constructor({ parentId, writer }: EntitiesListProps);
    private acceptAll;
    private getFilter;
    private acceptEntity;
    private setFilter;
    private getCandidates;
    private rejectEntity;
    private acceptMatching;
    private rejectMatching;
    private rejectAll;
    private handleDone;
    private clear;
    private getSorting;
    private getMatchesForEntity;
    private getEntityView;
    private remove;
    convertEntities(): void;
    update(): void;
    enable(forceUpdate: boolean): void;
    disable(): void;
    destroy(): void;
}
export default EntitiesList;
//# sourceMappingURL=index.d.ts.map