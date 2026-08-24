import { Typography } from '@mui/material';
import { Trans } from 'react-i18next';
import { TextEmphasis } from '../../components';
import i18next from '../../i18n';
import { Schema } from '../../types';
import Writer from '../Writer';

export interface ProcessSchemaProps {
  doc: XMLDocument;
  docSchema?: { rng?: string; css?: string };
  rootIsSupported?: boolean;
  rootName?: string;
  schemaFound?: boolean;
  schemaId?: string;
  schemaLoaded?: boolean;
  schemaSupported?: boolean;
  selectedSchema?: Schema;
  writer: Writer;
}

// * The following line is need for VSC extension i18n ally to work
// useTranslation(['leafwriter']);
const { t } = i18next;

const isDesktopApp = () =>
  typeof window !== 'undefined' && !!(window as Window & { electronAPI?: unknown }).electronAPI;

const handleSchemaCancel = (writer: Writer) => {
  if (isDesktopApp()) return;
  writer.overmindActions.editor.closeEditor();
};

const getPossibleSupportedSchemas = (writer: Writer, rootName: string) => {
  const mappingIds = writer.schemaManager.getMappingIdsFromRoot(rootName);
  const { schemasList } = writer.overmindState.editor as { schemasList: Schema[] };
  return schemasList.filter((schema) => mappingIds.includes(schema.mapping));
};

export const openProcessIssueDialog = (params: ProcessSchemaProps, action?: string) => {
  window.writer.dialogManager.getDialog('loadingindicator')?.hide?.();

  if (action === 'selectSchema') return promptSelectSchema(params);
  if (action === 'addSchema') return promptAddSchema(params);

  const { rootIsSupported, schemaFound, schemaSupported, schemaLoaded } = params;

  if (!rootIsSupported) return promptRootNotSupported(params);
  if (!schemaFound) return promptSchemaNotFound(params);
  if (!schemaSupported) return promptSchemaNotSupported(params);
  if (!schemaLoaded) return promptSchemaNotLoaded(params);
};

export const promptRootNotSupported = ({ rootName, writer }: ProcessSchemaProps) => {
  writer.overmindActions.ui.openDialog({
    type: 'simple',
    props: {
      maxWidth: 'xs',
      preventEscape: true,
      severity: 'error',
      title: t('LW.Document not supported'),
      Body: () => (
        <Trans i18nKey="LW.messages.root element invalid" ns="leafwriter" values={{ rootName }}>
          <Typography>LEAF-Writer cannot open this document.</Typography>
          <Typography>Root element</Typography>
          <TextEmphasis color="error">{rootName}</TextEmphasis>
          <Typography>not supported.</Typography>
        </Trans>
      ),

      onClose: () => handleSchemaCancel(writer),
    },
  });
};

export const promptSchemaNotFound = (params: ProcessSchemaProps) => {
  const { writer } = params;
  const possibleSchemas = getPossibleSupportedSchemas(writer, params.rootName!);

  const actions = [
    { action: 'cancel', label: t('LW.commons.cancel') },
    { action: 'addSchema', label: t('LW.add schema'), variant: 'outlined' },
  ];

  if (possibleSchemas.length > 0) {
    actions.splice(1, 0, {
      action: 'selectSchema',
      label: t('LW.select supported schema'),
      variant: 'outlined',
    });
  }

  writer.overmindActions.ui.openDialog({
    props: {
      maxWidth: 'sm',
      preventEscape: true,
      severity: 'warning',
      title: t('LW.Schema not found'),
      Body: () => (
        <Typography>
          {t(`LW.messages.LEAF-Writer could not find the document schema declaration`)}
        </Typography>
      ),
      actions,
      onClose: (action: string) => {
        if (action === 'cancel') return handleSchemaCancel(writer);
        openProcessIssueDialog(params, action);
      },
    },
  });
};

export const promptSchemaNotSupported = (params: ProcessSchemaProps) => {
  const { writer } = params;
  const possibleSchemas = getPossibleSupportedSchemas(writer, params.rootName!);

  const actions = [
    { action: 'cancel', label: t('LW.commons.cancel') },
    { action: 'addSchema', label: t('LW.add schema'), variant: 'outlined' },
  ];

  if (possibleSchemas.length > 0) {
    actions.splice(1, 0, {
      action: 'selectSchema',
      label: t('LW.select supported schema'),
      variant: 'outlined',
    });
  }

  writer.overmindActions.ui.openDialog({
    props: {
      maxWidth: 'sm',
      preventEscape: true,
      severity: 'warning',
      title: t('LW.Schema not supported'),
      Body: () => (
        <Trans
          i18nKey="LW.messages.schema not supported"
          ns="leafwriter"
          shouldUnescape={true}
          values={{ rng: params.docSchema?.rng }}
        >
          <Typography>LEAF-Writer does not support the schema attached to the document:</Typography>
          <TextEmphasis disablePadding color="warning">
            {params.docSchema?.rng}
          </TextEmphasis>
        </Trans>
      ),
      actions,
      onClose: (action: string) => {
        if (action === 'cancel') return handleSchemaCancel(writer);
        openProcessIssueDialog(params, action);
      },
    },
  });
};

