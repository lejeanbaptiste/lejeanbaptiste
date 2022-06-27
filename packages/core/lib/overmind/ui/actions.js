import { supportedLanguages } from '../../utilities/util';
export const onInitializeOvermind = ({ actions }, overmind) => {
    //DARK MODE
    const prefPaletteMode = localStorage.getItem('themeAppearance') ?? 'auto';
    actions.ui.setThemeAppearance(prefPaletteMode);
};
export const setThemeAppearance = ({ state, actions }, value) => {
    state.ui.themeAppearance = value;
    const darkMode = value === 'auto'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : value === 'light'
            ? false
            : true;
    actions.ui.setDarkMode(darkMode);
    localStorage.setItem('themeAppearance', value);
};
export const setDarkMode = ({ state }, value) => {
    state.ui.darkMode = value;
};
export const closeContextMenu = ({ state }) => {
    state.ui.contextMenu = { show: false };
};
export const showContextMenu = ({ state }, value) => {
    state.ui.contextMenu = value;
};
export const updateTitle = ({ state }, title) => {
    state.ui.title = title;
};
export const resetPreferences = () => {
    localStorage.removeItem('paletteMode');
};
export const openPopup = ({ state }, props) => {
    state.ui.popupProps = { ...props, open: true };
};
export const closePopup = ({ state }, id) => {
    state.ui.popupProps = { open: false };
};
export const openEditSourceDialog = ({ state }, content) => {
    state.ui.editSourceProps = { content, open: true };
};
export const closeEditSourceDialog = ({ state }) => {
    state.ui.editSourceProps = { open: false };
};
export const processEditSource = ({ state, actions }, newContent) => {
    state.ui.editSourceProps = { open: false };
    actions.document.loadDocumentXML(newContent);
};
export const openEntityLookupsDialog = ({ state }, props) => {
    state.ui.entityLookupDialogProps = { ...props, open: true };
};
export const closeEntityLookupsDialog = ({ state: { ui } }, link) => {
    const dialog = ui.entityLookupDialogProps;
    if (link && dialog.onClose)
        dialog.onClose(link);
    ui.entityLookupDialogProps = { open: false };
};
export const switchLanguage = ({ state }, value) => {
    const language = supportedLanguages.get(value) ?? {
        code: 'en-CA',
        name: 'english',
        shortName: 'en',
    };
    state.ui.language = language;
    return value;
};
export const openSettingsDialog = ({ state }) => {
    state.ui.settingsDialogOpen = true;
};
export const closeSettingsDialog = ({ state }) => {
    state.ui.settingsDialogOpen = false;
};
//# sourceMappingURL=actions.js.map