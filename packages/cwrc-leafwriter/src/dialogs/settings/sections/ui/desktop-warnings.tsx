import { ListSubheader } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Toggler } from '../../components/toggler';

const getCommonsUiBridge = () =>
  (
    window as Window & {
      __ljbCommonsUi?: {
        skipEntityDetachConfirm: boolean;
        skipExplorerDeleteConfirm: boolean;
        setSkipEntityDetachConfirm: (value: boolean) => void;
        setSkipExplorerDeleteConfirm: (value: boolean) => void;
      };
    }
  ).__ljbCommonsUi;

export const DesktopWarnings = () => {
  const { t } = useTranslation();
  const bridge = getCommonsUiBridge();
  const [skipDeleteConfirm, setSkipDeleteConfirm] = useState(
    bridge?.skipExplorerDeleteConfirm ?? false,
  );
  const [skipDetachConfirm, setSkipDetachConfirmLocal] = useState(
    bridge?.skipEntityDetachConfirm ?? false,
  );

  useEffect(() => {
    if (!bridge) return;
    setSkipDeleteConfirm(bridge.skipExplorerDeleteConfirm);
    setSkipDetachConfirmLocal(bridge.skipEntityDetachConfirm);
    // `getCommonsUiBridge()` returns a fresh object every render, so this depends
    // on the individual settings it mirrors rather than the bridge itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge?.skipEntityDetachConfirm, bridge?.skipExplorerDeleteConfirm]);

  if (!bridge) return null;

  return (
    <>
      <ListSubheader disableSticky sx={{ lineHeight: 2, pl: 0, mt: 1 }}>
        {t('LW.settings.warnings.title')}
      </ListSubheader>
      <Toggler
        icon="delete"
        onChange={(value) => {
          bridge.setSkipExplorerDeleteConfirm(value);
          setSkipDeleteConfirm(value);
        }}
        title={t('LW.settings.warnings.skip_delete_confirm')}
        type="toggle"
        value={skipDeleteConfirm}
      />
      <Toggler
        icon="link"
        onChange={(value) => {
          bridge.setSkipEntityDetachConfirm(value);
          setSkipDetachConfirmLocal(value);
        }}
        title={t('LW.settings.warnings.skip_entity_detach_confirm')}
        type="toggle"
        value={skipDetachConfirm}
      />
    </>
  );
};
