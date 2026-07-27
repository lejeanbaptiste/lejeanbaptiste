import { FormControl, List, MenuItem, Select, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../../../overmind';
import type { MultiFileSnapshotTrigger } from '../../../../overmind/editor/state';
import { Toggler } from '../../components';

const SNAPSHOT_TRIGGERS: MultiFileSnapshotTrigger[] = ['multiFile', 'corpusWide', 'none'];

export const Guardrails = () => {
  const {
    allowSourceModeSchemaViolations,
    enableMultiFileAutomation,
    enableXmlEditing,
    multiFileSnapshotBefore,
    validateMultiFileAutomation,
  } = useAppState().editor;
  const {
    setAllowSourceModeSchemaViolations,
    setEnableMultiFileAutomation,
    setEnableXmlEditing,
    setMultiFileSnapshotBefore,
    setValidateMultiFileAutomation,
  } = useActions().editor;
  const { t } = useTranslation();

  return (
    <List dense>
      <Toggler
        icon="code"
        onChange={setEnableXmlEditing}
        title={t('LW.settings.guardrails.enable_xml_editing')}
        type="toggle"
        value={enableXmlEditing}
      />
      {enableXmlEditing && (
        <Toggler
          icon="validate"
          onChange={setAllowSourceModeSchemaViolations}
          title={t('LW.settings.guardrails.allow_source_mode_schema_violations')}
          type="toggle"
          value={allowSourceModeSchemaViolations}
        />
      )}
      <Toggler
        icon="insertTag"
        onChange={setEnableMultiFileAutomation}
        title={t('LW.settings.guardrails.enable_multi_file_automation')}
        type="toggle"
        value={enableMultiFileAutomation}
      />
      {enableMultiFileAutomation && (
        <FormControl size="small" sx={{ minWidth: 280, mt: 0.5 }}>
          <Typography variant="body2" sx={{ fontSize: '0.86rem', mb: 0.25 }}>
            {t('LW.settings.guardrails.snapshot_before')}
          </Typography>
          <Select
            value={multiFileSnapshotBefore}
            onChange={(event) =>
              setMultiFileSnapshotBefore(event.target.value as MultiFileSnapshotTrigger)
            }
            sx={{ fontSize: '0.86rem' }}
          >
            {SNAPSHOT_TRIGGERS.map((value) => (
              <MenuItem key={value} value={value} sx={{ fontSize: '0.86rem' }}>
                {t(`LW.settings.guardrails.snapshot_before_options.${value}`)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
      {enableMultiFileAutomation && (
        <Toggler
          icon="validate"
          onChange={setValidateMultiFileAutomation}
          title={t('LW.settings.guardrails.validate_multi_file_automation')}
          type="toggle"
          value={validateMultiFileAutomation}
        />
      )}
    </List>
  );
};
