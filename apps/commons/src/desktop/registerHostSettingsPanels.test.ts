import {
  clearHostSettingsPanels,
  getProjectSettingsPanel,
} from '../../../../packages/cwrc-leafwriter/src/dialogs/settings/hostPanels';
import { registerHostSettingsPanels } from './registerHostSettingsPanels';
import { ProjectSettingsPanel } from './projectMetadataEditor/ProjectSettingsPanel';

describe('registerHostSettingsPanels', () => {
  beforeEach(() => clearHostSettingsPanels());
  afterEach(() => clearHostSettingsPanels());

  it('leaves the editor package with no project panel until the host registers one', () => {
    expect(getProjectSettingsPanel()).toBeNull();
  });

  // The settings dialog renders the Project tab only when a panel is registered,
  // so dropping the call from the entry point would silently remove the tab
  // rather than fail. This is the check that would notice.
  it("hands the editor package commons' project settings panel", () => {
    registerHostSettingsPanels();
    expect(getProjectSettingsPanel()).toBe(ProjectSettingsPanel);
  });
});
