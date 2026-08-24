import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Toggler } from '../../components/toggler';

const getCommonsUiBridge = () =>
  (
    window as Window & {
      __ljbCommonsUi?: {
        rememberWorkspaceOnStartup: boolean;
        setRememberWorkspaceOnStartup: (value: boolean) => void | Promise<void>;
      };
    }
  ).__ljbCommonsUi;

export const DesktopStartup = () => {
  const { t } = useTranslation();
  const bridge = getCommonsUiBridge();
  const [rememberWorkspaceOnStartup, setRememberWorkspaceOnStartupLocal] = useState(
    bridge?.rememberWorkspaceOnStartup ?? true,
  );

  useEffect(() => {
    if (!bridge) return;
    setRememberWorkspaceOnStartupLocal(bridge.rememberWorkspaceOnStartup);
    // `getCommonsUiBridge()` returns a fresh object every render, so this depends
    // on the individual settings it mirrors rather than the bridge itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge?.rememberWorkspaceOnStartup]);

  if (!bridge) return null;

  return (
    <Toggler
      icon="settings"
      onChange={(value) => {
        void bridge.setRememberWorkspaceOnStartup(value);
        setRememberWorkspaceOnStartupLocal(value);
      }}
      title={t('LW.desktop.settings.remember_workspace_on_startup')}
      type="toggle"
      value={rememberWorkspaceOnStartup}
    />
  );
};
