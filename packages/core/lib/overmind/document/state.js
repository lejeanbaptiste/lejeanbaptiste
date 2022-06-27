import { derived } from 'overmind';
export const state = {
    loaded: false,
    schemaId: '',
    schemaName: derived((state, rootState) => {
        const schema = rootState.editor.schemas.find((sch) => sch.id === state.schemaId);
        if (!schema)
            return '';
        return schema.name;
    }),
};
//# sourceMappingURL=state.js.map