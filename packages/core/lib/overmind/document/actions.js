export const setInitialStateSchema = ({ state }, id) => {
    state.document.schemaId = id;
};
export const setLoaded = ({ state }, value) => {
    state.document.loaded = value;
};
export const setSchema = ({ state }, id) => {
    window.writer?.event('schemaChanged').publish(id);
    state.document.schemaId = id;
    return state.editor.schemas.find((schema) => schema.id === id);
};
export const setDocumentUrl = ({ state }, url) => {
    state.document.url = url;
};
export const updateContent = ({ state }, content) => {
    if (!state.document.xml)
        return;
    state.document.xml = content;
};
export const clear = ({ state }) => {
    state.document.schemaId = '';
    state.document.url = undefined;
    state.document.xml = undefined;
};
export const loadDocumentXML = ({ actions }, content) => {
    window.writer?.loadDocumentXML(content);
    actions.document.updateContent(content);
};
//# sourceMappingURL=actions.js.map