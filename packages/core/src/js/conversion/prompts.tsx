import { Typography } from '@mui/material';
import React, { FC } from 'react';
import { Trans } from 'react-i18next';
import { TextEmphasis } from '../../components';
import { SimpleDialogMessageProps } from '../../dialogs';
import i18next from '../../i18n';
import { Schema } from '../../types';
import Writer from '../Writer';

// * The following line is need for VSC extension i18n ally to work
// useTranslation('leafwriter');

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

const { t } = i18next;

export const openProcessIssueDialog = (params: ProcessSchemaProps, action?: string) => {
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
      title: t('Document not supported', { ns: 'leafwriter' }),
      Message: () => (
        <Trans i18nKey="messages.root element invalid" ns="leafwriter" values={{ rootName }}>
          <Typography>LEAF-Writer cannot open this document.</Typography>
          <Typography>Root element</Typography>
          <TextEmphasis color="error">{rootName}</TextEmphasis>
          <Typography>not supported.</Typography>
        </Trans>
      ),

      onClose: () => writer.overmindActions.editor.closeEditor(),
    },
  });
};

export const promptSchemaNotFound = (params: ProcessSchemaProps) => {
  const { writer } = params;

  writer.overmindActions.ui.openDialog({
    props: {
      maxWidth: 'sm',
      preventEscape: true,
      severity: 'warning',
      title: t('Schema not found'),
      Message: () => (
        <Typography>
          {`${t(`messages.LEAF-Writer could not find the document schema declaration`, {
            ns: 'leafwriter',
          })}`}
        </Typography>
      ),
      actions: [
        { action: 'cancel', label: t('commons.cancel', { ns: 'leafwriter' }) },
        { action: 'addSchema', label: t('add schema', { ns: 'leafwriter' }), variant: 'outlined' },
        {
          action: 'selectSchema',
          label: t('select supported schema', { ns: 'leafwriter' }),
          variant: 'outlined',
        },
      ],
      onClose: (action: string) => {
        if (action === 'cancel') return writer.overmindActions.editor.closeEditor();
        openProcessIssueDialog(params, action);
      },
    },
  });
};

