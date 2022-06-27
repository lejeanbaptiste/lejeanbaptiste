export = Nerve;
/**
 * @class Nerve
 * @param {Object} config
 * @param {Writer} config.writer
 * @param {String} config.parentId
 * @param {String} config.nerveUrl
 */
declare function Nerve(config: {
    writer: Writer;
    parentId: string;
    nerveUrl: string;
}): {
    reset: () => void;
    destroy: () => void;
};
declare class Nerve {
    /**
     * @class Nerve
     * @param {Object} config
     * @param {Writer} config.writer
     * @param {String} config.parentId
     * @param {String} config.nerveUrl
     */
    constructor(config: {
        writer: Writer;
        parentId: string;
        nerveUrl: string;
    });
}
//# sourceMappingURL=__nerve.d.ts.map