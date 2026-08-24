import { registerProjectSettingsPanel } from '../../../../packages/cwrc-leafwriter/src/dialogs/settings/hostPanels';
import { ProjectSettingsPanel } from './projectMetadataEditor/ProjectSettingsPanel';

/**
 * Hands the editor package the settings panels this app owns.
 *
 * `@cwrc/leafwriter` renders the settings dialog but deliberately does not
 * import the app (see `dialogs/settings/hostPanels`), so anything commons
 * contributes has to be registered from here. Called once from the entry point,
 * at module init — if it stops being called, the dialog simply renders no
 * Project tab, with no error to notice, which is what the accompanying test
 * guards against.
 */
export const registerHostSettingsPanels = (): void => {
  registerProjectSettingsPanel(ProjectSettingsPanel);
};