export const promptSchemaNotSupported = (params: ProcessSchemaProps) => {
  const { writer } = params;

  writer.overmindActions.ui.openDialog({
    props: {
      maxWidth: 'sm',
      preventEscape: true,
      severity: 'warning',
      title: t('Schema not supported', { ns: 'leafwriter' }),
      Message: () => (
        <Trans
          i18nKey="messages.schema not supported"
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
      actions: [
        { action: 'cancel', label: t('commons.cancel', { ns: 'leafwriter' }) },
        {
          action: 'selectSchema',
          label: t('select supported schema', { ns: 'leafwriter' }),
          variant: 'outlined',
        },
        { action: 'addSchema', label: t('add schema', { ns: 'leafwriter' }), variant: 'outlined' },
      ],
      onClose: (action: string) => {
        if (action === 'cancel') return writer.overmindActions.editor.closeEditor();
        openProcessIssueDialog(params, action);
      },
    },
  });
};

export const promptSchemaNotLoaded = (params: ProcessSchemaProps) => {
  const { docSchema, selectedSchema, writer } = params;

  writer.overmindActions.ui.openDialog({
    props: {
      maxWidth: 'sm',
      preventEscape: true,
      severity: 'warning',
      title: t('Schema not loaded'),
      Message: () => (
        <Trans
          i18nKey="messages.schema not loaded"
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
      actions: [
        { action: 'cancel', label: t('commons.cancel', { ns: 'leafwriter' }) },
        { action: 'addSchema', label: t('add schema', { ns: 'leafwriter' }), variant: 'outlined' },
        {
          action: 'selectSchema',
          label: t('select supported schema', { ns: 'leafwriter' }),
          variant: 'outlined',
        },
      ],
      onClose: (action: string) => {
        if (action === 'cancel') return writer.overmindActions.editor.closeEditor();
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

  writer.overmindActions.ui.openDialog({
    type: 'selectSchema',
    props: {
      mappingIds,
      onSchemaSelect: async (schema: Schema) => {
        const { xml2cwrc } = writer.converter;

        if (schema.id === schemaManager.schemaId) return xml2cwrc.doProcessing(doc);

        params.schemaLoaded = await schemaManager.loadSchema(schema.id);
        if (!params.schemaLoaded) return openProcessIssueDialog(params);

        xml2cwrc.doProcessing(doc);
      },
      onClose: (action: string) => {
        if (action === 'cancel') openProcessIssueDialog(params);
      },
    },
  });
};

export const promptAddSchema = (params: ProcessSchemaProps) => {
  const { doc, docSchema, rootName, writer } = params;
  const { converter, overmindActions, schemaManager } = writer;

  if (!rootName) return;

  const mappingIds = schemaManager.getMappingIdsFromRoot(rootName);

  overmindActions.ui.openDialog({
    type: 'editSchema',
    props: {
      docSchema,
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

export const openEditorModeDialog = async (writer: Writer) => {
  const { allowOverlap, mode, overmindActions } = writer;

  const dialogTitle = 'Editor Mode';
  const shouldDisplayDialog = await overmindActions.ui.shouldDisplayDialog(dialogTitle);
  if (!shouldDisplayDialog) return;

  let Body: FC<SimpleDialogMessageProps>;

  if (mode === writer.XML) {
    Body = () => (
      <>
        <TextEmphasis color="info">{`Markup ${t('commons.only', {
          ns: 'leafwriter',
        })}`}</TextEmphasis>
        <Typography>{`${t('Only XML tags No RDF Semantic Web annotations will be created', {
          ns: 'leafwriter',
        })}.`}</Typography>
        <Typography paragraph mt={3} variant="caption">
          <b>{`${t('commons.hint')}: `}</b>
          {`${t('You can change the editor mode anytime in the status bar', { ns: 'leafwriter' })}`}
        </Typography>
      </>
    );
  } else {
    if (allowOverlap) {
      Body = () => (
        <>
          <TextEmphasis color="info">{`Markup & Linking with overlap`}</TextEmphasis>
          <Typography>
            {`${t(
              'XML tags and RDF - Semantic Web annotations equivalent to the XML tags will be created consistent with the hierarchy of the XML schema so annotations will not be allowed to overlap',
              { ns: 'leafwriter' },
            )} ${t(
              'Annotations that overlap will be created in RDF only with no equivalent XML tags',
              { ns: 'leafwriter' },
            )}.`}
          </Typography>
          <Typography paragraph mt={3} variant="caption">
            <b>{`${t('commons.hint', { ns: 'leafwriter' })}: `}</b>
            {`${t('You can change the editor mode anytime in the status bar', {
              ns: 'leafwriter',
            })}.`}
          </Typography>
        </>
      );
    } else {
      Body = () => (
        <>
          <TextEmphasis color="info">{`Markup & Linking`}</TextEmphasis>
          <Typography>
            {`${t(
              'XML tags and RDF - Semantic Web annotations equivalent to the XML tags will be created consistent with the hierarchy of the XML schema so annotations will not be allowed to overlap',
              { ns: 'leafwriter' },
            )}`}
          </Typography>
          <Typography paragraph mt={3} variant="caption">
            <b>{`${t('hint', { ns: 'leafwriter' })}: `}</b>
            {`${t('You can change the editor mode anytime in the status bar', {
              ns: 'leafwriter',
            })}.`}
          </Typography>
        </>
      );
    }
  }

  overmindActions.ui.openDialog({
    props: {
      severity: 'info',
      title: t('Editor Mode', { ns: 'leafwriter' }),
      Body,
      actions: [
        { action: 'notShowAgain', label: t('dont show again', { ns: 'leafwriter' }) },
        { action: 'ok', label: t('commons.ok', { ns: 'leafwriter' }) },
      ],
      onClose: async (action: string) => {
        if (action === 'notShowAgain') await overmindActions.ui.doNotDisplayDialog(dialogTitle);
      },
    },
  });
};