export const promptSchemaNotLoaded = (params: ProcessSchemaProps) => {
  const { docSchema, selectedSchema, writer } = params;

  const possibleSchemas = getPossibleSupportedSchemas(writer, params.rootName!);

  const actions = [
    { action: 'cancel', label: t('LW.commons.cancel') },
    { action: 'addSchema', label: t('LW.add schema'), variant: 'outlined' },
  ];

  if (possibleSchemas.length > 0) {
    actions.splice(1, 0, {
      action: 'selectSchema',
      label: t('LW.select supported schema'),
      variant: 'outlined',
    });
  }

  writer.overmindActions.ui.openDialog({
    props: {
      maxWidth: 'sm',
      preventEscape: true,
      severity: 'warning',
      title: t('LW.Schema not loaded'),
      Body: () => (
        <Trans
          i18nKey="LW.messages.schema not loaded"
          ns="leafwriter"
          shouldUnescape={true}
          values={{ rng: docSchema?.rng }}
        >
          <Typography>LEAF-Writer could not load the schema</Typography>
          <TextEmphasis disablePadding color="warning">
            {docSchema?.rng ?? selectedSchema?.name}
          </TextEmphasis>
        </Trans>
      ),
      actions,
      onClose: (action: string) => {
        if (action === 'cancel') return handleSchemaCancel(writer);
        openProcessIssueDialog(params, action);
      },
    },
  });
};

export const promptSelectSchema = (params: ProcessSchemaProps) => {
  const { doc, rootName, writer } = params;
  const { schemaManager } = writer;

  if (!rootName) return;

  const mappingIds = schemaManager.getMappingIdsFromRoot(rootName);

  const onSchemaSelect = async (schema: Schema) => {
    const { xml2cwrc } = writer.converter;

    if (schema.id === schemaManager.schemaId) return xml2cwrc.doProcessing(doc);

    params.schemaLoaded = await schemaManager.loadSchema(schema.id);
    if (!params.schemaLoaded) return openProcessIssueDialog(params);

    xml2cwrc.doProcessing(doc);
  };

  const onClose = (action: string) => {
    if (action === 'cancel') {
      if (isDesktopApp()) return;
      openProcessIssueDialog(params);
    }
  };

  const openNativeSchemaPicker = (
    window as Window & {
      __ljbOpenNativeSchemaPicker?: (options: {
        mappingIds: typeof mappingIds;
        onSchemaSelect: (schema: Schema) => void | Promise<void>;
        onClose: (action: string) => void;
      }) => Promise<void>;
    }
  ).__ljbOpenNativeSchemaPicker;

  if (isDesktopApp() && openNativeSchemaPicker) {
    void openNativeSchemaPicker({ mappingIds, onSchemaSelect, onClose });
    return;
  }

  writer.overmindActions.ui.openDialog({
    type: 'selectSchema',
    props: {
      mappingIds,
      onSchemaSelect,
      onClose,
    },
  });
};

export const promptAddSchema = (params: ProcessSchemaProps) => {
  const { doc, docSchema, rootName, writer } = params;
  const { converter, overmindActions, schemaManager } = writer;

  if (!rootName) return;

  const mappingIds = schemaManager.getMappingIdsFromRoot(rootName);
  const DEFAULT_TEI_CSS = 'https://cwrc.ca/templates/css/tei.css';
  const enrichedDocSchema = {
    rng: docSchema?.rng,
    css: docSchema?.css ?? DEFAULT_TEI_CSS,
  };

  overmindActions.ui.openDialog({
    type: 'editSchema',
    props: {
      docSchema: enrichedDocSchema,
      mappingIds,
      onAcceptChanges: async (newSchema: Schema) => {
        params.schemaLoaded = await schemaManager.loadSchema(newSchema.id);
        if (!params.schemaLoaded) return openProcessIssueDialog(params);

        converter.xml2cwrc.doProcessing(doc);
      },
      onClose: async (action: string) => {
        if (action === 'cancel') openProcessIssueDialog(params);
      },
    },
  });
};
