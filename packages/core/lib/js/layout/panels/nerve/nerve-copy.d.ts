import 'jquery-ui/ui/widgets/button';
import 'jquery-ui/ui/widgets/selectmenu';
import 'jquery-ui/ui/widgets/tooltip';
interface NerveConfig {
    writer: any;
    parentId: string;
    nerveUrl: string;
}
/**
 * @class Nerve
 * @param {Object} config
 * @param {Writer} config.writer
 * @param {String} config.parentId
 * @param {String} config.nerveUrl
 */
declare function Nerve({ writer, parentId, nerveUrl }: NerveConfig): {
    reset: () => void;
    destroy: () => void;
};
export default Nerve;
//# sourceMappingURL=nerve-copy.d.ts.map