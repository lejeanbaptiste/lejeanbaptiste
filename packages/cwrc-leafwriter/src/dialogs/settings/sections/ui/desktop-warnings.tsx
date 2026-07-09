import { ListSubheader } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Toggler } from '../../components/toggler';

const getCommonsUiBridge = () =>
  (
    window as Window & {
      __ljbCommonsUi?: {
        skipCopyPasteHelp: boolean;
        skipEntityDetachConfirm: boolean;
        skipExplorerDeleteConfirm: boolean;
        setSkipCopyPasteHelp: (value: boolean) => void;
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
  const [skipCopyPasteHelp, setSkipCopyPasteHelpLocal] = useState(
    bridge?.skipCopyPasteHelp ?? false,
  );
  const [skipDetachConfirm, setSkipDetachConfirmLocal] = useState(
    bridge?.skipEntityDetachConfirm ?? false,
  );

  useEffect(() => {
    if (!bridge) return;
    setSkipDeleteConfirm(bridge.skipExplorerDeleteConfirm);
    setSkipCopyPasteHelpLocal(bridge.skipCopyPasteHelp);
    setSkipDetachConfirmLocal(bridge.skipEntityDetachConfirm);
  }, [bridge?.skipCopyPasteHelp, bridge?.skipEntityDetachConfirm, bridge?.skipExplorerDeleteConfirm]);

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
        icon="copy"
        onChange={(value) => {
          bridge.setSkipCopyPasteHelp(value);
          setSkipCopyPasteHelpLocal(value);
        }}
        title={t('LW.settings.warnings.skip_copy_paste_help')}
        type="toggle"
        value={skipCopyPasteHelp}
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
